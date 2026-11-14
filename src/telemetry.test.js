import test from 'node:test';
import assert from 'node:assert/strict';
import { readTelemetry, elevationAngle, isBearingInCone } from './telemetry.js';

test('terrace cone crosses north and includes both measured limits', () => {
  for (const bearing of [270, 281, 320, 359, 0, 10, 360]) {
    assert.equal(isBearingInCone(bearing, 270, 10), true, `${bearing} inside`);
  }
  for (const bearing of [11, 124, 195, 269]) {
    assert.equal(isBearingInCone(bearing, 270, 10), false, `${bearing} outside`);
  }
  assert.equal(isBearingInCone(250, 195, 305), true);
  assert.equal(isBearingInCone(0, 195, 305), false);
  assert.equal(isBearingInCone(null, 270, 10), false);
});

test('missing telemetry never becomes zero or ground', () => {
  const data = readTelemetry({});
  assert.equal(data.altFeet, null);
  assert.equal(data.speedKmh, null);
  assert.equal(data.track, null);
  assert.equal(data.ground, false);
  assert.equal(data.phase, 'Fase di volo non determinabile');
  assert.equal(elevationAngle(null, 1, 83), null);
});
test('explicit ground and valid zero measurements are preserved', () => {
  const data = readTelemetry({ alt_baro: 'ground', gs: 0, track: 0, baro_rate: 0 });
  assert.equal(data.ground, true);
  assert.equal(data.speedKmh, 0);
  assert.equal(data.track, 0);
  assert.equal(data.vRateMs, 0);
});
test('sixth-floor height changes elevation and negative angles remain visible', () => {
  assert.equal(elevationAngle(1083, 1, 65 + 18), 45);
  assert.ok(elevationAngle(65, 0.1, 65 + 18) < 0);
  assert.equal(elevationAngle(1083, 0, 83), 90);
});
test('descent alone does not imply landing', () => {
  assert.equal(readTelemetry({ alt_baro: 5000, baro_rate: -500 }).phase, 'In discesa (stima)');
  assert.equal(readTelemetry({ alt_baro: NaN, gs: Infinity }).altFeet, null);
});
