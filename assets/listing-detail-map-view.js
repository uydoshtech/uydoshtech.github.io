// Yandex map canvas for listing.html. Loaded on first expand of the map
// section (or a metro route tap), not with the initial listing HTML.
// Address, amenities, and move-in markup stay in listing-detail-map.js.
      const MAP_LOAD_TIMEOUT_MS = 18000;

      function showListingMapError(container) {
        container.innerHTML = `
          <div class="map-section-status">
            <div class="map-section-status-inner">
              <div>${UyDosh.escapeHtml(UyDosh.t('detail.mapLoadError'))}</div>
              <button type="button" class="btn" data-map-retry>${UyDosh.escapeHtml(UyDosh.t('map.retry'))}</button>
            </div>
          </div>
        `;
        container.querySelector('[data-map-retry]')?.addEventListener('click', () => {
          state.mapLoaded = false;
          state.mapLoading = false;
          UyDosh.resetYandexMaps({ hard: true });
          mountListingMap();
        });
      }

      // Memoizes the in-flight mount so concurrent callers (the accordion
      // toggle *and* any metro row's "draw route" button, see
      // `bindMetroStationRouteButtons`) await the same load instead of one
      // of them racing past the `state.mapLoading` guard before the map
      // instance actually exists yet.
      let mapMountPromise = null;

      function mountListingMap() {
        if (mapMountPromise) return mapMountPromise;
        const container = rootEl.querySelector('#listing-map');
        if (!container || state.mapLoaded) return Promise.resolve();
        state.mapLoading = true;
        mapMountPromise = (async () => {
          container.innerHTML = `<div class="map-section-status">${UyDosh.escapeHtml(UyDosh.t('map.loading'))}</div>`;
          try {
            await UyDosh.waitForElementLayout(container);
            const mapModule = await UyDosh.withTimeout(
              UyDosh.loadYandexMapModule(),
              MAP_LOAD_TIMEOUT_MS,
              'Map module load timed out',
            );
            const districts = UyDosh.listingSearchDistricts(state.listing);
            const coords = mapModule.resolveListingMapCoordinates(state.listing);
            if (!coords && !districts.length) {
              container.innerHTML = `<div class="map-section-status">${UyDosh.escapeHtml(UyDosh.t('detail.mapUnavailable'))}</div>`;
              return;
            }
            container.innerHTML = '';
            await UyDosh.waitForElementLayout(container);
            const map = await UyDosh.withTimeout(
              districts.length ? mapModule.renderSearchDistrictMap(container, {
                locationIds: districts.map(d => Number(d.id)),
                lang: UyDosh.getLang(),
              }) : mapModule.renderSinglePinMap(container, {
                latitude: coords.latitude,
                longitude: coords.longitude,
                lang: UyDosh.getLang(),
                pin: {
                  id: state.listing?.id,
                  listing_type_id: state.listing?.listing_type_id ?? state.listing?.listing_type?.id,
                  listing_type_code: state.listing?.listing_type?.code ?? state.listing?.listing_type_code,
                  host_resident: state.listing?.host_resident,
                },
                selected: true,
              }),
              MAP_LOAD_TIMEOUT_MS,
              'Map render timed out',
            );
            if (!map) {
              throw new Error('Listing map failed to render');
            }
            const approxNote = rootEl.querySelector('[data-map-approx-note]');
            if (approxNote) {
              approxNote.toggleAttribute('hidden', districts.length > 0 || coords?.source !== 'approximate');
            }
            state.mapLoaded = true;
            UyDosh.reflowActiveMaps();
            if (!districts.length) {
              refineMetroStationWalkTimes(mapModule, state.listing);
              drawNearestMetroStationRoute(mapModule, container, state.listing);
            }
          } catch (err) {
            console.error('Failed to load listing map', err);
            showListingMapError(container);
          } finally {
            state.mapLoading = false;
          }
        })();
        mapMountPromise.finally(() => { mapMountPromise = null; });
        return mapMountPromise;
      }

      /**
       * Upgrades each metro row's straight-line walk-time text (see
       * `buildMetroStationRowHtml` / `UyDosh.stationWalkInfo`) to a real
       * Yandex pedestrian-routing number — mirrors
       * `refineNearbyStationWalkTimes` in telegram-create.js. Deliberately
       * *not* run on initial page load, only once `mountListingMap()`
       * actually succeeds (i.e. the author opened the map section, or
       * tapped a "draw route" button which opens it first): the summary row
       * with the straight-line estimate is visible before that, and every
       * listing page view running this eagerly would spend a Router access
       * per tagged station on every single view — unlike the create
       * wizard's one-off use while drafting, that's real recurring site
       * traffic. Piggybacking on the same gesture that already lazy-loads
       * the Yandex script keeps the free daily Router quota mostly spent on
       * visitors who actually engage with the map.
       *
       * Patches only each row's own `.map-section-walk-text` (found via the
       * `data-station-id` `buildMetroStationRowHtml` put on the row) instead
       * of a full re-render, and is guarded by a token so a stale in-flight
       * lookup from an earlier mount (map collapsed/expanded again) can't
       * clobber a newer one.
       */
      function refineMetroStationWalkTimes(mapModule, listing) {
        const refCoords = UyDosh.listingReferenceCoordinates(listing);
        const stations = listingMetroStations(listing).filter(
          (st) => Number.isFinite(Number(st?.latitude)) && Number.isFinite(Number(st?.longitude)),
        );
        if (!refCoords || stations.length === 0) return;

        const token = (state.metroWalkRefineToken += 1);
        mapModule.fetchPedestrianWalkTimes(
          UyDosh.getLang(),
          refCoords,
          stations.map((st) => ({ latitude: Number(st.latitude), longitude: Number(st.longitude) })),
        ).then((results) => {
          if (state.metroWalkRefineToken !== token || results.size === 0) return;
          for (const [index, { minutes, meters }] of results) {
            const station = stations[index];
            const stationId = Number(station?.id);
            if (!Number.isFinite(stationId)) continue;
            const textEl = rootEl.querySelector(
              `.map-section-row-metro[data-station-id="${stationId}"] .map-section-walk-text`,
            );
            if (!textEl) continue;
            textEl.textContent = UyDosh.t('detail.metroWalkInfo')
              .replace('{km}', (meters / 1000).toFixed(1))
              .replace('{minutes}', String(Math.max(1, Math.round(minutes))));
          }
        }).catch(() => { /* keep the straight-line estimate already on screen */ });
      }

      /**
       * Draws a pedestrian route from the listing's pin to its closest
       * tagged metro station (see `nearestMetroStation`) as soon as the map
       * finishes mounting — same `setPinGuideLines` call a per-station
       * "draw route" button tap makes (see `bindMetroStationRouteButtons`),
       * just fired automatically instead of waiting for one. No-ops when the
       * listing has no station with usable coordinates. Toggling that
       * station's own button off afterwards removes this line same as any
       * other; toggling a *different* station's button on adds its route
       * alongside this one instead of replacing it (see
       * `activeMetroStationRouteIds`).
       */
      function drawNearestMetroStationRoute(mapModule, container, listing) {
        const station = nearestMetroStation(listing);
        const latitude = Number(station?.latitude);
        const longitude = Number(station?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        const line = Number(station.line) || UyDosh.resolveMetroLine(listing);
        const stationId = Number(station.id);
        if (Number.isFinite(stationId)) {
          state.activeMetroStationRouteIds.add(stationId);
          setMetroRouteButtonPressed(
            rootEl.querySelector(`.map-section-row-route-btn[data-station-id="${stationId}"]`),
            true,
          );
        }
        mapModule.setPinGuideLines(container, [
          { latitude, longitude, color: UyDosh.metroLineColor(line) || undefined },
        ]);
      }

      /**
       * Awaits `mountListingMap()`, resolving immediately once the map is
       * already open/loaded (the normal case now that the section always
       * renders expanded — see `bindMapSection`). Kept as a safety net for
       * every metro row's "draw route" button (see
       * `bindMetroStationRouteButtons`) in case it's ever clicked before
       * `bindMapSection`'s initial mount has finished, so it still waits for
       * the pin to exist before trying to draw a line to it.
       */
      function expandMapSection() {
        const toggle = rootEl.querySelector('[data-map-toggle]');
        const section = rootEl.querySelector('[data-map-section]');
        const body = rootEl.querySelector('.map-section-body');
        if (!toggle || !section || !body) return Promise.resolve();
        if (state.mapExpanded) return mountListingMap();

        state.mapExpanded = true;
        section.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-expanded', 'true');
        body.hidden = false;
        return new Promise((resolve) => {
          setTimeout(() => {
            if (state.mapExpanded) mountListingMap().then(resolve, resolve);
            else resolve();
          }, 350);
        });
      }

      function bindMapSection() {
        const toggle = rootEl.querySelector('[data-map-toggle]');
        const section = rootEl.querySelector('[data-map-section]');
        const body = rootEl.querySelector('.map-section-body');
        if (!toggle || !section || !body) return;

        if (section.dataset.mapViewBound !== '1') {
          section.dataset.mapViewBound = '1';
          toggle.addEventListener('click', (event) => {
            if (event.target.closest('[data-station-route]')) return;
            if (state.mapExpanded) {
              state.mapExpanded = false;
              section.setAttribute('aria-expanded', 'false');
              toggle.setAttribute('aria-expanded', 'false');
              body.hidden = true;
              return;
            }
            expandMapSection();
          });
        }

        bindMetroStationRouteButtons();
      }

      /**
       * Scrolls the map section into view when it isn't fully on screen —
       * e.g. the metro row tapped (see `bindMetroStationRouteButtons` below)
       * sits far enough from it that the just-drawn route would otherwise
       * land off-screen. No-ops if the section is already fully visible.
       */
      function scrollMapIntoViewIfNeeded() {
        const section = rootEl.querySelector('[data-map-section]');
        if (!section) return;
        const rect = section.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const fullyVisible = rect.top >= 0 && rect.bottom <= viewportHeight;
        if (fullyVisible) return;
        section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      /**
       * Flips a single "draw route" button's on/off visuals — `aria-pressed`
       * (styled in listing-detail.css off `[aria-pressed="true"]`), its
       * a11y label, and a `--route-btn-active-color` custom property so the
       * filled "on" background matches that station's own metro-line color
       * (see `data-color`, same color the route itself is drawn in) instead
       * of one flat accent for every line. No-ops on a `null`/missing
       * element so callers (e.g. `drawNearestMetroStationRoute`) can pass a
       * `querySelector` result straight through.
       */
      function setMetroRouteButtonPressed(btn, pressed) {
        if (!btn) return;
        btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
        btn.setAttribute(
          'aria-label',
          UyDosh.t(pressed ? 'detail.hideRouteToStation' : 'detail.showRouteToStation'),
        );
        if (pressed && btn.dataset.color) {
          btn.style.setProperty('--route-btn-active-color', btn.dataset.color);
        } else {
          btn.style.removeProperty('--route-btn-active-color');
        }
      }

      /**
       * Every currently-toggled-on station's route, read back off the
       * buttons themselves (rather than kept as a separate lat/lon list) so
       * `activeMetroStationRouteIds` only ever has to track ids — this stays
       * the single source of truth for what `setPinGuideLines` should be
       * showing right now, whether that's after a button tap or a fresh
       * `bindMetroStationRouteButtons` call following a full re-render.
       */
      function activeMetroRouteLines() {
        const summary = rootEl.querySelector('.map-section-summary');
        if (!summary) return [];
        const lines = [];
        for (const btn of summary.querySelectorAll('[data-station-route]')) {
          const stationId = Number(btn.dataset.stationId);
          if (!Number.isFinite(stationId) || !state.activeMetroStationRouteIds.has(stationId)) continue;
          const latitude = Number(btn.dataset.lat);
          const longitude = Number(btn.dataset.lon);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
          lines.push({ latitude, longitude, color: btn.dataset.color || undefined });
        }
        return lines;
      }

      /**
       * Delegated click/keyboard handler for every metro row's
       * `[data-station-route]` pseudo-button (see `buildMetroStationRowHtml`)
       * — attached to `.map-section-summary`, a descendant of (but distinct
       * element from) the outer `.map-section-toggle` `<button>`, so calling
       * `stopPropagation()` here keeps a route-button tap from also
       * triggering the (now always-expanded, see `bindMapSection`) accordion
       * toggle.
       *
       * Each button is an independent on/off toggle rather than a radio —
       * tapping one adds/removes just its own station from
       * `activeMetroStationRouteIds` and re-passes the *whole* resulting set
       * to `setPinGuideLines`, which redraws every active route together and
       * re-fits the camera around all of them plus the pin at once (see its
       * docstring in yandex-map.js). Also (re-)syncs every button's pressed
       * visual from that same set on (re-)bind, so a full re-render (e.g.
       * language switch) doesn't leave a stale "off" look on a route that's
       * actually still drawn.
       */
      function bindMetroStationRouteButtons() {
        const summary = rootEl.querySelector('.map-section-summary');
        if (!summary) return;

        for (const btn of summary.querySelectorAll('[data-station-route]')) {
          const stationId = Number(btn.dataset.stationId);
          setMetroRouteButtonPressed(btn, Number.isFinite(stationId) && state.activeMetroStationRouteIds.has(stationId));
        }

        const activate = async (btn) => {
          const latitude = Number(btn.dataset.lat);
          const longitude = Number(btn.dataset.lon);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
          const stationId = Number(btn.dataset.stationId);
          const turningOn = !Number.isFinite(stationId) || !state.activeMetroStationRouteIds.has(stationId);
          try {
            scrollMapIntoViewIfNeeded();
            await expandMapSection();
            const mapModule = await UyDosh.loadYandexMapModule();
            const mapContainer = rootEl.querySelector('#listing-map');
            if (Number.isFinite(stationId)) {
              if (turningOn) state.activeMetroStationRouteIds.add(stationId);
              else state.activeMetroStationRouteIds.delete(stationId);
              setMetroRouteButtonPressed(btn, turningOn);
              mapModule.setPinGuideLines(mapContainer, activeMetroRouteLines());
            } else {
              // No station id to toggle off of later — fall back to a single
              // always-on route, same as before per-station toggling existed.
              setMetroRouteButtonPressed(btn, true);
              mapModule.setPinGuideLines(mapContainer, [
                { latitude, longitude, color: btn.dataset.color || undefined },
              ]);
            }
          } catch (err) {
            console.error('Failed to draw route to metro station', err);
          }
        };

        summary.addEventListener('click', (event) => {
          const btn = event.target.closest('[data-station-route]');
          if (!btn) return;
          event.preventDefault();
          event.stopPropagation();
          activate(btn);
        });
        summary.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          const btn = event.target.closest('[data-station-route]');
          if (!btn) return;
          event.preventDefault();
          event.stopPropagation();
          activate(btn);
        });
      }

