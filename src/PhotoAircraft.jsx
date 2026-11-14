import AirlineName from './AirlineName';
import React, { useState } from 'react';
import { Plane } from 'lucide-react';
import { resolveAircraftImage } from './representativeImage';

function AircraftThumbnail({ aircraft, resolved, onSelect }) {
  const image = resolved?.image;
  const [failedSource, setFailedSource] = useState(null);
  const Item = onSelect ? 'button' : 'span';
  return <Item className="photo-aircraft-thumbnail" {...(onSelect ? { onClick: () => onSelect(aircraft.hex) } : {})}>
    {image && failedSource !== image.data
      ? <img src={image.data} referrerPolicy="no-referrer" alt={`${aircraft.registration} · ${aircraft.aircraftType}`} onError={() => setFailedSource(image.data)} />
      : <span className="photo-thumbnail-missing">{image ? 'Immagine non disponibile' : 'Nessuna immagine in archivio'}</span>}
    <span>{aircraft.callsign} · {aircraft.registration}</span>
    {resolved?.representative && <small>Rappresentativa · {resolved.registration}</small>}
    <AirlineName aircraft={aircraft} />
  </Item>;
}

export default function PhotoAircraft({ aircrafts, selectedHex, onSelect, archivedAircraft = {} }) {
  return <>
    {aircrafts.length > 0 && <div className="photo-aircraft-thumbnails" aria-label="Immagini degli aeromobili con sagoma nella foto">
      {aircrafts.map(ac => <AircraftThumbnail key={ac.hex} aircraft={ac}
        resolved={resolveAircraftImage(ac, archivedAircraft)} onSelect={onSelect} />)}
    </div>}
    <div className="photo-aircraft-layer">
    {aircrafts.map(ac => {
      const Marker = onSelect ? 'button' : 'span';
      return <Marker key={ac.hex} className={`photo-aircraft ${selectedHex === ac.hex ? 'selected' : ''}`}
        style={{ left: `${ac.x}%`, top: `${ac.y}%` }}
        {...(onSelect ? { onClick: () => onSelect(ac.hex), 'aria-pressed': selectedHex === ac.hex } : {})}
        aria-label={`${ac.callsign}, direzione ${Math.round(ac.bearing)} gradi, elevazione ${ac.elevationDeg} gradi`}>
        <Plane size={22} aria-hidden="true" /><span>{ac.callsign}</span>
        <AirlineName aircraft={ac} />
      </Marker>;
    })}
  </div></>;
}
