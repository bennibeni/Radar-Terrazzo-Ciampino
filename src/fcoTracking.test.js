import test from 'node:test';
import assert from 'node:assert/strict';
import { FCO_LAT, FCO_LON, FCO_RETENTION_MS, hasFcoDestination, updateOutsideFlights } from './fcoTracking.js';

test('tracks only an already observed flight after it exits the local radar', () => {
  const tracked = new Map();
  const local = { hex: '4c0001', callsign: 'RYR1', distKm: 17, positionAge: 1 };
  const outside = { ...local, distKm: 20 };

  assert.deepEqual(updateOutsideFlights(tracked, [outside], 10_000), []);
  assert.deepEqual(updateOutsideFlights(tracked, [local], 15_000), []);
  assert.deepEqual(updateOutsideFlights(tracked, [{ ...outside, positionAge: null }], 20_000), []);
  const [flight] = updateOutsideFlights(tracked, [outside], 25_000);
  assert.equal(flight.aircraft, outside);
  assert.equal(flight.observedAt, 24_000);
  assert.deepEqual(updateOutsideFlights(tracked, [], 30_000), [flight]);
  assert.deepEqual(updateOutsideFlights(tracked, [], 24_000 + FCO_RETENTION_MS), []);
});

test('keeps following a returning aircraft and stops when its flight identity changes', () => {
  const tracked = new Map();
  const local = { hex: '4c0001', callsign: 'RYR1', distKm: 17, positionAge: 0 };
  const outside = { ...local, distKm: 20 };

  updateOutsideFlights(tracked, [local], 10_000);
  assert.equal(updateOutsideFlights(tracked, [outside], 20_000).length, 1);
  assert.equal(updateOutsideFlights(tracked, [local], 30_000).length, 1);
  assert.equal(updateOutsideFlights(tracked, [outside], 40_000).length, 1);
  assert.deepEqual(updateOutsideFlights(tracked, [{ ...outside, callsign: 'RYR2' }], 50_000), []);
});

test('starts following an aircraft that leaves the cone and stops upon a fresh ground report at Fiumicino', () => {
  const tracked = new Map();
  const inCone = { hex: '4c0001', callsign: 'RYR1', distKm: 10, positionAge: 0, inCone: true };
  const ground = { hex: inCone.hex, lat: FCO_LAT, lon: FCO_LON, alt_baro: 'ground', seen_pos: 0 };

  assert.deepEqual(updateOutsideFlights(tracked, [inCone], 10_000), []);
  assert.equal(updateOutsideFlights(tracked, [{ ...inCone, inCone: false }], 20_000).length, 1);
  assert.equal(updateOutsideFlights(tracked, [], 25_000, [{ ...ground, seen_pos: 12 }]).length, 1);
  assert.deepEqual(updateOutsideFlights(tracked, [], 30_000, [ground]), []);
});

test('recognizes only usable Fiumicino destinations', () => {
  assert.equal(hasFcoDestination({ destIata: 'FCO' }), true);
  assert.equal(hasFcoDestination({ destIata: 'LIRF' }), true);
  assert.equal(hasFcoDestination({ destIata: 'CIA' }), false);
  assert.equal(hasFcoDestination({ destIata: 'FCO', unavailable: true }), false);
});
