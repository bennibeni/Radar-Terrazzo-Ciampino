import React from 'react';

const countryNames = new Intl.DisplayNames(['it'], { type: 'region', fallback: 'none' });

export default function AirportCity({ name, airport }) {
  const code = airport?.countryCode;
  const hasCountryCode = /^[a-z]{2}$/i.test(code ?? '');
  const countryName = hasCountryCode
    ? countryNames.of(code.toUpperCase()) ?? airport.countryName ?? code.toUpperCase()
    : null;
  return (
    <div className="airport-city">
      {hasCountryCode && (
        <img key={code} className="airport-flag" src={`https://flagcdn.com/24x18/${code.toLowerCase()}.png`}
          width="16" height="12" loading="lazy" referrerPolicy="no-referrer"
          alt={countryName} title={countryName} onError={event => { event.currentTarget.hidden = true; }} />
      )}
      <span>{name}</span>
    </div>
  );
}
