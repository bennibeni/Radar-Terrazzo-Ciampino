import { withFlightAirline } from './flightAirline.js';
import { optimizeImage } from './archiveImages.js';
import { ARCHIVE_IMAGE_CLEANUP } from './archiveImageCleanup.js';
let database;
function openDB() {
  if (!database) database = new Promise((resolve, reject) => {
    const req = indexedDB.open('terrace-aircraft-archive', 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('aircraft')) req.result.createObjectStore('aircraft', { keyPath: 'hex' });
      if (!req.result.objectStoreNames.contains('maintenance')) req.result.createObjectStore('maintenance');
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); database = null; };
      const tx = db.transaction(['aircraft', 'maintenance'], 'readwrite');
      const maintenance = tx.objectStore('maintenance');
      const marker = maintenance.get('representative-image-cleanup-2026-11-14');
      marker.onsuccess = () => {
        if (marker.result) return;
        const store = tx.objectStore('aircraft');
        for (const removal of ARCHIVE_IMAGE_CLEANUP) {
          const row = store.get(removal.hex);
          row.onsuccess = () => {
            if (row.result) store.put({ ...row.result, images: row.result.images.filter(image => !removal.images.includes(image.data)) });
          };
        }
        maintenance.put(true, 'representative-image-cleanup-2026-11-14');
      };
      tx.oncomplete = () => resolve(db);
      tx.onerror = tx.onabort = () => { database = null; db.close(); reject(tx.error); };
    };
    req.onerror = () => { database = null; reject(req.error); };
  });
  return database;
}
export async function listAircraft() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('aircraft').objectStore('aircraft').getAll();
    req.onsuccess = () => resolve(req.result.map(withFlightAirline));
    req.onerror = () => reject(req.error);
  });
}
async function mutate(hex, update, notify = true) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('aircraft', 'readwrite');
    const store = tx.objectStore('aircraft');
    const req = store.get(hex);
    req.onsuccess = () => {
      try { const next = update(req.result); if (next) store.put(next); }
      catch (error) { tx.abort(); reject(error); }
    };
    tx.oncomplete = () => { if (notify) window.dispatchEvent(new Event('aircraft-archive-updated')); resolve(); };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Salvataggio annullato'));
  });
}
export function mergeObservation(previous, ac, now) {
  const newVisit = !previous || now - previous.lastSeen > 10 * 60 * 1000;
  return withFlightAirline({ ...previous, hex: ac.hex.toLowerCase(),
    registration: ac.registration && ac.registration !== 'N/D' ? ac.registration : previous?.registration || 'N/D',
    model: ac.aircraftType && ac.aircraftType !== 'N/D' ? ac.aircraftType : previous?.model || 'N/D',
    callsign: ac.callsign, firstSeen: previous?.firstSeen ?? now, lastSeen: now,
    airline: ac.airline || (previous?.callsign === ac.callsign ? previous?.airline : null) || null,
    airlineSource: ac.airline ? ac.airlineSource || 'adsbdb' : previous?.callsign === ac.callsign ? previous?.airlineSource : null,
    sightings: (previous?.sightings || 0) + (newVisit ? 1 : 0),
    notes: previous?.notes || '', images: previous?.images || [] });
}
export async function recordAircraft(aircrafts, now = Date.now()) {
  for (const ac of aircrafts) await mutate(ac.hex.toLowerCase(), previous => mergeObservation(previous, ac, now), false);
  if (aircrafts.length) window.dispatchEvent(new Event('aircraft-archive-updated'));
}
export async function updateAircraft(hex, changes) {
  return mutate(hex, previous => previous ? { ...previous, ...changes, hex } : null);
}
export async function addAircraftImages(hex, images) {
  return mutate(hex, previous => previous ? { ...previous, images: [...previous.images, ...images] } : null);
}
export async function saveArchiveAirlines(details) {
  const rows = await listAircraft();
  let changed = false;
  for (const row of rows) {
    const airline = details[row.callsign]?.airline;
    if (airline && airline !== 'Compagnia non disponibile' && (row.airline !== airline || row.airlineSource !== 'adsbdb')) {
      await mutate(row.hex, current => current?.callsign === row.callsign ? { ...current, airline, airlineSource: 'adsbdb' } : null, false);
      changed = true;
    }
  }
  if (changed) window.dispatchEvent(new Event('aircraft-archive-updated'));
}
export async function readImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Usa immagini JPG, PNG, WebP o GIF.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Ogni immagine può pesare al massimo 8 MB.');
  return { id: crypto.randomUUID(), name: file.name, data: await optimizeImage(file) };
}
export function imageWebUrl(value) {
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Inserisci un link web completo.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Usa un link HTTP o HTTPS senza credenziali.');
  return url.href;
}
export function validateBackup(data) {
  if (data?.version !== 1 || !Array.isArray(data.aircraft)) throw new Error('Backup non valido.');
  const ids = new Set();
  return data.aircraft.map(row => {
    if (!/^[a-f0-9~]{1,16}$/i.test(row?.hex) || typeof row.registration !== 'string' || typeof row.model !== 'string' || !Number.isFinite(row.firstSeen) || !Number.isFinite(row.lastSeen) || row.firstSeen > row.lastSeen || !Number.isInteger(row.sightings) || row.sightings < 1 || !Array.isArray(row.images)) throw new Error('Scheda nel backup non valida.');
    const hex = row.hex.toLowerCase();
    if (ids.has(hex)) throw new Error('Aeromobile duplicato nel backup.');
    ids.add(hex);
    return { hex, registration: row.registration, model: row.model, callsign: String(row.callsign || ''), airline: typeof row.airline === 'string' ? row.airline : null, airlineSource: row.airlineSource === 'callsign' ? 'callsign' : row.airline ? 'adsbdb' : null, firstSeen: row.firstSeen, lastSeen: row.lastSeen, sightings: row.sightings, notes: String(row.notes || ''), images: row.images.map(img => {
      if (typeof img.data !== 'string') throw new Error('Immagine nel backup non valida.');
      if (/^https?:\/\//i.test(img.data)) imageWebUrl(img.data);
      else if (!/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(img.data) || img.data.length > 12 * 1024 * 1024) throw new Error('Immagine nel backup non valida.');
      return { id: String(img.id || crypto.randomUUID()), name: String(img.name || 'Immagine'), data: img.data };
    }) };
  });
}
export async function importBackup(data) {
  const rows = validateBackup(data);
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('aircraft', 'readwrite');
    const store = tx.objectStore('aircraft');
    for (const row of rows) {
      const req = store.get(row.hex);
      req.onsuccess = () => {
        const previous = req.result;
        const images = [...(previous?.images || [])];
        for (const img of row.images) if (!images.some(old => old.data === img.data)) images.push(img);
        store.put({ ...previous, ...row, firstSeen: Math.min(previous?.firstSeen ?? row.firstSeen, row.firstSeen), lastSeen: Math.max(previous?.lastSeen ?? row.lastSeen, row.lastSeen), sightings: Math.max(previous?.sightings || 0, row.sightings), notes: previous?.notes || row.notes, images });
      };
    }
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  window.dispatchEvent(new Event('aircraft-archive-updated'));
}
