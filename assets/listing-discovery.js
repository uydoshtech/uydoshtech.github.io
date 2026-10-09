// Shared search links, price ranges, and group budget calculations.
(function () {
  const positiveId = value => {
    const n = Number(value);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  };
  function typeCode(listing) {
    return listing?.listing_type?.code || listing?.listing_type_code || '';
  }
  function bounds(listing) {
    const min = Number(listing?.min_price), max = Number(listing?.max_price);
    if (min > 0 && Number.isFinite(max) && max >= min) return { min, max };
    const price = Number(listing?.price);
    // Do not invent a budget when a listing has no price.
    return Number.isFinite(price) && price > 0 ? { min: price, max: price } : null;
  }
  function similarFilters(listing) {
    const filters = {};
    const type = positiveId(listing.listing_type_id ?? listing.listing_type?.id);
    if (type) filters.listingTypeId = type;
    const station = positiveId(listing.subway_station_id ?? listing.subway_station?.id);
    const district = positiveId(listing.location_id ?? listing.location?.id);
    if (station) filters.subwayStationId = station;
    else if (district) filters.locationId = district;
    const price = bounds(listing);
    if (price) {
      // Mini-app listing prices use dollars. Widen by 20% without the native
      // client's legacy 100,000-unit floor, which would erase the price filter.
      filters.minPrice = Math.max(0, Math.floor(price.min * 0.8));
      filters.maxPrice = Math.ceil(price.max * 1.2);
    }
    return filters;
  }
  function searchUrl(listing, { group = null, housing = false } = {}) {
    const filters = similarFilters(listing);
    if (housing) {
      filters.listingTypeId = 2; // roommate_needed: the shared housing-offer type.
      delete filters.minPrice;
      delete filters.maxPrice;
      const gender = Number(listing.gender);
      if ([1, 2].includes(gender)) filters.gender = gender;
      const size = positiveId(listing.group_context?.group_size_target ?? listing.group_size_target);
      const price = bounds(listing);
      if (size && price) filters.maxPrice = price.max * size;
      const stations = [...new Set((listing.search_subway_stations || []).map(s => positiveId(s.id)).filter(Boolean))];
      const districts = [...new Set((listing.search_locations || []).map(d => positiveId(d.id)).filter(Boolean))];
      if (stations.length || districts.length) {
        delete filters.subwayStationId;
        delete filters.locationId;
        if (stations.length) filters.subwayStationIds = stations.join(',');
        else filters.locationIds = districts.join(',');
      }
    }
    if (listing.search_area) {
      for (const key of ['locationId', 'locationIds', 'subwayStationId', 'subwayStationIds', 'subwayLineId']) delete filters[key];
      filters.searchLatitude = listing.search_area.latitude;
      filters.searchLongitude = listing.search_area.longitude;
      filters.searchRadiusKm = listing.search_area.radiusKm;
    }
    const params = new URLSearchParams({ search: housing ? 'group' : 'similar', ...filters });
    if (!housing && positiveId(listing.id)) params.set('exclude', listing.id);
    if (positiveId(group)) params.set('group', group);
    const searchDistricts = listing.search_area || (housing && filters.locationIds);
    const area = listing.subway_station || listing.location;
    if (searchDistricts && window.UyDosh?.listingLocationLabel) {
      for (const lang of ['uz', 'ru', 'en']) params.set(`area_${lang}`, window.UyDosh.listingLocationLabel(listing, lang));
    }
    if (area && !searchDistricts) {
      for (const lang of ['uz', 'ru', 'en']) {
        if (area[`name_${lang}`]) params.set(`area_${lang}`, area[`name_${lang}`]);
      }
    }
    return `/telegram/?${params}`;
  }
  function readSearch(search) {
    const params = new URLSearchParams(search);
    if (!['similar', 'group'].includes(params.get('search'))) return null;
    const result = { mode: params.get('search'), group: positiveId(params.get('group')), exclude: positiveId(params.get('exclude')) };
    if (params.has('searchRadiusKm')) {
      const latitude = Number(params.get('searchLatitude')), longitude = Number(params.get('searchLongitude')), radiusKm = Number(params.get('searchRadiusKm'));
      if (params.has('searchLatitude') && params.has('searchLongitude') && [latitude, longitude, radiusKm].every(Number.isFinite) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && radiusKm >= 5 && radiusKm <= 10) result.searchArea = { latitude, longitude, radiusKm };
    }
    for (const key of ['listingTypeId', 'subwayStationId', 'locationId']) result[key] = positiveId(params.get(key));
    for (const key of ['locationIds', 'subwayStationIds']) result[key] = [...new Set((params.get(key) || '').split(',').map(positiveId).filter(Boolean))];
    for (const key of ['minPrice', 'maxPrice']) {
      const raw = params.get(key), n = Number(raw);
      result[key] = raw !== null && raw.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
    }
    if (result.minPrice != null && result.maxPrice != null && result.minPrice > result.maxPrice) {
      result.minPrice = result.maxPrice = null;
    }
    for (const key of ['gender', 'subwayLineId', 'createdWithinDays']) {
      const raw = params.get(key), n = Number(raw);
      result[key] = raw !== null && Number.isSafeInteger(n) && n >= 0 ? n : null;
    }
    for (const key of ['withPhoto', 'has3dTour']) result[key] = params.get(key) === 'true';
    result.priceSortOrder = ['asc', 'desc'].includes(params.get('priceSortOrder')) ? params.get('priceSortOrder') : null;
    result.area = Object.fromEntries(['uz', 'ru', 'en'].map(lang => [lang, params.get(`area_${lang}`) || '']));
    return result;
  }
  function budget(group, housing) {
    const size = positiveId(group?.group_context?.group_size_target ?? group?.group_size_target);
    const perPerson = bounds(group), rent = bounds(housing);
    if (!size || size < 2 || !perPerson || !rent) return null;
    const total = { min: perPerson.min * size, max: perPerson.max * size };
    // Use the upper rent bound, with no hidden tolerance, for an honest comparison.
    return { size, total, perPerson, share: { min: rent.min / size, max: rent.max / size },
      fit: rent.max <= total.max ? 'fits' : rent.min > total.max ? 'above' : 'partial' };
  }
  function canShortlist(group) {
    const ctx = group?.group_context;
    return Boolean(ctx?.is_group_forming && (ctx.is_member || ctx.is_owner)
      && ctx.group_forming_status !== 'closed' && Number(ctx.group_member_count) >= 2
      && (ctx.group_progress?.can_view_shortlist || ctx.group_progress?.available_actions?.includes('view_shortlist')));
  }
  window.UyDoshDiscovery = { positiveId, typeCode, bounds, similarFilters, searchUrl, readSearch, budget, canShortlist };
})();
