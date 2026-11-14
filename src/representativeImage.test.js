import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAircraftImage } from './representativeImage.js';
const donor = { hex: 'abc', registration: 'EI-ABC', model: 'B738', airline: 'Ryanair', images: [{ data: 'photo' }] };
const flight = { hex: 'def', aircraftType: 'B738', airline: 'Ryanair' };
test('specific images take priority over automatic representatives', () => {
  const own = { ...donor, hex: 'def', registration: 'EI-DEF', images: [{ data: 'specific' }] };
  assert.equal(resolveAircraftImage(flight, [donor, own]).image.data, 'specific');
  assert.equal(resolveAircraftImage(flight, [donor, own]).representative, false);
});
test('representatives require matching model and known airline and share the original image', () => {
  const resolved = resolveAircraftImage(flight, [donor]);
  assert.equal(resolved.representative, true);
  assert.equal(resolved.image, donor.images[0]);
  assert.equal(resolveAircraftImage({ ...flight, airline: null }, [donor]), null);
  assert.equal(resolveAircraftImage({ ...flight, airline: 'LOT' }, [donor]), null);
  assert.equal(resolveAircraftImage({ ...flight, aircraftType: 'A20N' }, [donor]), null);
  assert.equal(resolveAircraftImage(flight, []), null);
});
