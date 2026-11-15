import { getDistanceKm, RADAR_KM } from './telemetry.js';
import { TRAIL_MINUTES } from './radarTrail.js';

export const FCO_QUERY_RADIUS_NM = 22;
export const FCO_COVERAGE_KM = FCO_QUERY_RADIUS_NM * 1.852;
export const FCO_RETENTION_MS = TRAIL_MINUTES * 60_000;
// AIP Italia, AD 2 LIRF §2: punto di riferimento aeroportuale.
export const FCO_LAT = 41 + 48 / 60 + 1 / 3600;
export const FCO_LON = 12 + 14 / 60 + 20 / 3600;

export function updateOutsideFlights(tracked, aircrafts, now, rawSamples = []) {
  for (const [hex, flight] of tracked) {
    if (now - flight.observedAt >= FCO_RETENTION_MS) tracked.delete(hex);
  }

  const arrived = new Set(rawSamples.filter(ac => tracked.has(ac.hex) && ac.alt_baro === 'ground'
    && Number.isFinite(ac.seen_pos) && ac.seen_pos >= 0 && ac.seen_pos <= 15
    && now - ac.seen_pos * 1000 >= tracked.get(ac.hex).observedAt
    && Number.isFinite(ac.lat) && Number.isFinite(ac.lon)
    && Math.abs(ac.lat) <= 90 && Math.abs(ac.lon) <= 180
    && getDistanceKm(FCO_LAT, FCO_LON, ac.lat, ac.lon) <= 5).map(ac => ac.hex));
  for (const hex of arrived) tracked.delete(hex);

  for (const ac of aircrafts) {
    if (arrived.has(ac.hex)) continue;
    let previous = tracked.get(ac.hex);
    if (previous && previous.aircraft.callsign !== ac.callsign) {
      tracked.delete(ac.hex);
      previous = undefined;
    }
    const beyondRadar = ac.distKm > RADAR_KM;
    const leftCone = previous?.aircraft.inCone && !ac.inCone;
    const following = Boolean(previous && (previous.following || beyondRadar || leftCone));
    if ((beyondRadar && !previous) || (following && (!Number.isFinite(ac.positionAge) || ac.positionAge > 15))) continue;
    const observedAt = now - (ac.positionAge ?? 0) * 1000;
    if (ac.positionAge < 0 || (previous && observedAt <= previous.observedAt)) continue;
    tracked.set(ac.hex, { aircraft: ac, observedAt, following, receivedAt: now });
  }

  return [...tracked.values()].filter(flight => flight.following);
}

export function hasFcoDestination(route) {
  return !route?.unavailable && ['FCO', 'LIRF'].includes(route?.destIata);
}
