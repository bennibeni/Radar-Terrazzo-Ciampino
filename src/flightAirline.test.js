import test from 'node:test';
import assert from 'node:assert/strict';
import { withFlightAirline } from './flightAirline.js';
test('known prefixes fill old records and normalize callsigns', () => {
  const result = withFlightAirline({ callsign: ' ryr4ty ' });
  assert.equal(result.airline, 'Ryanair');
  assert.equal(result.airlineSource, 'callsign');
  assert.equal(withFlightAirline({ callsign: 'WZZ238' }).airline, 'Wizz Air');
});
test('service data takes priority and inferred airlines follow a changed callsign', () => {
  assert.equal(withFlightAirline({ callsign: 'RYR4TY', airline: 'Actual airline' }).airline, 'Actual airline');
  assert.equal(withFlightAirline({ callsign: 'WZZ238', airline: 'Ryanair', airlineSource: 'callsign' }).airline, 'Wizz Air');
});
test('unknown, registration and hexadecimal callsigns do not invent companies', () => {
  for (const callsign of ['ZZZ123', 'EI-EVC', '4D21FA', 'RYR', null]) assert.equal(withFlightAirline({ callsign }).airline, null);
});
