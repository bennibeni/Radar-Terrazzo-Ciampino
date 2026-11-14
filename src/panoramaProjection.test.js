import test from 'node:test';
import assert from 'node:assert/strict';
import { projectToPhoto, outsidePhotoDirection, outsideAircraftToPhoto } from './panoramaProjection.js';

test('outside indicators handle the right edge, north crossing and vertical limits', () => {
  assert.equal(outsidePhotoDirection(297, 10, 67, 55), '→ 5° a destra della foto');
  assert.equal(outsidePhotoDirection(10, 10, 67, 55), '→ 78° a destra della foto');
  assert.equal(outsidePhotoDirection(269, 10, 67, 55), '← 1° a sinistra della foto');
  assert.equal(outsidePhotoDirection(281, 47, 67, 55), '↑ 10° sopra la foto');
  assert.equal(outsidePhotoDirection(292, 10, 67, 55), null);
  assert.equal(outsidePhotoDirection(297, null, 67, 55), null);
});
test('outside indicators exclude aircraft outside the terrace cone or with unknown age', () => {
  const flight = { bearing: 297, elevationDeg: 10, positionAge: 18, inCone: true };
  const calibration = { horizon: 67, verticalSpan: 55 };
  assert.equal(outsideAircraftToPhoto([flight], calibration).length, 1);
  assert.equal(outsideAircraftToPhoto([{ ...flight, inCone: false }, { ...flight, positionAge: null }], calibration).length, 0);
});

test('photo bounds and central bearing map to the calibrated frame', () => {
  assert.deepEqual(projectToPhoto(270, 0, 67, 55), { x: 0, y: 67 });
  assert.deepEqual(projectToPhoto(281, 11, 67, 55), { x: 50, y: 47 });
  assert.deepEqual(projectToPhoto(292, 0, 67, 55), { x: 100, y: 67 });
});
test('outside, unknown and out-of-frame elevations never produce markers', () => {
  for (const [bearing, elevation] of [[349, 38], [269, 5], [293, 5], [281, null], [281, -1], [281, 80]]) {
    assert.equal(projectToPhoto(bearing, elevation, 67, 55), null);
  }
  assert.equal(projectToPhoto(281, 10, 67, 0), null);
});
test('calibration moves a marker vertically without changing its bearing', () => {
  assert.deepEqual(projectToPhoto(281, 11, 77, 55), { x: 50, y: 57 });
  assert.deepEqual(projectToPhoto(281, 11, 67, 110), { x: 50, y: 57 });
});
