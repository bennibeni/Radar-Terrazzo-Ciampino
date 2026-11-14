const normalize = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '';
export function resolveAircraftImage(aircraft, archive) {
  const entries = Array.isArray(archive) ? archive : Object.values(archive);
  const own = entries.find(row => row.hex.toLowerCase() === aircraft.hex.toLowerCase());
  if (own?.images?.length) return { image: own.images[0], representative: false, registration: own.registration };
  const model = normalize(aircraft.model || aircraft.aircraftType);
  const airline = normalize(aircraft.airline);
  if (!model || model === 'n/d' || !airline || ['n/d', 'compagnia non disponibile'].includes(airline)) return null;
  const donor = entries.filter(row => row.images?.length && normalize(row.model) === model && normalize(row.airline) === airline)
    .sort((a, b) => a.registration.localeCompare(b.registration) || a.hex.localeCompare(b.hex))[0];
  return donor ? { image: donor.images[0], representative: true, registration: donor.registration } : null;
}
