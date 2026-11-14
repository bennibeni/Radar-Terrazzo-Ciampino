// ICAO designators: https://www.faa.gov/air_traffic/publications/atpubs/cnt_html/chap3_section_3.html
const COMPANIES = {
  RYR: 'Ryanair', WZZ: 'Wizz Air', ITY: 'ITA Airways', AEZ: 'Aeroitalia',
  KMM: 'KM Malta Airlines', SEH: 'Sky Express', LOT: 'LOT Polish Airlines',
  NJE: 'NetJets Europe', SNM: 'Servizi Aerei'
};
export function withFlightAirline(aircraft) {
  const existing = typeof aircraft.airline === 'string' ? aircraft.airline.trim() : '';
  if (existing && !['N/D', 'Compagnia non disponibile'].includes(existing) && aircraft.airlineSource !== 'callsign') {
    return { ...aircraft, airline: existing, airlineSource: 'adsbdb' };
  }
  const callsign = typeof aircraft.callsign === 'string' ? aircraft.callsign.trim().toUpperCase() : '';
  const prefix = /^[A-Z]{3}[0-9][A-Z0-9]*$/.test(callsign) ? callsign.slice(0, 3) : null;
  return { ...aircraft, airline: COMPANIES[prefix] || null, airlineSource: COMPANIES[prefix] ? 'callsign' : null };
}
