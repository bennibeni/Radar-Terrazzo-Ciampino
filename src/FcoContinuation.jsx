import React from 'react';
import { TRAIL_MINUTES } from './radarTrail';

export default function FcoContinuation({ dialogRef, flights, project, terrace, airport, localRadius }) {
  return (
    <dialog ref={dialogRef} className="card fco-continuation" aria-labelledby="fco-continuation-title">
      <h2 id="fco-continuation-title">Verso Fiumicino</h2>
      {flights.length === 0 ? <p>Nessun volo verso Fiumicino da seguire.</p> : <>
        <svg className="fco-continuation-map" viewBox="0 0 400 400" role="img"
          aria-label={`Scie rilevate degli ultimi ${TRAIL_MINUTES} minuti dei voli con destinazione indicativa Fiumicino`}>
          <circle cx={terrace.x} cy={terrace.y} r={localRadius} className="fco-local-boundary" />
          <circle cx={terrace.x} cy={terrace.y} r="4" fill="#6ee7b7" />
          <text x={terrace.x + 8} y={terrace.y + 4}>Terrazzo</text>
          <circle cx={airport.x} cy={airport.y} r="5" fill="#c7d2fe" />
          <text x={airport.x + 9} y={airport.y + 4}>FCO</text>
          {flights.map(flight => {
            const { x, y } = project(flight.aircraft.lat, flight.aircraft.lon);
            const labelOnLeft = x > terrace.x;
            return (
              <g key={flight.aircraft.hex} className={flight.live ? '' : 'fco-last-position'}>
                {flight.segments.map(segment => (
                  <polyline key={segment[0].time} className="radar-trail" fill="none"
                    points={segment.map(point => {
                      const position = project(point.lat, point.lon);
                      return `${position.x},${position.y}`;
                    }).join(' ')} />
                ))}
                <circle cx={x} cy={y} r="4" fill="#5eead4" />
                <text className="radar-ground-label" x={x + (labelOnLeft ? -7 : 7)} y={y - 7}
                  textAnchor={labelOnLeft ? 'end' : 'start'}>{flight.aircraft.callsign}</text>
              </g>
            );
          })}
        </svg>
        <ul>
          {flights.map(({ aircraft, live, ageSeconds, airportDistance }) => (
            <li key={aircraft.hex}>
              <strong>{aircraft.callsign}</strong> · {airportDistance} km da FCO
              <small>{live ? 'Posizione aggiornata' : 'Ultima posizione rilevata'} · {ageSeconds} s fa</small>
            </li>
          ))}
        </ul>
        <p>Destinazione indicativa. Il cerchio tratteggiato indica i 18 km del radar locale.</p>
      </>}
      <form method="dialog"><button>Chiudi</button></form>
    </dialog>
  );
}
