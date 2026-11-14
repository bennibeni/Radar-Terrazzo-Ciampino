// Approximate angular scale: calibration is manual, not a camera model.
export function readPhotoCalibration() {
  try {
    const saved = JSON.parse(localStorage.getItem('panoramaCalibration'));
    if (saved && Number.isFinite(saved.horizon) && saved.horizon >= 0 && saved.horizon <= 100 && Number.isFinite(saved.verticalSpan) && saved.verticalSpan >= 10 && saved.verticalSpan <= 120) return saved;
  } catch {}
  return { horizon: 67, verticalSpan: 55 };
}
export function projectAircraftToPhoto(aircrafts, calibration) {
  return aircrafts.filter(ac => ac.positionAge !== null).flatMap(ac => {
    const point = projectToPhoto(ac.bearing, ac.elevationDeg, calibration.horizon, calibration.verticalSpan);
    return point ? [{ ...ac, ...point }] : [];
  });
}
export function projectToPhoto(bearing, elevation, horizon, verticalSpan) {
  if (![bearing, elevation, horizon, verticalSpan].every(Number.isFinite) || verticalSpan <= 0) return null;
  if (bearing < 270 || bearing > 292 || elevation < 0) return null;
  const x = (bearing - 270) / 22 * 100;
  const y = horizon - elevation / verticalSpan * 100;
  return y < 0 || y > 100 ? null : { x, y };
}

export function outsidePhotoDirection(bearing, elevation, horizon, verticalSpan) {
  if (![bearing, elevation, horizon, verticalSpan].every(Number.isFinite) || verticalSpan <= 0) return null;
  const offset = ((bearing - 281 + 540) % 360) - 180;
  const reasons = [];
  if (offset > 11) reasons.push(`→ ${Math.round(offset - 11)}° a destra della foto`);
  if (offset < -11) reasons.push(`← ${Math.round(-11 - offset)}° a sinistra della foto`);
  const top = horizon / 100 * verticalSpan;
  const bottom = (horizon - 100) / 100 * verticalSpan;
  if (elevation > top) reasons.push(`↑ ${Math.round(elevation - top)}° sopra la foto`);
  if (elevation < bottom) reasons.push(`↓ ${Math.round(bottom - elevation)}° sotto la foto`);
  else if (elevation < 0) reasons.push('↓ Sotto l’orizzonte');
  return reasons.length ? reasons.join(' · ') : null;
}

export function outsideAircraftToPhoto(aircrafts, calibration) {
  return aircrafts.filter(ac => ac.inCone && ac.positionAge !== null).flatMap(ac => {
    const direction = outsidePhotoDirection(ac.bearing, ac.elevationDeg, calibration.horizon, calibration.verticalSpan);
    return direction ? [{ ...ac, direction }] : [];
  });
}
