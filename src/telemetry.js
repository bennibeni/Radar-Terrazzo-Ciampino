export const RADAR_KM = 18;
export const MAX_POSITION_AGE = 60;
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
