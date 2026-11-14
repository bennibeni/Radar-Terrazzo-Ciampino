import test from 'node:test';
import assert from 'node:assert/strict';
import { fittedImageSize, archiveContentBytes, formatStorageBytes } from './archiveImages.js';
test('image resizing respects orientation, aspect ratio and never enlarges originals', () => {
  assert.deepEqual(fittedImageSize(4000, 3000), { width: 1280, height: 960 });
  assert.deepEqual(fittedImageSize(3000, 4000), { width: 960, height: 1280 });
  assert.deepEqual(fittedImageSize(300, 200), { width: 300, height: 200 });
  assert.throws(() => fittedImageSize(0, 200));
});
test('archive content measurement includes image data and handles unavailable quotas', () => {
  assert.ok(archiveContentBytes([{ images: [{ data: 'a'.repeat(1000) }] }]) > archiveContentBytes([]));
  assert.equal(formatStorageBytes(undefined), 'Non disponibile');
  assert.equal(formatStorageBytes(1024 ** 2), '1.0 MB');
});
