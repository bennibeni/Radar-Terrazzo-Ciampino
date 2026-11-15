const DAY_MS = 86_400_000;
const RADIANS_PER_DEGREE = Math.PI / 180;
const CIVIL_TWILIGHT_END = -6;
const SUMMER_REFERENCE_ELEVATION = 72;
const MIN_PHOTO_OPACITY = 0.2;

// NOAA General Solar Position Calculations, with all times expressed in UTC.
// https://www.gml.noaa.gov/grad/solcalc/solareqns.PDF
export function naturalLightIndex(timestamp, latitude, longitude) {
  const year = new Date(timestamp).getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const daysInYear = (Date.UTC(year + 1, 0, 1) - yearStart) / DAY_MS;
  const elapsedDays = (timestamp - yearStart) / DAY_MS;
  const angle = 2 * Math.PI / daysInYear * (elapsedDays - 0.5);
  const equationOfTime = 229.18 * (0.000075 + 0.001868 * Math.cos(angle) - 0.032077 * Math.sin(angle)
    - 0.014615 * Math.cos(2 * angle) - 0.040849 * Math.sin(2 * angle));
  const declination = 0.006918 - 0.399912 * Math.cos(angle) + 0.070257 * Math.sin(angle)
    - 0.006758 * Math.cos(2 * angle) + 0.000907 * Math.sin(2 * angle)
    - 0.002697 * Math.cos(3 * angle) + 0.00148 * Math.sin(3 * angle);
  const utcMinutes = (elapsedDays % 1) * 1440;
  const hourAngle = ((utcMinutes + equationOfTime + 4 * longitude) / 4 - 180) * RADIANS_PER_DEGREE;
  const latitudeRadians = latitude * RADIANS_PER_DEGREE;
  const sineOfElevation = Math.sin(latitudeRadians) * Math.sin(declination)
    + Math.cos(latitudeRadians) * Math.cos(declination) * Math.cos(hourAngle);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sineOfElevation))) / RADIANS_PER_DEGREE;
  const fraction = (elevation - CIVIL_TWILIGHT_END) / (SUMMER_REFERENCE_ELEVATION - CIVIL_TWILIGHT_END);
  return Math.round(100 * Math.max(0, Math.min(1, fraction)));
}

export function panoramaOpacity(lightIndex) {
  return MIN_PHOTO_OPACITY + (1 - MIN_PHOTO_OPACITY) * lightIndex / 100;
}

export function sunsetPhase(timestamp, sunsetTimestamp) {
  if (!Number.isFinite(timestamp) || !Number.isFinite(sunsetTimestamp)) return undefined;
  const minutes = (timestamp - sunsetTimestamp) / 60_000;
  if (minutes < -45 || minutes >= 20) return undefined;
  if (minutes < -20) return 'gold';
  if (minutes < 0) return 'amber';
  if (minutes < 10) return 'rose';
  return 'violet';
}
