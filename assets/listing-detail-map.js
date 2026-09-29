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
       * Calendar days from local today to `move_in_date` (YYYY-MM-DD).
       * Positive = still upcoming, 0 = today, negative = already passed.
       */
      function daysUntilMoveInDate(iso) {
        const raw = String(iso || '').slice(0, 10);
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
        let target;
        if (m) {
          target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        } else {
          const parsed = new Date(iso);
          if (!Number.isFinite(parsed.getTime())) return null;
          target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.round((target.getTime() - today.getTime()) / 86400000);
      }

      function ruDayWord(count) {
        const n = Math.abs(count) % 100;
        const d = n % 10;
        if (n > 10 && n < 20) return 'дней';
        if (d === 1) return 'день';
        if (d >= 2 && d <= 4) return 'дня';
        return 'дней';
      }

      function moveInCountdownValue(days, lang) {
        if (days === 0) return UyDosh.t('detail.moveInToday', lang);
        if (days < 0) return UyDosh.t('detail.moveInPast', lang);
        if (days === 1) return UyDosh.t('detail.moveInOneDay', lang);
        if (lang === 'ru') return `${days} ${ruDayWord(days)}`;
        return UyDosh.t('detail.moveInDays', lang).replace('{count}', String(days));
      }

      /**
       * Move-in date + amenities, styled as extra rows inside the
       * description card (see `map-section-extra` / `map-section-static`)
       * so they sit directly under the listing description instead of
       * trailing after the location/metro card.
       */
      function buildMoveInExtraHtml(l, lang) {
        if (!l.move_in_date) return '';
        const days = daysUntilMoveInDate(l.move_in_date);
        const countdown = days == null
          ? ''
          : `
              <dt>${UyDosh.iconClock()}${UyDosh.escapeHtml(UyDosh.t('detail.moveInLeft', lang))}</dt>
              <dd>${UyDosh.escapeHtml(moveInCountdownValue(days, lang))}</dd>
            `;
        return `
          <div class="map-section-extra map-section-move-in-extra">
            <dl class="meta-grid">
              <dt>${UyDosh.iconCalendar()}${UyDosh.escapeHtml(UyDosh.t('detail.moveIn'))}</dt>
              <dd>${UyDosh.escapeHtml(UyDosh.formatDate(l.move_in_date, lang))}</dd>
              ${countdown}
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
       * plus a "draw route" button when that walk ("metro proximity") exists.
       * The button starts off. Opening the map draws the nearest station's
       * route and turns that button on (`drawNearestMetroStationRoute`).
       *
       * The straight-line km/min shown here is only the *initial* number,
       * good enough for the collapsed summary that's visible before any map
       * traffic is spent — `refineMetroStationWalkTimes` swaps it for a
       * real Yandex-routed figure once the map section actually opens. The
       * row carries `data-station-id` and the text its own
       * `.map-section-walk-text` span so that later patch can target it
       * directly without a full re-render.
       */
      function buildMetroStationRowHtml(station, lang, fallbackLine, refCoords, options = {}) {
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
        const lineColor = UyDosh.metroLineColor(line) || '';
        const routeOn = Boolean(options.routeOn);
        const routeBtn = walk && Number.isFinite(stationLat) && Number.isFinite(stationLon)
          ? `<span class="map-section-row-route-btn" data-station-route${stationIdAttr} data-lat="${stationLat}" data-lon="${stationLon}" data-color="${UyDosh.escapeHtml(lineColor)}" role="button" tabindex="0" aria-pressed="${routeOn ? 'true' : 'false'}" aria-label="${UyDosh.escapeHtml(UyDosh.t(routeOn ? 'detail.hideRouteToStation' : 'detail.showRouteToStation'))}"${routeOn && lineColor ? ` style="--route-btn-active-color:${UyDosh.escapeHtml(lineColor)}"` : ''}>${UyDosh.iconRoute()}</span>`
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
        const districts = [...UyDosh.listingSearchDistricts(l)].sort((a, b) =>
          UyDosh.localizedShort(a, lang).localeCompare(UyDosh.localizedShort(b, lang), lang));
        const locName = districts.length
          ? `${UyDosh.t('location.searchArea', lang)} · ${UyDosh.listingLocationLabel(l, lang, { summary: true })}`
          : UyDosh.localized(l.location, lang);
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
          <section class="map-section" data-map-section aria-expanded="false">
            <button type="button" class="map-section-toggle" data-map-toggle aria-expanded="false">
              <div class="map-section-summary">${rows.join('')}</div>
              <svg class="map-section-chevron" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6" /></svg>
            </button>
          <div class="map-section-body" hidden>
            ${districts.length ? `<div class="map-search-districts">${districts.map(d => `<span class="map-search-district" style="--district-color:${UyDosh.escapeHtml(UyDosh.districtColor(d.id))}">${UyDosh.escapeHtml(UyDosh.localizedShort(d, lang))}</span>`).join('')}</div>` : ''}
            <div class="map-container" id="listing-map" aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.map'))}"></div>
          </div>
        </section>
      `;
      }

      /**
       * Address and metro rows render immediately. The Yandex canvas script
       * loads on the first tap of this section or a metro route button.
       */
      function bindMapSection() {
        const section = rootEl.querySelector('[data-map-section]');
        if (!section || section.dataset.mapLazy) return;
        section.dataset.mapLazy = '1';
        section.addEventListener('click', onListingMapIntent);
      }

      async function onListingMapIntent(event) {
        const routeBtn = event.target.closest('[data-station-route]');
        const toggle = event.target.closest('[data-map-toggle]');
        if (!routeBtn && !toggle) return;
        event.preventDefault();
        event.stopPropagation();
        const section = rootEl.querySelector('[data-map-section]');
        section?.removeEventListener('click', onListingMapIntent);
        try {
          await UyDosh.loadClassicScript('listing-detail-map-view.js');
          if (section) delete section.dataset.mapLazy;
          bindMapSection();
          // A route tap is handled by the view script, which opens the map
          // itself. Expanding first would draw the nearest route and the
          // replayed tap would then toggle that route back off.
          if (routeBtn) routeBtn.click();
          else await expandMapSection();
        } catch (err) {
          console.error('Failed to load listing map', err);
          if (section) section.addEventListener('click', onListingMapIntent);
        }
      }
