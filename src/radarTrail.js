export const TRAIL_MINUTES = 4;
const TRAIL_DURATION_MS = TRAIL_MINUTES * 60_000;
const MAX_GAP_MS = 25_000;
const MAX_POINTS = 60;

export function updateRadarTrails(trails, aircrafts, now) {
  const cutoff = now - TRAIL_DURATION_MS;
  for (const [hex, trail] of trails) {
    trail.points = trail.points.filter(point => point.time >= cutoff);
    if (trail.points.length === 0) trails.delete(hex);
  }

  for (const ac of aircrafts) {
    const previous = trails.get(ac.hex);
    if (previous && previous.callsign !== ac.callsign) trails.delete(ac.hex);
    if (!Number.isFinite(ac.positionAge) || ac.positionAge < 0 || ac.positionAge > 15) continue;

    const time = now - ac.positionAge * 1000;
    const points = trails.get(ac.hex)?.points ?? [];
    const last = points.at(-1);
    if (last && (time <= last.time || (ac.lat === last.lat && ac.lon === last.lon))) continue;
    trails.set(ac.hex, {
      callsign: ac.callsign,
      points: [...points, { time, lat: ac.lat, lon: ac.lon, altFeet: ac.altFeet }].slice(-MAX_POINTS)
    });
  }
}

export function trailSegments(trail, now) {
  const segments = [];
  let lastTime = -Infinity;
  for (const point of trail?.points ?? []) {
    if (point.time < now - TRAIL_DURATION_MS) continue;
    if (point.time - lastTime > MAX_GAP_MS) segments.push([]);
    segments.at(-1).push(point);
    lastTime = point.time;
  }
  return segments.filter(segment => segment.length >= 2);
}
