import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeObservation, validateBackup, imageWebUrl } from './aircraftArchive.js';
const ac = { hex: '4CA225', registration: 'EI-DCK', aircraftType: 'B738', callsign: 'RYR64DF' };
test('flight airline survives polls and backups but is not carried to another callsign', () => {
  const first = mergeObservation(null, { ...ac, airline: 'Ryanair' }, 1000);
  assert.equal(mergeObservation(first, ac, 2000).airline, 'Ryanair');
  assert.equal(mergeObservation(first, { ...ac, callsign: 'AEZ123' }, 2000).airline, 'Aeroitalia');
  assert.equal(validateBackup({ version: 1, aircraft: [first] })[0].airline, 'Ryanair');
  const legacy = { ...first }; delete legacy.airline;
  assert.equal(validateBackup({ version: 1, aircraft: [legacy] })[0].airline, null);
});
test('web image links survive backup and reject unsafe protocols and credentials', () => {
  assert.equal(imageWebUrl(' https://example.com/plane.jpg '), 'https://example.com/plane.jpg');
  assert.throws(() => imageWebUrl('javascript:alert(1)'));
  assert.throws(() => imageWebUrl('https://user:password@example.com/plane.jpg'));
  const record = mergeObservation(null, ac, 1000);
  record.images = [{ id: 'web', name: 'Foto', data: 'https://example.com/plane.jpg' }];
  assert.equal(validateBackup({ version: 1, aircraft: [record] })[0].images[0].data, record.images[0].data);
});
test('polls preserve images and notes and count a visit only after a ten minute absence', () => {
  const first = mergeObservation(null, ac, 1000);
  assert.equal(first.sightings, 1);
  const next = mergeObservation({ ...first, notes: 'Visto', images: [{ id: 'photo' }] }, ac, 6000);
  assert.equal(next.sightings, 1);
  assert.equal(next.firstSeen, 1000);
  assert.equal(next.notes, 'Visto');
  assert.equal(next.images.length, 1);
  assert.equal(mergeObservation(next, ac, 607000).sightings, 2);
  assert.equal(mergeObservation(next, { ...ac, registration: 'N/D' }, 7000).registration, 'EI-DCK');
});
test('backup validates records and rejects unsafe image types before any writes', () => {
  const record = mergeObservation(null, ac, 1000);
  assert.equal(validateBackup({ version: 1, aircraft: [record] })[0].hex, '4ca225');
  assert.throws(() => validateBackup({ version: 2, aircraft: [] }));
  assert.throws(() => validateBackup({ version: 1, aircraft: [record, record] }));
  assert.throws(() => validateBackup({ version: 1, aircraft: [{ ...record, images: [{ data: 'data:image/svg+xml;base64,abcd' }] }] }));
});
