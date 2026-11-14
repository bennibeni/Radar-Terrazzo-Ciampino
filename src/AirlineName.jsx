import React from 'react';
export default function AirlineName({ aircraft }) {
  if (!aircraft.airline) return null;
  return <span className="airline-identity"><strong className="airline-prominent">{aircraft.airline}</strong>
    {aircraft.airlineSource === 'callsign' && <small className="airline-source">Dedotta dal callsign</small>}
  </span>;
}
