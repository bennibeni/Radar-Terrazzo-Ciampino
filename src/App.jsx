import { withFlightAirline } from './flightAirline';
import AirlineName from './AirlineName';
import { RADAR_KM, MAX_POSITION_AGE, readTelemetry, elevationAngle, isBearingInCone, getDistanceKm, routeDoubtReason } from './telemetry';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Panorama from './Panorama.jsx';
import PhotoAircraft, { PhotoAircraftCards } from './PhotoAircraft';
import { PHOTO_MIN_BEARING, PHOTO_MAX_BEARING, readPhotoCalibration, projectAircraftToPhoto, outsideAircraftToPhoto } from './panoramaProjection';
import OutsidePhoto from './OutsidePhoto';
import AircraftArchive from './AircraftArchive.jsx';
import RunwayGuide from './RunwayGuide.jsx';
import RouteWarning from './RouteWarning';
import AirportCity from './AirportCity';
import FcoContinuation from './FcoContinuation';
import { FCO_LAT, FCO_LON, FCO_QUERY_RADIUS_NM, FCO_COVERAGE_KM, FCO_RETENTION_MS, updateOutsideFlights, hasFcoDestination } from './fcoTracking';
import { runwayObservation, observedCiampinoMovement, ciampinoMovementLabel, isCiampinoAirport } from './flightClassification';
import { TRAIL_MINUTES, trailSegments, updateRadarTrails } from './radarTrail';
import { naturalLightIndex, panoramaOpacity, sunsetPhase } from './naturalLight';
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

// AIP Italia, AD 2 LIRA §12: coordinate WGS84 delle soglie.
const CIAMPINO_THRESHOLDS = [
  { name: '15', lat: 41 + 48 / 60 + 28.95 / 3600, lon: 12 + 35 / 60 + 19.81 / 3600 },
  { name: '33', lat: 41 + 47 / 60 + 25.49 / 3600, lon: 12 + 36 / 60 + 3.58 / 3600 }
];
const RUNWAY_EXTENSION_KM = 6;

// Punti di riferimento indicativi: protezione civile di Roma e Marino, OpenStreetMap.
const RADAR_LANDMARKS = [
  { name: 'Quarto Miglio', lat: 41.84371, lon: 12.54734 },
  { name: 'Capannelle', lat: 41.824071, lon: 12.569569 },
  { name: 'Marino', lat: 41.770, lon: 12.661 }
];

const SKYLINE_LANDMARKS = [
  { name: 'San Pietro', lat: 41.902374, lon: 12.453915 },
  { name: 'Vittoriano', lat: 41.895357, lon: 12.48275, labelOffsetY: 18 },
  { name: 'Colosseo', lat: 41.890091, lon: 12.492509, labelOffsetY: 33 },
  { name: 'San Paolo', lat: 41.858421, lon: 12.474785 },
  { name: 'Monte Mario', lat: 41.922481, lon: 12.450506 },
  { name: 'Monte Soratte', lat: 42.2431, lon: 12.5103 },
  { name: 'Monte Gennaro', lat: 42.06056, lon: 12.80660 },
  { name: 'Tivoli', lat: 41.963917, lon: 12.79625 },
  { name: 'Frascati', lat: 41.803444, lon: 12.683028 },
  { name: 'Castel Gandolfo', lat: 41.747147, lon: 12.650297 },
  { name: 'Lido di Ostia', lat: 41.729213, lon: 12.276170 }
];

// Punti sui tratti locali delle strade, dalle geometrie OpenStreetMap.
const RADAR_ROADS = [
  { name: 'Via Tuscolana', lat: 41.8483136, lon: 12.5760444, labelDx: -9, labelDy: -17 },
  { name: 'Via Casilina', lat: 41.8711584, lon: 12.5790888, labelDx: 14, labelDy: -11 },
  { name: 'Via Anagnina', lat: 41.8331081, lon: 12.5949806, labelDx: 12, labelDy: 6 },
  { name: 'Via Appia Nuova', lat: 41.8145902, lon: 12.5727838, labelDx: -13, labelDy: 19 }
];

const ALTITUDE_TRENDS = {
  'In salita (stima)': '↑ In salita',
  'In discesa (stima)': '↓ In discesa',
  'Quota stabile (stima)': '→ Quota stabile'
};

// Limiti provvisori misurati dall'utente: Ovest -> Nord -> 10°, da verificare.
const CONE_MIN_BEARING = 270;
const CONE_MAX_BEARING = 10;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
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

// Gong morbido sintetizzato con Web Audio.
function playProximityChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    ctx.resume().catch(() => {});
    oscCleanup(ctx);
    const harmonics = [0, 1, 0.07, 0.3, 0.05, 0.18];
    const timbre = ctx.createPeriodicWave(new Float32Array(harmonics.length), new Float32Array(harmonics));
    const start = ctx.currentTime + 0.02;
    const end = start + 0.78;
    const note = ctx.createOscillator();
    const gain = ctx.createGain();
    note.setPeriodicWave(timbre);
    note.frequency.setValueAtTime(293.66, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.19, start + 0.009);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    note.connect(gain);
    gain.connect(ctx.destination);
    note.start(start);
    note.stop(end);
  } catch (e) {
    console.warn('Audio non riproducibile:', e);
  }
}

export default function App({ panorama = false, archive = false, runway = false }) {
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
  const radarTrailsRef = useRef(new Map());
  const followedFlightsRef = useRef(new Map());
  const fcoDialogRef = useRef(null);
  const [outsideFlights, setOutsideFlights] = useState([]);
  const [trailSelection, setTrailSelection] = useState(null);
  const runwayEvidenceRef = useRef(new Map());
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
  const [onlyConeFilter, setOnlyConeFilter] = useState(false);
  const [showRadarMap, setShowRadarMap] = useState(false);
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
            sunsetTimestamp: sunsetDate.getTime(),
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
        const airportDetails = airport => airport ? {
          lat: airport.latitude,
          lon: airport.longitude,
          countryCode: airport.country_iso_name,
          countryName: airport.country_name
        } : null;
        setFlightDetails((prev) => ({
          ...prev,
          [clean]: {
            airline: flightRoute.airline?.name || 'Compagnia non disponibile',
            originIata: flightRoute.origin?.iata_code || flightRoute.origin?.icao_code || '---',
            originCity: flightRoute.origin?.municipality || flightRoute.origin?.name || 'Origine sconosciuta',
            destIata: flightRoute.destination?.iata_code || flightRoute.destination?.icao_code || '---',
            destCity: flightRoute.destination?.municipality || flightRoute.destination?.name || 'Destinazione sconosciuta',
            origin: airportDetails(flightRoute.origin),
            midpoint: airportDetails(flightRoute.midpoint),
            destination: airportDetails(flightRoute.destination)
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
      const res = await fetch(`/api/adsb/v2/point/${HOME_LAT}/${HOME_LON}/${FCO_QUERY_RADIUS_NM}`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error('Errore risposta radar');
      const data = await res.json();

      if (!Array.isArray(data.ac)) throw new Error('Formato radar non valido');
      const rawList = data.ac;
      const now = Date.now();
      const runwayEvidence = runwayEvidenceRef.current;
      for (const [hex, evidence] of runwayEvidence) {
        if (now - evidence.time > 4 * 60 * 1000) runwayEvidence.delete(hex);
      }
      const samples = rawList
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
          const flightKey = callsign || ac.hex.toUpperCase();
          let evidence = runwayEvidence.get(ac.hex);
          if (evidence && evidence.flightKey !== flightKey) {
            runwayEvidence.delete(ac.hex);
            evidence = undefined;
          }
          const observation = runwayObservation({ ...telemetry, lat: ac.lat, lon: ac.lon });
          const observedAt = now - telemetry.positionAge * 1000;
          if (observation && (!evidence || observedAt - evidence.time >= 2000)) {
            const sameMovement = evidence?.kind === observation.kind && evidence.runway === observation.runway;
            const consecutive = sameMovement && observedAt - evidence.time <= 25000
              && (ac.lat !== evidence.lat || ac.lon !== evidence.lon);
            evidence = { ...observation, flightKey, time: observedAt, lat: ac.lat, lon: ac.lon,
              confirmed: Boolean(consecutive || (sameMovement && evidence.confirmed)) };
            runwayEvidence.set(ac.hex, evidence);
          }
          if (callsign && distKm <= RADAR_KM) {
            fetchRouteInfo(callsign);
          }

          return {
            hex: ac.hex,
            callsign: flightKey,
            runwayEvidence: evidence,
            airline: flightDetailsRef.current[callsign]?.airline === 'Compagnia non disponibile' ? null : flightDetailsRef.current[callsign]?.airline || null,
            registration: ac.r || 'N/D',
            aircraftType: ac.t || 'N/D',
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
        .filter((ac) => ac.distKm <= FCO_COVERAGE_KM && (ac.positionAge === null || ac.positionAge <= MAX_POSITION_AGE))
        .sort((a, b) => a.distKm - b.distKm);
      const processed = samples.filter(ac => ac.distKm <= RADAR_KM);
      const outside = updateOutsideFlights(followedFlightsRef.current, samples, now, rawList);

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

      updateRadarTrails(radarTrailsRef.current, [
        ...processed,
        ...outside.filter(flight => flight.receivedAt === now && flight.aircraft.distKm > RADAR_KM)
          .map(flight => flight.aircraft)
      ], now);
      setOutsideFlights(outside);
      setAircrafts(processed);
      recordAircraft(processed).then(() => setArchiveError('')).catch(() => setArchiveError('Salvataggio archivio non riuscito: verifica lo spazio disponibile nel browser.'));
      setLastUpdate(new Date().toLocaleTimeString('it-IT'));
      setLastSuccess(now);
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
      playProximityChime();
    }
  };

  const stale = lastSuccess === null || clock - lastSuccess > 20000;
  const freshAircraftsRaw = stale ? [] : aircrafts.filter((ac) => ac.positionAge === null || ac.positionAge + (clock - lastSuccess) / 1000 <= MAX_POSITION_AGE);
  const freshAircrafts = freshAircraftsRaw.map(ac => {
    const route = flightDetails[ac.callsign];
    const segments = trailSegments(radarTrailsRef.current.get(ac.hex), clock);
    const observedMovement = observedCiampinoMovement(ac, segments);
    const doubtfulReason = routeDoubtReason(ac, route, segments, observedMovement);
    const service = route?.airline;
    const saved = archivedAircraft[ac.hex.toLowerCase()];
    const sameFlight = saved?.callsign === ac.callsign;
    const serviceAvailable = service && service !== 'Compagnia non disponibile';
    return withFlightAirline({ ...ac,
      routeDoubtful: Boolean(doubtfulReason),
      doubtfulReason,
      observedMovement,
      ciampinoFlight: Boolean(observedMovement || (!doubtfulReason && !route?.unavailable &&
        [route?.originIata, route?.destIata].some(isCiampinoAirport))),
      movementLabel: observedMovement ? ciampinoMovementLabel(observedMovement, doubtfulReason ? null : route) : null,
      airline: serviceAvailable ? service : ac.airline || (sameFlight ? saved.airline : null),
      airlineSource: serviceAvailable ? 'adsbdb' : ac.airline ? ac.airlineSource || 'adsbdb' : sameFlight ? saved.airlineSource : null
    });
  });
  const visibleAircrafts = onlyConeFilter
    ? freshAircrafts.filter((ac) => ac.inCone)
    : freshAircrafts;
  const trailAircraft = visibleAircrafts.find(ac => ac.hex === trailSelection?.hex && ac.callsign === trailSelection.callsign);
  const selectedAltitude = trailAircraft && (trailAircraft.altMeters === null ? 'Quota N/D' : `${trailAircraft.altMeters} m`);
  const selectedTrend = trailAircraft && (ALTITUDE_TRENDS[trailAircraft.phase] ?? 'Tendenza N/D');

  if (runway) return <RunwayGuide />;
  if (archive) return <AircraftArchive error={archiveError} />;
  const lightIndex = naturalLightIndex(clock, HOME_LAT, HOME_LON);
  const photoOpacity = panoramaOpacity(lightIndex);
  const panoramaSunsetPhase = sunsetPhase(clock, sunData?.sunsetTimestamp);
  if (panorama) return <Panorama aircrafts={freshAircrafts} flightDetails={flightDetails}
    clock={clock} lastSuccess={lastSuccess} stale={stale} status={status} isRunning={isRunning}
    sunData={sunData} lightIndex={lightIndex} photoOpacity={photoOpacity} sunsetPhase={panoramaSunsetPhase}
    archivedAircraft={archivedAircraft} />;

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

  const sectorPath = (start, end) => {
    const edge = bearing => {
      const radians = toRad(bearing);
      return `${CENTER_PX + RADAR_RADIUS_PX * Math.sin(radians)} ${CENTER_PX - RADAR_RADIUS_PX * Math.cos(radians)}`;
    };
    return `M ${CENTER_PX} ${CENTER_PX} L ${edge(start)} A ${RADAR_RADIUS_PX} ${RADAR_RADIUS_PX} 0 0 1 ${edge(end)} Z`;
  };
  const visibleConePath = sectorPath(CONE_MIN_BEARING, CONE_MAX_BEARING);
  const fcoBearing = getBearing(HOME_LAT, HOME_LON, FCO_LAT, FCO_LON);
  const fcoDistance = Math.round(getDistanceKm(HOME_LAT, HOME_LON, FCO_LAT, FCO_LON));
  const fcoAngle = toRad(fcoBearing);
  const fcoX = CENTER_PX + (RADAR_RADIUS_PX + 18) * Math.sin(fcoAngle);
  const fcoY = CENTER_PX - (RADAR_RADIUS_PX + 18) * Math.cos(fcoAngle);
  const fcoScale = RADAR_KM / FCO_COVERAGE_KM;
  const projectToFco = (lat, lon) => {
    const { x, y } = projectToRadar(lat, lon);
    return { x: CENTER_PX + (x - CENTER_PX) * fcoScale, y: CENTER_PX + (y - CENTER_PX) * fcoScale };
  };
  const fcoFlights = outsideFlights.flatMap(flight => {
    const { aircraft, observedAt, receivedAt } = flight;
    const route = flightDetails[aircraft.callsign];
    if (clock - observedAt >= FCO_RETENTION_MS || !hasFcoDestination(route)) return [];
    const segments = trailSegments(radarTrailsRef.current.get(aircraft.hex), clock);
    if (routeDoubtReason(aircraft, route, segments, observedCiampinoMovement(aircraft, segments))) return [];
    return [{
      aircraft,
      segments,
      live: !stale && receivedAt === lastSuccess && clock - observedAt <= 20_000,
      ageSeconds: Math.max(0, Math.floor((clock - observedAt) / 1000)),
      airportDistance: getDistanceKm(aircraft.lat, aircraft.lon, FCO_LAT, FCO_LON).toFixed(1)
    }];
  });
  const fcoActive = fcoFlights.length > 0;
  const openFco = () => {
    if (fcoActive) fcoDialogRef.current?.showModal();
  };

  const thresholds = CIAMPINO_THRESHOLDS.map(({ name, lat, lon }) => ({ name, ...projectToRadar(lat, lon) }));
  const [threshold15, threshold33] = thresholds;
  const runwayDx = threshold33.x - threshold15.x;
  const runwayDy = threshold33.y - threshold15.y;
  const extensionScale = (RUNWAY_EXTENSION_KM * RADAR_RADIUS_PX / MAX_RADAR_KM) / Math.hypot(runwayDx, runwayDy);

  return (
    <div className="container">
      <header className="radar-header">
        <div>
          <h1>
            <Plane size={26} color="#38bdf8" />
            Radar Terrazzo Ciampino
          </h1>
          <div className="subtitle">
            V.le Antonio Ciamarra 255, Roma • Cono provvisorio: 270° → Nord → 10°
          </div>
        </div>

        <div className="radar-toolbar">
          <nav className="controls radar-toolbar-panel" aria-label="Pagine del radar">
            <a className="page-link" href="#/archivio">Archivio aeromobili</a>
            <a className="page-link" href="#/panorama"><Compass size={16} /> Panorama del terrazzo</a>
            <a className="page-link" href="#/pista">Pista 15/33</a>
          </nav>

          <figure className="radar-light-chart">
            <div className="radar-light-sun" role="meter" aria-labelledby="radar-light-caption"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={lightIndex}>
              <span className="radar-light-disc" style={{ '--light-fill': `${lightIndex}%` }} aria-hidden="true">
                <span>{lightIndex}%</span>
              </span>
            </div>
            <figcaption id="radar-light-caption">Luce naturale stimata</figcaption>
          </figure>

          <div className="controls radar-toolbar-panel radar-commands" role="group" aria-label="Controlli del radar">
            <button
              className={onlyConeFilter ? 'active-filter' : ''}
              onClick={() => setOnlyConeFilter((v) => !v)}
              title="Mostra solo gli aerei dentro il campo visivo del tuo terrazzo"
            >
              <Eye size={16} />
              {onlyConeFilter ? 'Solo Cono Terrazzo (Attivo)' : 'Tutti i Voli'}
            </button>

            <button onClick={() => setIsRunning((r) => !r)}>
              {isRunning ? <Pause size={16} /> : <Play size={16} />}
              {isRunning ? 'Pausa' : 'Riprendi'}
            </button>

            <button onClick={fetchRadarData} aria-label="Aggiorna radar" title="Aggiorna radar">
              <RefreshCw size={16} />
            </button>

            <button
              className={soundEnabled ? 'active-audio' : ''}
              onClick={toggleSound}
              title="Suona un avviso quando un aereo nel cono del terrazzo passa a meno di 4 km da casa tua"
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              {soundEnabled ? 'Avviso Cono < 4 km ON' : 'Avviso Sonoro OFF'}
            </button>

            <div className="status-badge">
              <span className={`dot ${status === 'error' || stale ? 'error' : isRunning ? 'live' : 'paused'}`} />
              {status === 'error' ? 'Errore Rete' : lastUpdate ? `Agg. ${lastUpdate}` : 'Connessione...'}
            </div>
          </div>
        </div>
      </header>

      <div className="data-notice">
        <p>
          <strong>{!isRunning ? 'In pausa' : status === 'error' ? 'Errore di rete' : status === 'syncing' ? 'Aggiornamento' : 'Dati ricevuti'}</strong>
          {lastSuccess ? ` · ${Math.max(0, Math.floor((clock - lastSuccess) / 1000))} s fa` : ' · In attesa'}
          {stale && lastSuccess && ' · Dati scaduti'}
        </p>
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
          <label className="radar-map-toggle">
            <input type="checkbox" checked={showRadarMap} onChange={event => setShowRadarMap(event.target.checked)} />
            Mostra mappa
          </label>

          <svg viewBox="-60 -25 485 425" className="radar-svg">
            <defs>
              <radialGradient id="radar-background">
                <stop stopColor="#0f172a" />
                <stop offset="1" stopColor="#060911" />
              </radialGradient>
              <mask id="radar-ortofoto-mask" maskUnits="userSpaceOnUse"
                x="0" y="0" width="400" height="400" style={{ maskType: 'luminance' }}>
                <circle cx={CENTER_PX} cy={CENTER_PX} r={RADAR_RADIUS_PX} fill="white" />
                <path d={visibleConePath} fill="black" />
              </mask>
            </defs>
            <circle cx={CENTER_PX} cy={CENTER_PX} r="198" fill="url(#radar-background)" stroke="#1e293b" strokeWidth="2" />
            {/* Ritaglio AGEA riproiettato sulla griglia 400 × 400 centrata sul terrazzo. */}
            {showRadarMap && <image href="/images/radar-ortofoto-agea-2023.webp" width="400" height="400"
              opacity="0.55" mask="url(#radar-ortofoto-mask)" aria-hidden="true" />}

            {/* Cono visivo del terrazzo */}
            <path d={visibleConePath}
              fill="rgba(245, 158, 11, 0.20)" stroke="#fbbf24" strokeWidth="1.5" />
            <path d={sectorPath(PHOTO_MIN_BEARING, PHOTO_MAX_BEARING)} className="radar-photo-sector" />

            {/* Cerchi distanza: 4 km, 10 km, 18 km */}
            <circle cx={CENTER_PX} cy={CENTER_PX} r={(4 / MAX_RADAR_KM) * RADAR_RADIUS_PX} fill="none" stroke="#fca5a5" strokeDasharray="3 3" />
            <circle cx={CENTER_PX} cy={CENTER_PX} r={(10 / MAX_RADAR_KM) * RADAR_RADIUS_PX} fill="none" stroke="#e2e8f0" strokeOpacity="0.8" strokeDasharray="4 4" />
            <circle cx={CENTER_PX} cy={CENTER_PX} r={RADAR_RADIUS_PX} fill="none" stroke="#cbd5e1" />

            {/* Assi cardinali */}
            <line x1={CENTER_PX} y1="20" x2={CENTER_PX} y2="380" stroke="#1e293b" strokeWidth="1" />
            <line x1="20" y1={CENTER_PX} x2="380" y2={CENTER_PX} stroke="#1e293b" strokeWidth="1" />
            <text x={CENTER_PX} y="16" fill="#64748b" fontSize="11" textAnchor="middle">N</text>
            <text x={CENTER_PX} y="394" fill="#64748b" fontSize="11" textAnchor="middle">S</text>
            <text x="12" y={CENTER_PX + 4} fill="#fbbf24" fontSize="11" fontWeight="bold">O</text>
            <text x="388" y={CENTER_PX + 4} fill="#64748b" fontSize="11" textAnchor="end">E</text>

            <g className={fcoActive ? 'radar-fco radar-fco-active' : 'radar-fco'} role={fcoActive ? 'button' : 'img'}
              tabIndex={fcoActive ? 0 : undefined} aria-haspopup={fcoActive ? 'dialog' : undefined}
              aria-label={fcoActive ? `Apri Verso Fiumicino. Voli seguiti: ${fcoFlights.length}`
                : `Aeroporto di Fiumicino, FCO, a circa ${fcoDistance} km in direzione ${Math.round(fcoBearing)} gradi dal terrazzo`}
              onClick={fcoActive ? openFco : undefined}
              onKeyDown={fcoActive ? event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openFco();
                }
              } : undefined}>
              <title>{fcoActive ? 'Apri Verso Fiumicino' : `Fiumicino · ${Math.round(fcoBearing)}° · circa ${fcoDistance} km`}</title>
              {fcoActive && <rect className="radar-fco-highlight" x={fcoX - 64} y={fcoY - 16} width="70" height="34" rx="6" />}
              <path d="M 0 17 V 0 M -4 4 L 0 0 L 4 4" transform={`translate(${fcoX}, ${fcoY}) rotate(${fcoBearing})`} />
              <text className="radar-ground-label" x={fcoX - 8} y={fcoY + 2} textAnchor="end">
                {fcoActive ? `FCO · ${fcoFlights.length}` : 'FCO'}
                <tspan x={fcoX - 8} dy="12" className="radar-fco-distance">~{fcoDistance} km</tspan>
              </text>
            </g>

            {showRadarMap && SKYLINE_LANDMARKS.map(({ name, lat, lon, labelOffsetY = 0 }) => {
              const bearing = getBearing(HOME_LAT, HOME_LON, lat, lon);
              const radians = toRad(bearing);
              const dx = Math.sin(radians);
              const dy = -Math.cos(radians);
              const nearMeridian = Math.abs(dx) < 0.25;
              const west = dx < 0;
              const x = CENTER_PX + dx * 193;
              const y = CENTER_PX + dy * 193;
              return <g key={name} className="radar-skyline" data-in-cone={isInsideTerraceCone(bearing)}>
                <title>{name} · {Math.round(bearing)}° dal terrazzo</title>
                <line x1={CENTER_PX + dx * RADAR_RADIUS_PX} y1={CENTER_PX + dy * RADAR_RADIUS_PX} x2={x} y2={y} />
                {labelOffsetY !== 0 && <line x1={x} y1={y} x2={x - 4} y2={y + labelOffsetY} />}
                <text x={nearMeridian ? x : x + (west ? -7 : 7)} y={nearMeridian ? y + dy * 7 : y + 3 + labelOffsetY}
                  textAnchor={nearMeridian ? 'middle' : west ? 'end' : 'start'}>{name}</text>
              </g>;
            })}

            <g role="img" aria-label="Pista di Ciampino, soglia 15 a nord-ovest e soglia 33 a sud-est. Asse tratteggiato oltre le soglie.">
              <line x1={threshold15.x - runwayDx * extensionScale} y1={threshold15.y - runwayDy * extensionScale}
                x2={threshold33.x + runwayDx * extensionScale} y2={threshold33.y + runwayDy * extensionScale}
                stroke="#a5b4fc" strokeWidth="1.5" strokeDasharray="4 4" />
              <line x1={threshold15.x} y1={threshold15.y} x2={threshold33.x} y2={threshold33.y}
                stroke="#c7d2fe" strokeWidth="4" />
              {thresholds.map(({ name, x, y }) => (
                <text key={name} className="radar-ground-label" x={x - 6} y={y + 3}
                  fill="#e0e7ff" fontSize="10" fontWeight="bold" textAnchor="end">
                  {name}
                </text>
              ))}
              <text className="radar-ground-label" x={(threshold15.x + threshold33.x) / 2 + 9}
                y={(threshold15.y + threshold33.y) / 2 + 3} fill="#e0e7ff" fontSize="10" fontWeight="bold">
                Aeroporto di Ciampino
              </text>
            </g>

            {/* Posizione Casa (V.le Ciamarra 255) */}
            <circle cx={CENTER_PX} cy={CENTER_PX} r="5" fill="#10b981" />
            <text className="radar-ground-label" x={CENTER_PX + 8} y={CENTER_PX - 6} fill="#6ee7b7" fontSize="10" fontWeight="bold">Terrazzo</text>

            {showRadarMap && RADAR_LANDMARKS.map(({ name, lat, lon }) => {
              const { x, y } = projectToRadar(lat, lon);
              const west = x < CENTER_PX;
              return <g key={name} className="radar-landmark">
                <circle cx={x} cy={y} r="2" />
                <text className="radar-ground-label" x={x + (west ? -5 : 5)} y={y + 3} textAnchor={west ? 'end' : 'start'}>{name}</text>
              </g>;
            })}

            {showRadarMap && RADAR_ROADS.map(({ name, lat, lon, labelDx, labelDy }) => {
              const { x, y } = projectToRadar(lat, lon);
              const labelX = x + labelDx;
              const labelY = y + labelDy;
              return <g key={name} className="radar-road">
                <line x1={x} y1={y} x2={labelX} y2={labelY} />
                <circle cx={x} cy={y} r="2" />
                <text className="radar-ground-label" x={labelX + Math.sign(labelDx) * 3} y={labelY + 3}
                  textAnchor={labelDx < 0 ? 'end' : 'start'}>{name}</text>
              </g>;
            })}

            {visibleAircrafts.map(ac => (
              <g key={ac.hex} className={ac === trailAircraft ? 'radar-trails selected' : 'radar-trails'} aria-hidden="true">
                {trailSegments(radarTrailsRef.current.get(ac.hex), clock).map(segment => (
                  <polyline key={segment[0].time} className="radar-trail" fill="none"
                    points={segment.map(({ lat, lon }) => {
                      const { x, y } = projectToRadar(lat, lon);
                      return `${x},${y}`;
                    }).join(' ')} />
                ))}
              </g>
            ))}

            {/* Aerei live */}
            {visibleAircrafts.map((ac) => {
              const pos = projectToRadar(ac.lat, ac.lon);
              const color = ac.isCloseAlert ? '#ef4444' : ac.inCone ? '#fbbf24' : '#38bdf8';
              const selected = ac === trailAircraft;
              const labelOnLeft = selected && pos.x > CENTER_PX;
              const labelX = labelOnLeft ? -13 : selected ? 13 : 8;
              const labelAnchor = labelOnLeft ? 'end' : 'start';
              const toggleFlight = () => setTrailSelection(selected ? null : { hex: ac.hex, callsign: ac.callsign });
              return (
                <g key={ac.hex} className="radar-aircraft-control" transform={`translate(${pos.x}, ${pos.y})`}
                  role="button" tabIndex={0} aria-label={`Dettagli di ${ac.callsign}`} aria-pressed={selected}
                  onClick={toggleFlight} onKeyDown={event => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    if (!event.repeat) toggleFlight();
                  }}>
                  <circle className="radar-aircraft-target" r="12" />
                  <g transform={`rotate(${ac.track ?? 0})`}>
                    {ac.track === null ? <circle r="4" fill={color} /> : <polygon points="0,-7 5,6 0,3 -5,6" fill={color} />}
                  </g>
                  <text x={labelX} y="-4" textAnchor={labelAnchor} fill="#f8fafc" fontSize="9.5" fontWeight="bold">
                    {ac.callsign}
                  </text>
                  {ac.airline && <text x={labelX} y="8" textAnchor={labelAnchor} fill="#7dd3fc" fontSize="8">{ac.airline}</text>}
                  {selected && <text x={labelX} y={ac.airline ? 20 : 9} textAnchor={labelAnchor} className="radar-flight-altitude">
                    {selectedAltitude} · {selectedTrend}
                  </text>}
                </g>
              );
            })}
          </svg>

          <div className="radar-trail-status" role="status">
            {trailAircraft
              ? `${trailAircraft.callsign} · ${selectedAltitude} · ${selectedTrend}`
              : `Scie automatiche · Fino a ${TRAIL_MINUTES} minuti di posizioni rilevate`}
          </div>
          {trailAircraft && <button type="button" onClick={() => setTrailSelection(null)}>Deseleziona volo</button>}

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
            <span className="legend-item">
              <span className="radar-runway-key" aria-hidden="true" /> Pista Ciampino e asse prolungato
            </span>
            <span className="legend-item">
              <span className="radar-photo-key" aria-hidden="true" /> Settore orizzontale della foto · {PHOTO_MIN_BEARING}°–{PHOTO_MAX_BEARING}°
            </span>
          </div>
          {showRadarMap && <>
            <small className="radar-skyline-note">Riferimenti sul bordo: in giallo nel cono, in azzurro fuori dal cono. La visibilità dipende da meteo e ostacoli.</small>
            <small className="radar-imagery-credit">
              <a href="https://geoportale.regione.lazio.it/">Ortofoto AGEA 2023 · Geoportale Regione Lazio</a>
              {' · Ritaglio riproiettato · '}
              <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
              {' · Vie: '}
              <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>
            </small>
          </>}
          <FcoContinuation dialogRef={fcoDialogRef} flights={fcoFlights} project={projectToFco} terrace={{ x: CENTER_PX, y: CENTER_PX }}
            airport={projectToFco(FCO_LAT, FCO_LON)} localRadius={RADAR_RADIUS_PX * fcoScale} />
        </div>

        <a className="card panorama-preview" href="#/panorama" aria-label="Apri la visuale dal terrazzo"
          data-sunset-phase={panoramaSunsetPhase}>
          <div className="card-header"><span>La visuale dal terrazzo</span><Compass size={16} /></div>
          <div className="panorama-image">
            <img src="/images/panorama-terrazzo.jpg" width="4080" height="3060" style={{ opacity: photoOpacity }}
              alt="Panoramica dal terrazzo verso Ovest" />
            <PhotoAircraft aircrafts={photoAircrafts} />
          </div>
          <div className="preview-bearings"><span>270°</span><span>281°</span><span>292°</span></div>
          <PhotoAircraftCards aircrafts={photoAircrafts} flightDetails={flightDetails} archivedAircraft={archivedAircraft} />
          <OutsidePhoto aircrafts={outsideAircraftToPhoto(freshAircrafts, readPhotoCalibration())} flightDetails={flightDetails} />
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
                {ac.movementLabel && <p className="flight-movement">{ac.movementLabel}</p>}
                {ac.routeDoubtful && info ? (
                  <RouteWarning route={info} reason={ac.doubtfulReason}
                    observedAt={ac.positionAge === null ? null : lastSuccess - ac.positionAge * 1000} />
                ) : <>
                {info && <div className="route-caption">Rotta indicativa · ADSBdb</div>}
                <div className="route-box">
                  <div>
                    <div className="airport-code">{info ? info.originIata : '---'}</div>
                    <AirportCity airport={info?.origin}
                      name={info ? info.originCity : route?.unavailable ? 'Rotta non disponibile' : 'Ricerca rotta...'} />
                  </div>
                  <Plane size={16} color="#64748b" />
                  <div className="route-destination">
                    <div className="airport-code">{info ? info.destIata : '---'}</div>
                    <AirportCity airport={info?.destination} name={info ? info.destCity : '---'} />
                  </div>
                </div>
                </>}

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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
