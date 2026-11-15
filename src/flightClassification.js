import { getDistanceKm } from './telemetry.js';

export const CIA_LAT = 41.7994;
export const CIA_LON = 12.5949;
export const isCiampinoAirport = code => code === 'CIA' || code === 'LIRA';

export const TRACE_CRITERIA = [
  ['Atterraggio probabile a Ciampino', 'Scende a bassa quota, si allinea al prolungamento della pista e si avvicina alla soglia.'],
  ['Decollo probabile da Ciampino', 'Parte a bassa quota vicino alla pista e si allontana in salita. Cerca il tratto iniziale prima della virata.'],
  ['Transito probabile', 'La rotta indica altri aeroporti e la quota osservata è compatibile con un passaggio nella zona.'],
  ['Indeterminato', 'La traccia inizia dopo una virata, si interrompe troppo presto o ha dati insufficienti.']
];

export function runwayObservation(ac) {
  if (![ac.lat, ac.lon, ac.track, ac.altFeet, ac.vRateMs, ac.positionAge].every(Number.isFinite)
    || ac.positionAge < 0 || ac.positionAge > 15 || ac.altFeet > 3500) return null;

  // Asse geografico approssimato per il radar. Le sigle 15/33 sono magnetiche.
  const axis = 153 * Math.PI / 180;
  const north = (ac.lat - CIA_LAT) * 111.2;
  const east = (ac.lon - CIA_LON) * 111.2 * Math.cos(CIA_LAT * Math.PI / 180);
  const along = north * Math.cos(axis) + east * Math.sin(axis);
  const across = east * Math.cos(axis) - north * Math.sin(axis);
  if (Math.abs(across) > 0.65 || Math.abs(along) > 9) return null;

  const delta = Math.abs(((ac.track - 153 + 540) % 360) - 180);
  const runway = delta <= 18 ? '15' : delta >= 162 ? '33' : null;
  if (!runway) return null;
  const distanceAlongTrack = runway === '15' ? along : -along;
  if (ac.vRateMs <= -1.8 && distanceAlongTrack < -0.5) return { kind: 'arrival', runway };
  if (ac.vRateMs >= 2 && distanceAlongTrack >= -0.5 && distanceAlongTrack <= 5) return { kind: 'departure', runway };
  return null;
}

export function observedCiampinoMovement(ac, segments) {
  const evidence = ac.runwayEvidence;
  if (!evidence?.confirmed) return null;
  const points = segments.find(segment => segment[0].time <= evidence.time && segment.at(-1).time >= evidence.time);
  if (!points) return null;

  const nearby = points.filter(point => Math.abs(point.time - evidence.time) <= 25_000 && Number.isFinite(point.altFeet));
  if (nearby.length < 3) return null;
  const first = nearby[0];
  const last = nearby.at(-1);
  const sign = evidence.kind === 'departure' ? 1 : -1;
  const firstDistance = getDistanceKm(CIA_LAT, CIA_LON, first.lat, first.lon);
  const lastDistance = getDistanceKm(CIA_LAT, CIA_LON, last.lat, last.lon);
  if (sign * (last.altFeet - first.altFeet) < 150 || sign * (lastDistance - firstDistance) < 0.4) return null;
  return evidence;
}

export function ciampinoMovementLabel(movement, route) {
  const departure = movement.kind === 'departure';
  const label = departure ? TRACE_CRITERIA[1][0] : TRACE_CRITERIA[0][0];
  const code = departure ? route?.destIata : route?.originIata;
  const missingEndpoint = departure ? 'Destinazione da verificare' : 'Provenienza da verificare';
  return `${label} · Pista ${movement.runway}${/^[A-Z]{3,4}$/.test(code ?? '') ? '' : ` · ${missingEndpoint}`}`;
}

export function classifyFlight(ac, route) {
  if (ac.observedMovement) return ciampinoMovementLabel(ac.observedMovement, route);
  const knownAirport = code => /^[A-Z]{3,4}$/.test(code ?? '');
  const current = runwayObservation(ac);
  const repeated = ac.runwayEvidence?.confirmed ? ac.runwayEvidence : null;
  const evidence = current ?? ac.runwayEvidence;
  if (evidence) {
    const airport = evidence.kind === 'arrival' ? route?.destIata : route?.originIata;
    const confirmed = repeated?.kind === evidence.kind && repeated.runway === evidence.runway;
    if (isCiampinoAirport(airport) || (confirmed && !knownAirport(airport))) {
      return `${TRACE_CRITERIA[evidence.kind === 'arrival' ? 0 : 1][0]} · Pista ${evidence.runway}`;
    }
    return TRACE_CRITERIA[3][0];
  }

  if (ac.positionAge !== null && ac.altFeet >= 4500 &&
    [route?.originIata, route?.destIata].every(code => knownAirport(code) && !isCiampinoAirport(code))) {
    return TRACE_CRITERIA[2][0];
  }
  return TRACE_CRITERIA[3][0];
}

