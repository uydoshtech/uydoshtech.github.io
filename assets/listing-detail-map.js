// Part of listing.html's detail-page script, split out of the former single
// ~2900-line assets/listing-detail.js for maintainability (that file is the
// highest-churn file in the site). Loaded as a plain classic <script defer>
// alongside the other listing-detail-*.js files and assets/listing-detail.js
// itself — they all share one global scope (like separate inline <script>
// blocks would), so functions defined here are called directly by the other
// modules and by listing-detail.js's render()/load(). See listing-detail.js
// for the overall module map.
//
// This file: amenities/move-in chips, nearest-metro lookups, and the collapsible Yandex map section.
      function buildAmenitiesRowHtml(amenities, lang) {
        const list = Array.isArray(amenities) ? amenities : [];
        if (list.length === 0) return '';
        const chips = UyDosh.sortAmenities(list, 'detail').map((amenity) => {
          const label = UyDosh.localized(amenity, lang);
          const code = UyDosh.getAmenityCode(amenity);
          const icon = code ? UyDosh.amenityIconHtml(code, { size: 16 }) : '';
          return `<span class="amenity">${icon}<span>${UyDosh.escapeHtml(label)}</span></span>`;
        }).join('');
        return `<div class="amenities amenities-inline">${chips}</div>`;
      }

      /**
       * Move-in date + amenities, styled as extra rows inside the
       * description card (see `map-section-extra` / `map-section-static`)
       * so they sit directly under the listing description instead of
       * trailing after the location/metro card.
       */
      function buildMoveInExtraHtml(l, lang) {
        if (!l.move_in_date) return '';
        return `
          <div class="map-section-extra map-section-move-in-extra">
            <dl class="meta-grid">
              <dt>${UyDosh.iconCalendar()}${UyDosh.escapeHtml(UyDosh.t('detail.moveIn'))}</dt>
              <dd>${UyDosh.escapeHtml(UyDosh.formatDate(l.move_in_date, lang))}</dd>
            </dl>
          </div>
        `;
      }

      function buildAmenitiesExtraHtml(amenities, lang) {
        const row = buildAmenitiesRowHtml(amenities, lang);
        if (!row) return '';
        return `
          <div class="map-section-extra map-section-amenities-extra">
            <h2 data-i18n="detail.amenities">${UyDosh.escapeHtml(UyDosh.t('detail.amenities'))}</h2>
            ${row}
          </div>
        `;
      }

      /**
       * One metro-station summary row: name + (when we can compute one) a
       * clock icon with walking distance/time from the listing's location
       * to that station — see `UyDosh.stationWalkInfo` in uydosh-core.js —
       * plus a "draw route" button (when the station has coordinates) that
       * plots a pedestrian route from the listing's pin to it on the map
       * below (see `bindMetroStationRouteButtons` / `setPinGuideLines`).
       *
       * The straight-line km/min shown here is only the *initial* number,
       * good enough for the collapsed summary that's visible before any map
       * traffic is spent — `refineMetroStationWalkTimes` swaps it for a
       * real Yandex-routed figure once the map section actually opens. The
       * row carries `data-station-id` and the text its own
       * `.map-section-walk-text` span so that later patch can target it
       * directly without a full re-render.
       */
      function buildMetroStationRowHtml(station, lang, fallbackLine, refCoords) {
        const name = UyDosh.localized(station, lang);
        if (!name) return '';
        const line = Number(station.line) || fallbackLine;
        const walk = UyDosh.stationWalkInfo(refCoords, station);
        const walkHtml = walk ? `
          <span class="map-section-walk">${UyDosh.iconClock()}<span class="map-section-walk-text">${UyDosh.escapeHtml(
            UyDosh.t('detail.metroWalkInfo')
              .replace('{km}', walk.km.toFixed(1))
              .replace('{minutes}', String(Math.max(1, Math.round(walk.minutes)))),
          )}</span></span>` : '';
        const stationLat = Number(station.latitude);
        const stationLon = Number(station.longitude);
        const stationId = Number(station.id);
        // `data-station-id` is duplicated here (also on the row div below) so
        // `bindMetroStationRouteButtons` can key its on/off toggle Set off the
        // button itself without needing to walk up to the parent row.
        const stationIdAttr = Number.isFinite(stationId) ? ` data-station-id="${stationId}"` : '';
        const routeBtn = Number.isFinite(stationLat) && Number.isFinite(stationLon)
          ? `<span class="map-section-row-route-btn" data-station-route${stationIdAttr} data-lat="${stationLat}" data-lon="${stationLon}" data-color="${UyDosh.escapeHtml(UyDosh.metroLineColor(line) || '')}" role="button" tabindex="0" aria-pressed="false" aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.showRouteToStation'))}">${UyDosh.iconRoute()}</span>`
          : '';
        const idAttr = Number.isFinite(stationId) ? ` data-station-id="${stationId}"` : '';
        return `<div class="map-section-row map-section-row-metro"${idAttr}>${UyDosh.iconMetro(line)}<span class="map-section-row-metro-text"><span class="map-section-row-label">${UyDosh.escapeHtml(name)}</span>${walkHtml}</span>${routeBtn}</div>`;
      }

      /**
       * Several stations can be tagged on a listing (see multi-station
       * selection in telegram-create.js) — `search_subway_stations` holds
       * all of them, falling back to the single legacy `subway_station`.
       * Shared by `buildMapSectionHtml` (initial render) and
       * `refineMetroStationWalkTimes` (real-routing upgrade) so both agree
       * on exactly which stations are shown.
       */
      function listingMetroStations(l) {
        return Array.isArray(l?.search_subway_stations) && l.search_subway_stations.length > 0
          ? l.search_subway_stations
          : (l?.subway_station ? [l.subway_station] : []);
      }

      /**
       * Closest tagged metro station by straight-line walk distance (see
       * `UyDosh.stationWalkInfo`), or `null` when the listing has no station
       * with usable coordinates — used to auto-draw a route to it on map load
       * (see `mountListingMap`) without waiting for the user to tap a
       * per-station "draw route" button.
       */
      function nearestMetroStation(l) {
        const refCoords = UyDosh.listingReferenceCoordinates(l);
        if (!refCoords) return null;
        let nearest = null;
        let nearestKm = Infinity;
        for (const station of listingMetroStations(l)) {
          const walk = UyDosh.stationWalkInfo(refCoords, station);
          if (!walk || walk.km >= nearestKm) continue;
          nearestKm = walk.km;
          nearest = station;
        }
        return nearest;
      }

      function buildMapSectionHtml(l, lang) {
        const locName = UyDosh.localized(l.location, lang);
        const metroLine = UyDosh.resolveMetroLine(l);
        const address = typeof l.address_text === 'string' ? l.address_text.trim() : '';
        const stations = listingMetroStations(l);
        const hasLocation = Boolean(locName);
        const hasMetro = stations.length > 0;
        const hasAddress = Boolean(address);
        if (!hasLocation && !hasMetro && !hasAddress) return '';

        // District, then exact address, then metro stations last — the
        // general-to-specific area info comes first, with nearby-transit
        // details (which can run to several rows/lines for multi-station
        // listings) trailing at the bottom of the summary.
        const rows = [];
        if (hasLocation) {
          rows.push(`<div class="map-section-row">${UyDosh.iconPin()}<span>${UyDosh.escapeHtml(locName)}</span></div>`);
        }
        if (hasAddress) {
          // Extra top margin (on top of `.map-section-summary`'s row gap) so the
          // exact address stands apart from the district row above it — that
          // describes the general area, this is the precise address.
          // The country segment is redundant inside the Mini App (Telegram
          // users are already local), so it's reformatted away there as
          // "Street, District, City" (see `UyDosh.formatListingDetailAddressText`);
          // the standalone website keeps the full raw address.
          const displayAddress = UyDosh.isMiniApp()
            ? UyDosh.formatListingDetailAddressText(address)
            : address;
          rows.push(`<div class="map-section-row map-section-row-address">${UyDosh.iconHome()}<span>${UyDosh.escapeHtml(displayAddress)}</span></div>`);
        }
        if (hasMetro) {
          const refCoords = UyDosh.listingReferenceCoordinates(l);
          const metroRows = stations
            .map((station) => buildMetroStationRowHtml(station, lang, metroLine, refCoords))
            .filter(Boolean);
          // Same "stands apart from the rows above it" treatment as the
          // address row, but only on the first station row — multiple
          // stations shouldn't each get extra spacing from one another.
          if (metroRows.length && rows.length) {
            metroRows[0] = metroRows[0].replace(
              'map-section-row-metro',
              'map-section-row-metro map-section-row-metro-group-start',
            );
          }
          rows.push(...metroRows);
        }

        return `
          <section class="map-section" data-map-section aria-expanded="true">
            <button type="button" class="map-section-toggle" data-map-toggle aria-expanded="true">
              <div class="map-section-summary">${rows.join('')}</div>
            </button>
          <div class="map-section-body">
            <div class="map-container" id="listing-map" aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.map'))}"></div>
            <div class="map-section-approx-note" data-map-approx-note hidden>${UyDosh.iconLocateMe()}${UyDosh.escapeHtml(UyDosh.t('map.approximateLocation'))}</div>
          </div>
        </section>
      `;
      }

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
            const coords = mapModule.resolveListingMapCoordinates(state.listing);
            if (!coords) {
              container.innerHTML = `<div class="map-section-status">${UyDosh.escapeHtml(UyDosh.t('detail.mapUnavailable'))}</div>`;
              return;
            }
            container.innerHTML = '';
            await UyDosh.waitForElementLayout(container);
            const map = await UyDosh.withTimeout(
              mapModule.renderSinglePinMap(container, {
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
              approxNote.toggleAttribute('hidden', coords.source !== 'approximate');
            }
            state.mapLoaded = true;
            UyDosh.reflowActiveMaps();
            refineMetroStationWalkTimes(mapModule, state.listing);
            drawNearestMetroStationRoute(mapModule, container, state.listing);
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

        // Always expanded (no collapse) — markup already renders it open (see
        // buildMapSectionHtml). Mount immediately rather than routing through
        // expandMapSection()'s 350ms delay (that exists to let a click-driven
        // collapsed->expanded transition settle first; there's nothing to
        // wait out here since the section is already open at first paint).
        // `expandMapSection()` still short-circuits straight to
        // `mountListingMap()` for the metro row "draw route" buttons below,
        // since `state.mapExpanded` is already true by the time those fire.
        state.mapExpanded = true;
        mountListingMap();

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

