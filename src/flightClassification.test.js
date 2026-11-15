import test from 'node:test';
import assert from 'node:assert/strict';
import { observedCiampinoMovement, ciampinoMovementLabel } from './flightClassification.js';
import { routeDoubtReason } from './telemetry.js';

const runwayEvidence = { kind: 'departure', runway: '33', confirmed: true, time: 20_000 };
const departureTrack = [
  { lat: 41.801, lon: 12.594, time: 0, altFeet: 850 },
  { lat: 41.805, lon: 12.591, time: 10_000, altFeet: 1000 },
  { lat: 41.81, lon: 12.588, time: 20_000, altFeet: 1300 }
];

test('a climbing track corroborates an observed departure and flags a different origin', () => {
  const aircraft = { ...departureTrack.at(-1), runwayEvidence };
  const movement = observedCiampinoMovement(aircraft, [departureTrack]);
  assert.equal(movement, runwayEvidence);
  assert.match(ciampinoMovementLabel(movement, null), /Pista 33 · Destinazione da verificare/);
  assert.match(routeDoubtReason(aircraft, { originIata: 'STN' }, [departureTrack], movement), /partenza probabile da Ciampino/);
  assert.equal(routeDoubtReason(aircraft, { originIata: 'CIA' }, [departureTrack], movement), null);
  assert.equal(observedCiampinoMovement(aircraft, [departureTrack.slice(1)]), null);
  assert.equal(observedCiampinoMovement(aircraft, [departureTrack.map(point => ({ ...point, altFeet: 850 }))]), null);
});

test('a persistent divergence flags a large detour without treating travel toward the airport as a contradiction', () => {
  const route = { origin: { lat: 51.885, lon: 0.235 }, destination: { lat: 44.0203, lon: 12.6117 } };
  const southbound = [41.84, 41.82, 41.8].map((lat, index) => ({ lat, lon: 12.55, time: index * 12_000 }));
  const northbound = southbound.map((point, index) => ({ ...point, lat: southbound[2 - index].lat }));
  assert.match(routeDoubtReason(southbound.at(-1), route, [southbound], null), /si allontana/);
  assert.equal(routeDoubtReason(northbound.at(-1), route, [northbound], null), null);
  assert.equal(routeDoubtReason(southbound.at(-1), route, [southbound.slice(1)], null), null);
});
