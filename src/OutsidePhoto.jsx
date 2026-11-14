import AirlineName from './AirlineName';
import React from 'react';

export default function OutsidePhoto({ aircrafts, onSelect }) {
  if (!aircrafts.length) return null;
  return <div className="outside-photo" aria-label="Voli nel cono fuori dalla foto">
    <strong className="outside-photo-title">Nel cono, oltre i bordi della foto</strong>
    {aircrafts.map(ac => {
      const Item = onSelect ? 'button' : 'span';
      return <Item className="outside-photo-flight" key={ac.hex} {...(onSelect ? { onClick: () => onSelect(ac.hex) } : {})}>
        <strong>{ac.callsign} · {ac.direction}</strong>
        <AirlineName aircraft={ac} />
        <span>Elevazione ~{ac.elevationDeg}° · {ac.distKm.toFixed(1)} km</span>
      </Item>;
    })}
    <small>Indicazioni rispetto all’inquadratura calibrata; la visibilità dipende anche dai palazzi.</small>
  </div>;
}
