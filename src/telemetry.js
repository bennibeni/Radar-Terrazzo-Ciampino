export const RADAR_KM = 18;
export const MAX_POSITION_AGE = 60;

export function getDistanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function isRouteGeographicallyDoubtful(aircraft, route) {
  if (!route || route.unavailable) return false;
  const stops = route.midpoint ? [route.origin, route.midpoint, route.destination] : [route.origin, route.destination];
  if (![aircraft, ...stops].every(point => Number.isFinite(point?.lat) && Number.isFinite(point?.lon)
    && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180)) return false;

  const distance = (from, to) => getDistanceKm(from.lat, from.lon, to.lat, to.lon);
  if (stops.some(stop => distance(stop, aircraft) <= 250)) return false;

  // Require a large detour on every published leg before flagging a route.
  return stops.slice(1).every((to, index) => {
    const from = stops[index];
    const direct = distance(from, to);
    const viaAircraft = distance(from, aircraft) + distance(aircraft, to);
    return viaAircraft - direct > Math.max(500, direct * 0.5);
  });
}

export function routeDoubtReason(aircraft, route, segments, movement) {
  if (!route || route.unavailable) return null;
  if (movement && !route.midpoint) {
    const departure = movement.kind === 'departure';
    const endpoint = departure ? route.originIata : route.destIata;
    if (/^[A-Z]{3,4}$/.test(endpoint ?? '') && endpoint !== 'CIA' && endpoint !== 'LIRA') {
      return departure
        ? 'Più rilevazioni indicano una partenza probabile da Ciampino, uno scalo diverso da quello indicato.'
        : 'Più rilevazioni indicano un atterraggio probabile a Ciampino, uno scalo diverso da quello indicato.';
    }
  }
  if (isRouteGeographicallyDoubtful(aircraft, route)) {
    return 'La posizione rilevata richiederebbe una deviazione molto ampia rispetto alla rotta indicata.';
  }
  const { origin, destination, midpoint } = route;
  const segment = segments.at(-1) ?? [];
  const recent = segment.filter(point => point.time >= segment.at(-1).time - 60_000);
  if (midpoint || recent.length < 3 || ![origin, destination].every(point =>
    Number.isFinite(point?.lat) && Number.isFinite(point?.lon))) return null;

  const first = recent[0];
  const last = recent.at(-1);
  if (last.time - first.time < 20_000) return null;
  const distance = (from, to) => getDistanceKm(from.lat, from.lon, to.lat, to.lon);
  if (distance(last, aircraft) > 2) return null;
  const direct = distance(origin, destination);
  const fromOrigin = distance(origin, last);
  const toDestination = distance(last, destination);
  if (Math.min(fromOrigin, toDestination) < 100 || fromOrigin + toDestination - direct < Math.max(250, direct * 0.2)) return null;

  const destinationDistances = recent.map(point => distance(point, destination));
  const movingAway = destinationDistances.at(-1) - destinationDistances[0] >= 3
    && destinationDistances.every((km, index) => index === 0 || km >= destinationDistances[index - 1] - 0.25);
  return movingAway ? 'La scia si allontana dalla destinazione indicata e si trova già su una deviazione ampia.' : null;
}
export function isBearingInCone(bearing, start, end) {
  if (![bearing, start, end].every(Number.isFinite)) return false;
  const normalize = (angle) => ((angle % 360) + 360) % 360;
  return normalize(bearing - start) <= normalize(end - start);
}
export function elevationAngle(altitude, distance, observerAltitude) {
  if (!Number.isFinite(altitude) || !Number.isFinite(distance) || distance < 0) return null;
  return Math.round(Math.atan2(altitude - observerAltitude, distance * 1000) * 180 / Math.PI);
}
export function readTelemetry(ac) {
  const number = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const ground = ac.alt_baro === 'ground';
  const altFeet = number(ac.alt_baro);
  const geometricFeet = number(ac.alt_geom);
  const rate = number(ac.baro_rate);
  let phase = ground ? 'A terra (dato ricevuto)' : 'Fase di volo non determinabile';
  if (!ground && altFeet !== null && rate !== null) {
    phase = rate < -350 ? 'In discesa (stima)' : rate > 400 ? 'In salita (stima)' : 'Quota stabile (stima)';
  }
  return {
    altFeet,
    altMeters: altFeet === null ? null : Math.round(altFeet * 0.3048),
    geometricMeters: geometricFeet === null ? null : geometricFeet * 0.3048,
    speedKmh: number(ac.gs) === null ? null : Math.round(ac.gs * 1.852),
    vRateMs: rate === null ? null : +(rate * 0.00508).toFixed(1),
    track: number(ac.track),
    positionAge: number(ac.seen_pos),
    ground,
    phase
  };
}
