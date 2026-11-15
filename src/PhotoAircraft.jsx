import AirlineName from './AirlineName';
import PhotoFlightRoute from './PhotoFlightRoute';
import React, { useState } from 'react';
import { Plane } from 'lucide-react';
import { resolveAircraftImage } from './representativeImage';

function AircraftThumbnail({ aircraft, resolved, route, onSelect }) {
  const image = resolved?.image;
  const [failedSource, setFailedSource] = useState(null);
  const Item = onSelect ? 'button' : 'span';
  return <Item className="photo-aircraft-thumbnail" {...(onSelect ? { onClick: () => onSelect(aircraft.hex) } : {})}>
    <PhotoFlightRoute route={route} doubtful={aircraft.routeDoubtful} />
    {image && failedSource !== image.data
      ? <img src={image.data} referrerPolicy="no-referrer" alt={`${aircraft.registration} · ${aircraft.aircraftType}`} onError={() => setFailedSource(image.data)} />
      : <span className="photo-thumbnail-missing">{image ? 'Immagine non disponibile' : 'Nessuna immagine in archivio'}</span>}
    <span>{aircraft.callsign} · {aircraft.registration}</span>
    {resolved?.representative && <small>Rappresentativa · {resolved.registration}</small>}
    <AirlineName aircraft={aircraft} />
  </Item>;
}

export function PhotoAircraftCards({ aircrafts, onSelect, flightDetails = {}, archivedAircraft = {} }) {
  if (!aircrafts.length) return null;
  return (
    <div className="photo-aircraft-thumbnails" aria-label="Aeromobili con sagoma nella foto">
      {aircrafts.map(ac => <AircraftThumbnail key={ac.hex} aircraft={ac}
        resolved={resolveAircraftImage(ac, archivedAircraft)} route={flightDetails[ac.callsign]} onSelect={onSelect} />)}
    </div>
  );
}

export default function PhotoAircraft({ aircrafts, selectedHex, onSelect }) {
  return (
    <div className="photo-aircraft-layer">
    {aircrafts.map(ac => {
      const Marker = onSelect ? 'button' : 'span';
      return <Marker key={ac.hex} className={`photo-aircraft ${selectedHex === ac.hex ? 'selected' : ''}`}
        data-ciampino={ac.ciampinoFlight ? 'true' : undefined}
        style={{ left: `${ac.x}%`, top: `${ac.y}%` }}
        {...(onSelect ? { onClick: () => onSelect(ac.hex), 'aria-pressed': selectedHex === ac.hex } : {})}
        aria-label={`${ac.callsign}${ac.ciampinoFlight ? ', volo associato a Ciampino' : ''}, direzione ${Math.round(ac.bearing)} gradi, elevazione ${ac.elevationDeg} gradi`}>
        <Plane size={22} className="photo-aircraft-icon" aria-hidden="true" /><span>{ac.callsign}</span>
        <AirlineName aircraft={ac} />
      </Marker>;
    })}
    </div>
  );
}
