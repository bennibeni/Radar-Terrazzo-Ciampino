import React from 'react';

export default function PhotoFlightRoute({ route, doubtful }) {
  if (!route || route.unavailable) return null;
  if (doubtful) return (
    <span className="route-doubtful route-doubtful-label">
      <span className="route-question" aria-hidden="true">?</span>
      Rotta da verificare
    </span>
  );
  const origin = /^[A-Z0-9]{3,4}$/.test(route.originIata ?? '') ? route.originIata : null;
  const destination = /^[A-Z0-9]{3,4}$/.test(route.destIata ?? '') ? route.destIata : null;
  if (!origin && !destination) return null;

  return <>
    <span className="route-caption">Rotta indicativa</span>
    <span className="photo-flight-route" aria-label={`Partenza ${origin ?? 'non disponibile'}, arrivo ${destination ?? 'non disponibile'}`}>
      {origin ?? '—'} <span aria-hidden="true">→</span> {destination ?? '—'}
    </span>
  </>;
}
