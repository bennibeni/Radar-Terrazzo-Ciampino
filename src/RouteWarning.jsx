import React from 'react';

export default function RouteWarning({ route, reason, observedAt }) {
  const observationTime = Number.isFinite(observedAt) ? new Date(observedAt) : null;

  return (
    <details className="route-review">
      <summary className="route-doubtful">
        <span className="route-doubtful-label">
          <span className="route-question" aria-hidden="true">?</span>
          Rotta da verificare
        </span>
      </summary>
      <p>Rotta indicata da ADSBdb: <strong>{route.originIata} → {route.destIata}</strong>.</p>
      <p>
        {reason}{' '}Cerca il nominativo o il
        codice ICAO dell’aereo in uno storico dei voli e confronta data, ora e posizione della traccia.
        {observationTime && <> Rilevazione del{' '}
          <time dateTime={observationTime.toISOString()}>
            {observationTime.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Europe/Rome' })}
          </time> (ora di Roma).
        </>}
      </p>
    </details>
  );
}
