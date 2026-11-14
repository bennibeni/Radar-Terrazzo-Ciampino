import AirlineName from './AirlineName';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Compass, Eye } from 'lucide-react';
import { readPhotoCalibration, projectAircraftToPhoto, outsideAircraftToPhoto } from './panoramaProjection';
import OutsidePhoto from './OutsidePhoto';
import PhotoAircraft from './PhotoAircraft';
import SunsetPanel from './SunsetPanel';

export default function Panorama({ aircrafts, flightDetails, clock, lastSuccess, stale, status, isRunning, sunData, archivedAircraft }) {
  const [showLabels, setShowLabels] = useState(true);
  const [selectedHex, setSelectedHex] = useState(null);
  const [calibration, setCalibration] = useState(readPhotoCalibration);
  useEffect(() => { try { localStorage.setItem('panoramaCalibration', JSON.stringify(calibration)); } catch {} }, [calibration]);
  const projected = projectAircraftToPhoto(aircrafts, calibration);
  const outside = outsideAircraftToPhoto(aircrafts, calibration);
  const selected = [...projected, ...outside].find(ac => ac.hex === selectedHex);
  const route = selected ? flightDetails[selected.callsign] : null;
  return (
    <main className="container panorama-page">
      <header>
        <div>
          <a className="panorama-back" href="#/"><ArrowLeft size={16} /> Torna al radar</a>
          <h1><Compass size={26} color="#38bdf8" /> La visuale dal terrazzo</h1>
          <p className="subtitle">Via Francesco Gentile · Riferimenti per orientarti nel cielo</p>
        </div>
        <button onClick={() => setShowLabels(value => !value)} aria-pressed={showLabels}>
          <Eye size={16} /> {showLabels ? 'Nascondi indicazioni' : 'Mostra indicazioni'}
        </button>
      </header>

      <figure className="panorama-figure">
        <div className="panorama-image">
          <img src="/images/panorama-terrazzo.jpg" width="4080" height="3060"
            alt="Panorama dal terrazzo al tramonto: cielo libero al centro e a sinistra, via Francesco Gentile in basso e palazzi sulla destra." />
          {showLabels && <div className="panorama-labels">
            <div className="photo-bearing-scale" aria-label="Foto: bordo sinistro Ovest 270 gradi, centro 281 gradi, bordo destro 292 gradi">
              <span>O · 270°</span><span>281° · Centro</span><span>292°</span>
            </div>
          </div>}
          <PhotoAircraft aircrafts={projected} selectedHex={selectedHex} onSelect={setSelectedHex} archivedAircraft={archivedAircraft} />
        </div>
        <figcaption>Foto dal tuo terrazzo · 14 novembre 2026. Originale conservato; indicazioni sovrapposte disattivabili.</figcaption>
      </figure>
      <OutsidePhoto aircrafts={outside} onSelect={setSelectedHex} />

      <SunsetPanel sunData={sunData} />

      <div className="panorama-notice">
        <strong>Calibrazione manuale della foto.</strong> Bordo sinistro 270° (Ovest), centro 281°,
        bordo destro 292°: ampiezza impostata di 22°, senza verifica strumentale.
        I riferimenti intermedi sono indicativi. Il cono complessivo del radar resta
        270° → Nord → 10°; il Nord è fuori da questa foto.
      </div>

      <section className="card photo-calibration" aria-label="Calibrazione e voli sulla foto">
        <div className="photo-live-status" role="status">
          <strong>{stale ? 'Posizioni non disponibili' : !isRunning ? 'Aggiornamenti in pausa' : status === 'error' ? 'Errore rete: ultimi dati disponibili' : 'Posizioni radar aggiornate'}</strong>
          <span>{projected.length} voli nell’inquadratura{lastSuccess ? ` · ultima risposta ${Math.max(0, Math.floor((clock - lastSuccess) / 1000))} s fa` : ''}</span>
        </div>
        <label>Orizzonte: {calibration.horizon}% dall’alto
          <input type="range" min="0" max="100" step="1" value={calibration.horizon} onChange={e => setCalibration(c => ({ ...c, horizon: Number(e.target.value) }))} />
        </label>
        <label>Scala verticale: {calibration.verticalSpan}° per l’altezza della foto
          <input type="range" min="10" max="120" step="1" value={calibration.verticalSpan} onChange={e => setCalibration(c => ({ ...c, verticalSpan: Number(e.target.value) }))} />
        </label>
        <button onClick={() => setCalibration({ horizon: 67, verticalSpan: 55 })}>Ripristina calibrazione iniziale</button>
        <p>Posizioni indicative su una foto fissa. Regola l’orizzonte e la scala verticale confrontando un aereo osservato con la sua sagoma; le impostazioni vengono salvate. I valori iniziali sono stime. Gli ostacoli non sono ancora mascherati e le sagome non indicano dimensioni o assetto reali.</p>
      </section>



      {!stale && projected.length === 0 && <p className="photo-empty" role="status">Nessun volo attuale proiettabile tra 270° e 292°: servono una posizione con età nota, un’elevazione disponibile e una quota nell’inquadratura calibrata.</p>}
      {selected && <section className="card photo-flight-details" aria-label={`Dettagli ${selected.callsign}`}>
        <h2>{selected.callsign}</h2>
        <AirlineName aircraft={selected} />
        <p>{selected.aircraftType} · {selected.registration} · {selected.phase}</p>
        <p>Direzione {Math.round(selected.bearing)}° · Elevazione ~{selected.elevationDeg}° · Distanza {selected.distKm.toFixed(1)} km</p>
        <p>Quota barometrica {selected.altMeters === null ? 'N/D' : `${selected.altMeters} m`} · Velocità {selected.speedKmh === null ? 'N/D' : `${selected.speedKmh} km/h`} · Posizione {Math.floor(selected.positionAge + (clock - lastSuccess) / 1000)} s fa</p>
        <p>{route && !route.unavailable ? `Rotta indicativa: ${route.originIata} → ${route.destIata} (ADSBdb, da verificare)` : 'Rotta non disponibile'}</p>
        <button onClick={() => setSelectedHex(null)}>Chiudi dettagli</button>
      </section>}

      <section className="card panorama-orientation" aria-labelledby="orientation-title">
        <h2 id="orientation-title">Come leggere le direzioni</h2>
        <p>Il settore provvisorio va da Ovest verso Nord, fino a 10°. Questo schema indica l’ordine delle direzioni, senza proiettarle sulla foto.</p>
        <div className="bearing-strip" aria-label="Cono provvisorio: Ovest 270 gradi, Nord-Ovest 315 gradi, Nord 0 gradi, limite destro 10 gradi">
          <span><strong>O · 270°</strong><small>Limite sinistro</small></span>
          <span><strong>NO · 315°</strong><small>Nord-Ovest</small></span>
          <span><strong>N · 0°</strong><small>Nord</small></span>
          <span><strong>10°</strong><small>Limite destro</small></span>
        </div>
        <p>281° è vicino al lato Ovest del settore. I tetti possono nascondere gli aerei più bassi: il radar filtra la direzione, ma non considera ancora il profilo dei palazzi.</p>
      </section>
    </main>
  );
}
