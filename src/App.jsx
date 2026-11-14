import { withFlightAirline } from './flightAirline';
import AirlineName from './AirlineName';
import { RADAR_KM, MAX_POSITION_AGE, readTelemetry, elevationAngle, isBearingInCone } from './telemetry';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Panorama from './Panorama.jsx';
import PhotoAircraft from './PhotoAircraft';
import { readPhotoCalibration, projectAircraftToPhoto, outsideAircraftToPhoto } from './panoramaProjection';
import OutsidePhoto from './OutsidePhoto';
import AircraftArchive from './AircraftArchive.jsx';
import { resolveAircraftImage } from './representativeImage';
import { recordAircraft, listAircraft, saveArchiveAirlines } from './aircraftArchive';
import {
  Plane,
  Volume2,
  VolumeX,
  Eye,
  RefreshCw,
  Pause,
  Play,
  Compass,
  Navigation,
  AlertTriangle
} from 'lucide-react';

// Coordinate esatte Viale Antonio Ciamarra 255, 00173 Roma
const HOME_LAT = 41.8529;
const HOME_LON = 12.5878;

// Coordinate Aeroporto di Roma Ciampino (LIRA / CIA) - Pista 15/33
const CIA_LAT = 41.7994;
const CIA_LON = 12.5949;

// Limiti provvisori misurati dall'utente: Ovest -> Nord -> 10°, da verificare.
const CONE_MIN_BEARING = 270;
const CONE_MAX_BEARING = 10;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

// Distanza Haversine in km
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Rilevamento bussola (0-360°) da casa tua verso l'aereo
function getBearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

function getCardinalDirection(bearing) {
  const dirs = [
    'Nord',
    'Nord-Est',
    'Est',
    'Sud-Est (Ciampino)',
    'Sud',
    'Sud-Ovest (Centro/Appia)',
    'Ovest (Centro Roma)',
    'Nord-Ovest'
  ];
  const idx = Math.round(bearing / 45) % 8;
  return dirs[idx];
}

function isInsideTerraceCone(bearing) {
  return isBearingInCone(bearing, CONE_MIN_BEARING, CONE_MAX_BEARING);
}

function oscCleanup(ctx) { setTimeout(() => ctx.close().catch(() => {}), 1000); }

// Sintetizzatore Web Audio API per avviso sonoro senza file mp3 esterni
function playProximityChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    ctx.resume().catch(() => {});
    oscCleanup(ctx);
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    // Doppio tono aeronautico morbido (Mi5 -> Si5)
    osc1.frequency.setValueAtTime(659.25, now);
    osc1.frequency.setValueAtTime(987.77, now + 0.16);

    osc2.frequency.setValueAtTime(659.25, now);
    osc2.frequency.setValueAtTime(987.77, now + 0.16);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.warn('Audio non riproducibile:', e);
  }
}

export default function App({ panorama = false, archive = false }) {
  const [archiveError, setArchiveError] = useState('');
  const [archivedAircraft, setArchivedAircraft] = useState({});
  useEffect(() => {
    let active = true;
    const refresh = () => listAircraft().then(rows => {
      if (active) setArchivedAircraft(Object.fromEntries(rows.map(row => [row.hex, row])));
    }).catch(() => { if (active) setArchiveError('Archivio locale non disponibile in questo browser.'); });
    refresh();
    window.addEventListener('aircraft-archive-updated', refresh);
    return () => { active = false; window.removeEventListener('aircraft-archive-updated', refresh); };
  }, []);
  const [aircrafts, setAircrafts] = useState([]);
  const [terraceHeight, setTerraceHeight] = useState(() => {
    try { const saved = Number(localStorage.getItem('terraceHeight') ?? 18); return Number.isFinite(saved) && saved >= 0 && saved <= 200 ? saved : 18; } catch { return 18; }
  });
  const [clock, setClock] = useState(Date.now());
  const [lastSuccess, setLastSuccess] = useState(null);
  const requestRef = useRef(false);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { try { localStorage.setItem('terraceHeight', String(terraceHeight)); } catch {} }, [terraceHeight]);
  const [flightDetails, setFlightDetails] = useState({});
  const flightDetailsRef = useRef(flightDetails);
  flightDetailsRef.current = flightDetails;
  useEffect(() => {
    if (Object.keys(flightDetails).length) saveArchiveAirlines(flightDetails).catch(() => setArchiveError('Salvataggio della compagnia non riuscito.'));
  }, [flightDetails]);
  const [sunData, setSunData] = useState(null);
  const [isRunning, setIsRunning] = useState(true);
  const [onlyConeFilter, setOnlyConeFilter] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [status, setStatus] = useState('syncing');
  const [lastUpdate, setLastUpdate] = useState(null);

  const alertedHexRef = useRef(new Set());
  const fetchedCallsignsRef = useRef(new Set());

  // Carica orari tramonto e Golden Hour per Viale Ciamarra 255
  useEffect(() => {
    async function loadSunTimes() {
      try {
        const res = await fetch(
          `https://api.sunrise-sunset.org/json?lat=${HOME_LAT}&lng=${HOME_LON}&formatted=0`, { signal: AbortSignal.timeout(10000) }
        );
        const data = await res.json();
        if (data.status === 'OK') {
          const sunsetDate = new Date(data.results.sunset);
          const goldenHourDate = new Date(sunsetDate.getTime() - 45 * 60 * 1000);
          const civilTwilightDate = new Date(data.results.civil_twilight_end);

          const fmt = (d) =>
            d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });

          setSunData({
            goldenHour: fmt(goldenHourDate),
            sunset: fmt(sunsetDate),
            twilightEnd: fmt(civilTwilightDate)
          });
        }
      } catch (err) {
        console.error('Errore recupero orari tramonto:', err);
      }
    }
    loadSunTimes();
    const timer = setInterval(loadSunTimes, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Arricchisce dettagli volo (Rotta, Aeromobile, Compagnia) via ADSBdb
  const fetchRouteInfo = useCallback(async (callsign) => {
    const clean = callsign?.trim();
    if (!clean || fetchedCallsignsRef.current.has(clean)) return;
    fetchedCallsignsRef.current.add(clean);

    try {
      const res = await fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(clean)}`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error('Rotta non disponibile');
      const json = await res.json();
      const flightRoute = json?.response?.flightroute;
      if (!flightRoute) throw new Error('Rotta non disponibile');
      if (flightRoute) {
        setFlightDetails((prev) => ({
          ...prev,
          [clean]: {
            airline: flightRoute.airline?.name || 'Compagnia non disponibile',
            originIata: flightRoute.origin?.iata_code || flightRoute.origin?.icao_code || '---',
            originCity: flightRoute.origin?.municipality || flightRoute.origin?.name || 'Origine sconosciuta',
            destIata: flightRoute.destination?.iata_code || flightRoute.destination?.icao_code || '---',
            destCity: flightRoute.destination?.municipality || flightRoute.destination?.name || 'Destinazione sconosciuta'
          }
        }));
      }
    } catch {
      setFlightDetails((prev) => ({ ...prev, [clean]: { unavailable: true } }));
    }
  }, []);

  const fetchRadarData = useCallback(async () => {
    if (requestRef.current) return;
    requestRef.current = true;
    setStatus('syncing');
    try {
      // Ricerca 10 NM dal terrazzo; filtro finale a 18 km
      const res = await fetch(`/api/adsb/v2/point/${HOME_LAT}/${HOME_LON}/10`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error('Errore risposta radar');
      const data = await res.json();

      if (!Array.isArray(data.ac)) throw new Error('Formato radar non valido');
      const rawList = data.ac;
      const processed = rawList
        .filter((ac) => ac.alt_baro !== 'ground')
        .filter((ac) => Number.isFinite(ac.lat) && Math.abs(ac.lat) <= 90 && Number.isFinite(ac.lon) && Math.abs(ac.lon) <= 180 && typeof ac.hex === 'string' && ac.hex.length > 0)
        .map((ac) => {
          const distKm = getDistanceKm(HOME_LAT, HOME_LON, ac.lat, ac.lon);
          const bearing = getBearing(HOME_LAT, HOME_LON, ac.lat, ac.lon);
          const inCone = isInsideTerraceCone(bearing);

          const telemetry = readTelemetry(ac);
          const { altFeet, altMeters, speedKmh, vRateMs, phase } = telemetry;
          const elevationAltitude = telemetry.geometricMeters ?? altMeters;
          const elevationDeg = elevationAngle(elevationAltitude, distKm, 65 + terraceHeight);

          const callsign = (ac.flight || '').trim();
          if (callsign) {
            fetchRouteInfo(callsign);
          }

          return {
            hex: ac.hex,
            callsign: callsign || ac.hex.toUpperCase(),
            airline: flightDetailsRef.current[callsign]?.airline === 'Compagnia non disponibile' ? null : flightDetailsRef.current[callsign]?.airline || null,
            registration: ac.r || 'N/D',
            aircraftType: ac.t || 'N/D',
            squawk: ac.squawk || '----',
            lat: ac.lat,
            lon: ac.lon,
            distKm,
            bearing,
            cardinal: getCardinalDirection(bearing),
            inCone,
            altFeet,
            altMeters,
            speedKmh,
            vRateMs,
            ...telemetry,
            track: telemetry.track,
            elevationDeg,
            phase,
            isCloseAlert: distKm <= 4.0 && !telemetry.ground && telemetry.positionAge !== null && telemetry.positionAge <= MAX_POSITION_AGE && altFeet !== null && altFeet > 200 && altFeet < 10000
          };
        })
        .filter((ac) => ac.distKm <= RADAR_KM && (ac.positionAge === null || ac.positionAge <= MAX_POSITION_AGE))
        .sort((a, b) => a.distKm - b.distKm);

      // Avvisi sonori solo per voli entro 4 km in quota e nel cono del terrazzo.
      alertedHexRef.current = new Set([...alertedHexRef.current].filter((hex) => processed.some((ac) => ac.hex === hex && ac.isCloseAlert && ac.inCone)));
      if (soundEnabled) {
        let shouldBeep = false;
        processed.forEach((ac) => {
          if (ac.isCloseAlert && ac.inCone && !alertedHexRef.current.has(ac.hex)) {
            alertedHexRef.current.add(ac.hex);
            shouldBeep = true;
          }
        });
        if (shouldBeep) {
          playProximityChime();
        }
      }

      setAircrafts(processed);
      recordAircraft(processed).then(() => setArchiveError('')).catch(() => setArchiveError('Salvataggio archivio non riuscito: verifica lo spazio disponibile nel browser.'));
      setLastUpdate(new Date().toLocaleTimeString('it-IT'));
      setLastSuccess(Date.now());
      setStatus('live');
    } catch (err) {
      console.error(err);
      setStatus('error');
    } finally { requestRef.current = false; }
  }, [fetchRouteInfo, soundEnabled, terraceHeight]);

  useEffect(() => {
    if (!isRunning) return;
    fetchRadarData();
    const interval = setInterval(fetchRadarData, 5000);
    return () => clearInterval(interval);
  }, [isRunning, fetchRadarData]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next) {
      playProximityChime(); // Test audio immediato al clic
    }
  };

  const stale = lastSuccess === null || clock - lastSuccess > 20000;
  const freshAircraftsRaw = stale ? [] : aircrafts.filter((ac) => ac.positionAge === null || ac.positionAge + (clock - lastSuccess) / 1000 <= MAX_POSITION_AGE);
  const freshAircrafts = freshAircraftsRaw.map(ac => {
    const service = flightDetails[ac.callsign]?.airline;
    const saved = archivedAircraft[ac.hex.toLowerCase()];
    const sameFlight = saved?.callsign === ac.callsign;
    const serviceAvailable = service && service !== 'Compagnia non disponibile';
    return withFlightAirline({ ...ac,
      airline: serviceAvailable ? service : ac.airline || (sameFlight ? saved.airline : null),
      airlineSource: serviceAvailable ? 'adsbdb' : ac.airline ? ac.airlineSource || 'adsbdb' : sameFlight ? saved.airlineSource : null
    });
  });
  const visibleAircrafts = onlyConeFilter
    ? freshAircrafts.filter((ac) => ac.inCone)
    : freshAircrafts;

  if (archive) return <AircraftArchive error={archiveError} />;
  if (panorama) return <Panorama aircrafts={freshAircrafts} flightDetails={flightDetails}
    clock={clock} lastSuccess={lastSuccess} stale={stale} status={status} isRunning={isRunning} sunData={sunData} archivedAircraft={archivedAircraft} />;

  const photoAircrafts = projectAircraftToPhoto(freshAircrafts, readPhotoCalibration());

  // Calcolo coordinate SVG sul radar (raggio massimo 18 km = 170 px)
  const MAX_RADAR_KM = RADAR_KM;
  const RADAR_RADIUS_PX = 170;
  const CENTER_PX = 200;

  const projectToRadar = (lat, lon) => {
    const dist = getDistanceKm(HOME_LAT, HOME_LON, lat, lon);
    const brngRad = toRad(getBearing(HOME_LAT, HOME_LON, lat, lon));
    const r = (dist / MAX_RADAR_KM) * RADAR_RADIUS_PX;
    const x = CENTER_PX + r * Math.sin(brngRad);
    const y = CENTER_PX - r * Math.cos(brngRad);
    return { x, y };
  };

  // Settore circolare SVG: 270° -> Nord -> 10° (100°).
  const startRad = toRad(CONE_MIN_BEARING);
  const endRad = toRad(CONE_MAX_BEARING);
  const x1 = CENTER_PX + RADAR_RADIUS_PX * Math.sin(startRad);
  const y1 = CENTER_PX - RADAR_RADIUS_PX * Math.cos(startRad);
  const x2 = CENTER_PX + RADAR_RADIUS_PX * Math.sin(endRad);
  const y2 = CENTER_PX - RADAR_RADIUS_PX * Math.cos(endRad);
  const conePath = `M ${CENTER_PX} ${CENTER_PX} L ${x1} ${y1} A ${RADAR_RADIUS_PX} ${RADAR_RADIUS_PX} 0 0 1 ${x2} ${y2} Z`;

  // Posizione aeroporto Ciampino sul radar
  const ciaPos = projectToRadar(CIA_LAT, CIA_LON);

  return (
    <div className="container">
      <header>
        <div>
          <h1>
            <Plane size={26} color="#38bdf8" />
            Radar Terrazzo Ciampino
          </h1>
          <div className="subtitle">
            V.le Antonio Ciamarra 255, Roma • Cono provvisorio: 270° → Nord → 10° (da verificare)
          </div>
        </div>

        <div className="controls">
          <a className="page-link" href="#/archivio">Archivio aeromobili</a>
          <a className="page-link" href="#/panorama"><Compass size={16} /> Panorama del terrazzo</a>
          <button
            className={onlyConeFilter ? 'active-filter' : ''}
            onClick={() => setOnlyConeFilter((v) => !v)}
            title="Mostra solo gli aerei dentro il campo visivo del tuo terrazzo"
          >
            <Eye size={16} />
            {onlyConeFilter ? 'Solo Cono Terrazzo (Attivo)' : 'Tutti i Voli'}
          </button>

          <button
            className={soundEnabled ? 'active-audio' : ''}
            onClick={toggleSound}
            title="Suona un avviso quando un aereo nel cono del terrazzo passa a meno di 4 km da casa tua"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            {soundEnabled ? 'Avviso Cono < 4 km ON' : 'Avviso Sonoro OFF'}
          </button>

          <button onClick={() => setIsRunning((r) => !r)}>
            {isRunning ? <Pause size={16} /> : <Play size={16} />}
            {isRunning ? 'Pausa' : 'Riprendi'}
          </button>

          <button onClick={fetchRadarData} aria-label="Aggiorna radar" title="Aggiorna radar">
            <RefreshCw size={16} />
          </button>

          <div className="status-badge">
            <span
              className={`dot ${
                status === 'error' || stale ? 'error' : isRunning ? 'live' : 'paused'
              }`}
            />
            {status === 'error'
              ? 'Errore Rete'
              : lastUpdate
              ? `Agg. ${lastUpdate}`
              : 'Connessione...'}
          </div>
        </div>
      </header>

      <div className="data-notice">
        <strong>{!isRunning ? 'Aggiornamenti in pausa. ' : status === 'error' ? 'Errore di rete. ' : status === 'syncing' ? 'Aggiornamento in corso. ' : 'Dati ricevuti. '}</strong>
        {lastSuccess ? `Ultima risposta ${Math.max(0, Math.floor((clock - lastSuccess) / 1000))} s fa. ` : 'In attesa della prima risposta. '}
        {stale && 'Posizioni nascoste: dati assenti o risposta più vecchia di 20 s. '}
        Fonte posizioni: ADSB.lol; rotte: ADSBdb (possono essere assenti o non aggiornate). Posizioni con età nota oltre 60 s escluse. Il traffico mostrato è quello nella zona, non necessariamente diretto a Ciampino.
        <label className="height-setting">Terrazzo al 6° piano — altezza sopra il suolo:
          <input aria-label="Altezza del terrazzo sopra il suolo in metri" type="number" min="0" max="200" step="0.5" value={terraceHeight} onChange={(e) => { if (e.target.value !== '') setTerraceHeight(Math.min(200, Math.max(0, Number(e.target.value)))); }} /> m
        </label>
        18 m è una stima iniziale. Terreno stimato a 65 m s.l.m.; elevazione indicativa, senza correzione per pressione atmosferica, ostacoli o riferimento verticale della quota ricevuta.
      </div>
      <div className="radar-section top-grid">
        {/* Mappa Radar */}
        <div className="card radar-wrapper">
          <div className="card-header" style={{ width: '100%' }}>
            <span>Mappa Radar Locale (Raggio 18 km)</span>
            <span>{visibleAircrafts.length} voli visibili</span>
          </div>

          <svg viewBox="0 0 400 400" className="radar-svg">
            {/* Cono visivo del terrazzo */}
            <path d={conePath} fill="rgba(245, 158, 11, 0.14)" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1" />

            {/* Cerchi distanza: 4 km, 10 km, 18 km */}
            <circle cx={CENTER_PX} cy={CENTER_PX} r={(4 / MAX_RADAR_KM) * RADAR_RADIUS_PX} fill="none" stroke="#ef4444" strokeOpacity="0.35" strokeDasharray="3 3" />
            <circle cx={CENTER_PX} cy={CENTER_PX} r={(10 / MAX_RADAR_KM) * RADAR_RADIUS_PX} fill="none" stroke="#334155" strokeDasharray="4 4" />
            <circle cx={CENTER_PX} cy={CENTER_PX} r={RADAR_RADIUS_PX} fill="none" stroke="#334155" />

            {/* Assi cardinali */}
            <line x1={CENTER_PX} y1="20" x2={CENTER_PX} y2="380" stroke="#1e293b" strokeWidth="1" />
            <line x1="20" y1={CENTER_PX} x2="380" y2={CENTER_PX} stroke="#1e293b" strokeWidth="1" />
            <text x={CENTER_PX} y="16" fill="#64748b" fontSize="11" textAnchor="middle">N</text>
            <text x={CENTER_PX} y="394" fill="#64748b" fontSize="11" textAnchor="middle">S</text>
            <text x="12" y={CENTER_PX + 4} fill="#fbbf24" fontSize="11" fontWeight="bold">O</text>
            <text x="388" y={CENTER_PX + 4} fill="#64748b" fontSize="11" textAnchor="end">E</text>

            {/* Aeroporto Ciampino e Pista 15/33 */}
            <g transform={`translate(${ciaPos.x}, ${ciaPos.y})`}>
              <line x1="-5" y1="-9" x2="5" y2="9" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
              <text x="9" y="4" fill="#38bdf8" fontSize="10" fontWeight="bold">CIA 15/33</text>
            </g>

            {/* Posizione Casa (V.le Ciamarra 255) */}
            <circle cx={CENTER_PX} cy={CENTER_PX} r="5" fill="#10b981" />
            <text x={CENTER_PX + 8} y={CENTER_PX - 6} fill="#10b981" fontSize="10" fontWeight="bold">Terrazzo</text>

            {/* Aerei live */}
            {visibleAircrafts.map((ac) => {
              const pos = projectToRadar(ac.lat, ac.lon);
              const color = ac.isCloseAlert ? '#ef4444' : ac.inCone ? '#fbbf24' : '#38bdf8';
              return (
                <g key={ac.hex} transform={`translate(${pos.x}, ${pos.y})`}>
                  <g transform={`rotate(${ac.track ?? 0})`}>
                    {ac.track === null ? <circle r="4" fill={color} /> : <polygon points="0,-7 5,6 0,3 -5,6" fill={color} />}
                  </g>
                  <text x="8" y="-4" fill="#f8fafc" fontSize="9.5" fontWeight="bold">
                    {ac.callsign}
                  </text>
                  {ac.airline && <text x="8" y="8" fill="#7dd3fc" fontSize="8">{ac.airline}</text>}
                </g>
              );
            })}
          </svg>

          <div className="radar-legend">
            <span className="legend-item">
              <span className="dot" style={{ backgroundColor: '#fbbf24' }} /> Nel cono del terrazzo
            </span>
            <span className="legend-item">
              <span className="dot" style={{ backgroundColor: '#ef4444' }} /> Entro 4 km (Avviso)
            </span>
            <span className="legend-item">
              <span className="dot" style={{ backgroundColor: '#38bdf8' }} /> Altri voli nella zona
            </span>
          </div>
        </div>

        <a className="card panorama-preview" href="#/panorama" aria-label="Apri la visuale dal terrazzo">
          <div className="card-header"><span>La visuale dal terrazzo</span><Compass size={16} /></div>
          <div className="panorama-image">
            <img src="/images/panorama-terrazzo.jpg" width="4080" height="3060" alt="Panoramica dal terrazzo verso Ovest" />
            <PhotoAircraft aircrafts={photoAircrafts} archivedAircraft={archivedAircraft} />
          </div>
          <div className="preview-bearings"><span>270°</span><span>281°</span><span>292°</span></div>
          <OutsidePhoto aircrafts={outsideAircraftToPhoto(freshAircrafts, readPhotoCalibration())} />
          <p>{photoAircrafts.length} voli nell’inquadratura · Apri la foto con le sagome dei voli e le informazioni su luce e tramonto →</p>
        </a>
      </div>

      {/* Lista Schede Dettagliate Voli */}
      {visibleAircrafts.length === 0 ? (
        <div className="empty-state">
          {stale ? 'Dati radar non disponibili o non aggiornati. Nessuna posizione attuale da mostrare.' : onlyConeFilter
            ? 'Nessun aereo attualmente dentro il cono visivo del terrazzo. Prova a disattivare il filtro "Solo Cono Terrazzo".'
            : 'Nessun aereo rilevato nel raggio di 18 km dal terrazzo in questo momento.'}
        </div>
      ) : (
        <div className="flights-grid">
          {visibleAircrafts.map((ac) => {
            const route = flightDetails[ac.callsign];
            const info = route && !route.unavailable ? route : null;
            const resolvedImage = resolveAircraftImage(ac, archivedAircraft);
            return (
              <div
                key={ac.hex}
                className={`flight-card ${ac.inCone ? 'in-cone' : ''} ${
                  ac.isCloseAlert ? 'close-alert' : ''
                }`}
              >
                <div className="flight-top">
                  <div>
                    <div className="callsign">{ac.callsign}</div>
                    <AirlineName aircraft={ac} />
                    <div className="airline-name">Aeromobile: {ac.aircraftType} · Reg: {ac.registration}</div>
                  </div>
                  <div className="badges">
                    {ac.isCloseAlert && (
                      <span className="badge badge-close">
                        <AlertTriangle size={11} style={{ display: 'inline', marginRight: 3 }} />
                        MOLTO VICINO
                      </span>
                    )}
                    {ac.inCone && <span className="badge badge-cone">NEL CONO TERRAZZO</span>}
                    <span className="badge badge-phase">{ac.phase}</span>
                  </div>
                </div>

                <a className="archive-flight-link" href="#/archivio">
                  {resolvedImage && <img src={resolvedImage.image.data} referrerPolicy="no-referrer" alt={resolvedImage.representative ? `Immagine rappresentativa: ${resolvedImage.registration}` : `Immagine di ${ac.registration}`} />}
                  {resolvedImage?.representative ? `Immagine rappresentativa · ${resolvedImage.registration}` : resolvedImage ? 'Immagini in archivio' : 'Aggiungi immagini in archivio'} · {ac.registration}
                </a>
                <div className="quality-note">Posizione: {ac.positionAge === null ? 'età non disponibile — freschezza non verificabile' : `${Math.floor(ac.positionAge + (clock - lastSuccess) / 1000)} s fa`}. Elevazione: {ac.geometricMeters !== null ? 'da quota geometrica, indicativa' : ac.altMeters !== null ? 'da quota barometrica, approssimata' : 'non disponibile'}.</div>
                {/* Rotta Origine -> Destinazione */}
                <div className="route-box">
                  <div>
                    <div className="airport-code">{info ? info.originIata : '---'}</div>
                    <div className="airport-city">{info ? info.originCity : route?.unavailable ? 'Rotta non disponibile' : 'Ricerca rotta...'}</div>
                  </div>
                  <Plane size={16} color="#64748b" />
                  <div style={{ textAlign: 'right' }}>
                    <div className="airport-code">{info ? info.destIata : '---'}</div>
                    <div className="airport-city">{info ? info.destCity : '---'}</div>
                  </div>
                </div>

                {/* Telemetria completa */}
                <div className="telemetry-grid">
                  <div className="tel-item">
                    <span className="tel-label">Distanza da Casa</span>
                    <span className="tel-val">{ac.distKm.toFixed(1)} km</span>
                  </div>
                  <div className="tel-item">
                    <span className="tel-label">Direzione / Elevazione</span>
                    <span className="tel-val">
                      {Math.round(ac.bearing)}° ({ac.elevationDeg === null ? 'N/D' : `~${ac.elevationDeg}°`})
                    </span>
                  </div>
                  <div className="tel-item">
                    <span className="tel-label">Quota Barometrica</span>
                    <span className="tel-val">
                      {ac.ground ? 'A terra' : ac.altFeet === null ? 'N/D' : `${ac.altMeters} m (${ac.altFeet} ft)`}
                    </span>
                  </div>
                  <div className="tel-item">
                    <span className="tel-label">Velocità / Rateo</span>
                    <span className="tel-val">
                      {ac.speedKmh === null ? 'N/D' : `${ac.speedKmh} km/h`} ({ac.vRateMs === null ? 'N/D' : `${ac.vRateMs > 0 ? '+' : ''}${ac.vRateMs} m/s`})
                    </span>
                  </div>
                  <div className="tel-item">
                    <span className="tel-label">Modello / Marche</span>
                    <span className="tel-val">
                      {ac.aircraftType} • {ac.registration}
                    </span>
                  </div>
                  <div className="tel-item">
                    <span className="tel-label">Traccia al suolo / Squawk / ICAO</span>
                    <span className="tel-val">
                      {ac.track === null ? 'N/D' : `${Math.round(ac.track)}°`} • {ac.squawk} • {ac.hex.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
