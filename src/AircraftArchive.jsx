import AirlineName from './AirlineName';
import React, { useEffect, useState } from 'react';
import { listAircraft, updateAircraft, addAircraftImages, readImage, importBackup, imageWebUrl } from './aircraftArchive';
import { archiveContentBytes, formatStorageBytes } from './archiveImages';
import { resolveAircraftImage } from './representativeImage';

function AircraftEntry({ aircraft, run, resolvedImage }) {
  const [notes, setNotes] = useState(aircraft.notes);
  const [link, setLink] = useState('');
  const [preview, setPreview] = useState('');
  const [linkReady, setLinkReady] = useState(false);
  const [linkError, setLinkError] = useState('');
  const fmt = value => new Date(value).toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
  return <article className="card archive-entry" id={`aircraft-${aircraft.hex}`}>
    <AirlineName aircraft={aircraft} />
    <h2>{aircraft.registration} <small>· {aircraft.model}</small></h2>
    {aircraft.registration && aircraft.registration !== 'N/D' && <a className="page-link"
      href={`https://www.airnavradar.com/data/registration/${encodeURIComponent(aircraft.registration.trim())}`}
      target="_blank" rel="noopener noreferrer">Apri su AirNav Radar ↗</a>}
    {aircraft.registration && aircraft.registration !== 'N/D' && <a className="page-link"
      href={`https://www.jetphotos.com/registration/${encodeURIComponent(aircraft.registration.trim().toUpperCase())}`}
      target="_blank" rel="noopener noreferrer">Cerca queste marche su JetPhotos ↗</a>}
    <p>ICAO {aircraft.hex.toUpperCase()} · Ultimo callsign: {aircraft.callsign}</p>
    <p>Primo rilevamento: {fmt(aircraft.firstSeen)}<br />Ultimo rilevamento: {fmt(aircraft.lastSeen)} · Avvistamenti: {aircraft.sightings}</p>
    <div className="archive-gallery">{aircraft.images.map((img, i) => <figure key={img.id}>
      <a href={img.data} target="_blank" rel="noreferrer"><img src={img.data} referrerPolicy="no-referrer" alt={`${aircraft.registration}: ${img.name}`} /></a>
      <figcaption>{i === 0 ? 'Immagine principale · ' : ''}{img.name}</figcaption>
      <div className="controls">
        {i > 0 && <button onClick={() => run(() => updateAircraft(aircraft.hex, { images: [img, ...aircraft.images.filter(item => item.id !== img.id)] }))}>Usa come principale</button>}
        <button onClick={() => run(() => updateAircraft(aircraft.hex, { images: aircraft.images.filter(item => item.id !== img.id) }))}>Rimuovi immagine</button>
      </div>
    </figure>)}</div>
    {!aircraft.images.length && (resolvedImage ? <figure className="archive-representative">
      <img src={resolvedImage.image.data} referrerPolicy="no-referrer" alt={`Immagine rappresentativa: ${resolvedImage.registration}`} />
      <figcaption>Immagine rappresentativa automatica · Aeromobile fotografato: {resolvedImage.registration} · {aircraft.model} · {aircraft.airline}</figcaption>
      <p>Viene riutilizzata dall’archivio senza duplicarla. Aggiungi una foto specifica per sostituirla automaticamente.</p>
    </figure> : <p>Nessuna immagine specifica o rappresentativa disponibile. Aggiungi foto o illustrazioni di questo aeromobile.</p>)}
    <label className="archive-upload">Aggiungi immagini (massimo 8 MB ciascuna)
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={e => {
        const files = [...e.target.files]; e.target.value = '';
        run(async () => {
          const images = [];
          for (const file of files) images.push(await readImage(file));
          await addAircraftImages(aircraft.hex, images);
        });
      }} />
    </label>
    <div className="archive-web-image">
      <label className="archive-notes">Oppure inserisci un link diretto all’immagine
        <input type="url" placeholder="https://esempio.it/aereo.jpg" value={link} onChange={e => { setLink(e.target.value); setPreview(''); setLinkReady(false); setLinkError(''); }} />
      </label>
      <button onClick={() => {
        try { setLinkError(''); setLinkReady(false); setPreview(imageWebUrl(link)); }
        catch (err) { setLinkError(err.message); }
      }}>Verifica e mostra anteprima</button>
      {preview && <img className="archive-web-preview" src={preview} referrerPolicy="no-referrer" alt="Anteprima immagine dal link"
        onLoad={() => { setLinkReady(true); setLinkError(''); }} onError={() => { setLinkReady(false); setLinkError('Immagine non caricabile. Usa il link al file immagine, non alla pagina del sito.'); }} />}
      {linkError && <p role="alert">{linkError}</p>}
      {linkReady && <button onClick={() => run(async () => {
        await addAircraftImages(aircraft.hex, [{ id: crypto.randomUUID(), name: `Immagine web · ${new URL(preview).hostname}`, data: preview }]);
        setLink(''); setPreview(''); setLinkReady(false);
      })}>Aggiungi immagine dal link</button>}
      <p>Si salva il collegamento, non una copia del file. L’immagine richiede Internet e deve rimanere disponibile sul sito di origine. Il backup conserva il link; l’archivio resta locale al browser.</p>
    </div>
    <label className="archive-notes">Note personali<textarea value={notes} onChange={e => setNotes(e.target.value)} rows="3" /></label>
    <button onClick={() => run(() => updateAircraft(aircraft.hex, { notes }))}>Salva note</button>
  </article>;
}

export default function AircraftArchive({ error }) {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [colorFilter, setColorFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState(null);
  const [contentBytes, setContentBytes] = useState(0);
  const [expandedHex, setExpandedHex] = useState(null);
  const refresh = () => listAircraft().then(async data => {
    setRows(data);
    setContentBytes(archiveContentBytes(data));
    try { setStorage(await navigator.storage?.estimate?.() || null); } catch { setStorage(null); }
  }).catch(err => setMessage(`Archivio non disponibile: ${err.message}`));
  useEffect(() => { refresh(); window.addEventListener('aircraft-archive-updated', refresh); return () => window.removeEventListener('aircraft-archive-updated', refresh); }, []);
  async function run(action) {
    setBusy(true); setMessage('');
    try { await action(); await refresh(); setMessage('Operazione completata.'); }
    catch (err) { setMessage(`Operazione non riuscita: ${err.message}`); }
    finally { setBusy(false); }
  }
  const imagesByHex = new Map(rows.map(row => [row.hex, resolveAircraftImage(row, rows)]));
  const greenCount = rows.filter(row => imagesByHex.get(row.hex)).length;
  const filtered = rows.filter(row => {
    const matchesSearch = `${row.registration} ${row.model} ${row.hex} ${row.airline || ''}`.toLowerCase().includes(query.trim().toLowerCase());
    const hasImage = Boolean(imagesByHex.get(row.hex));
    return matchesSearch && (colorFilter === 'all' || (colorFilter === 'green' ? hasImage : !hasImage));
  }).sort((a, b) => a.registration.localeCompare(b.registration, 'it', { numeric: true, sensitivity: 'base' }) || a.hex.localeCompare(b.hex));
  return <main className="container archive-page">
    <header><div><a className="panorama-back" href="#/">← Torna al radar</a><h1>Archivio aeromobili</h1><p className="subtitle">Marche, modelli e immagini dei velivoli rilevati</p></div></header>
    <p className="panorama-notice">Archivio salvato solo in questo browser. Esporta un backup per conservarlo o trasferirlo su un altro dispositivo. Un nuovo avvistamento viene contato dopo almeno 10 minuti senza rilevamenti dello stesso aereo. Sono archiviati i velivoli in volo rilevati entro 18 km, anche fuori dal cono.</p>
    <section className="card archive-storage" aria-label="Spazio utilizzato">
      <h2>Spazio utilizzato</h2>
      <p>Contenuto dell’archivio: <strong>{formatStorageBytes(contentBytes)}</strong> · {rows.length} aeromobili · {rows.reduce((count, row) => count + row.images.length, 0)} immagini</p>
      {Number.isFinite(storage?.usage) && Number.isFinite(storage?.quota) && storage.quota > 0 ? <>
        <progress aria-label="Spazio usato dal sito rispetto alla quota stimata" value={Math.min(storage.usage, storage.quota)} max={storage.quota} />
        <p>Spazio del sito: {formatStorageBytes(storage.usage)} su {formatStorageBytes(storage.quota)} stimati dal browser ({(Math.min(1, storage.usage / storage.quota) * 100).toFixed(2)}%).</p>
      </> : <p>Il browser non rende disponibile la stima dello spazio totale.</p>}
      <small>Il contenuto è misurato in formato esportabile; l’occupazione effettiva di IndexedDB può differire. La quota del sito include anche altri dati ed è variabile.</small>
      <p>Nuovi caricamenti: lato massimo 1280 pixel, compressione WebP e trasparenza conservata. Nessun ingrandimento. Le GIF ridimensionate o convertite diventano immagini statiche. I backup importati e le immagini già presenti restano invariati.</p>
    </section>
    <fieldset disabled={busy} className="archive-toolbar">
      <label>Filtra righe
        <select value={colorFilter} onChange={e => setColorFilter(e.target.value)}>
          <option value="all">Tutte ({rows.length})</option>
          <option value="green">Verdi · con immagini ({greenCount})</option>
          <option value="yellow">Gialle · senza immagini ({rows.length - greenCount})</option>
        </select>
      </label>
      <label>Cerca marche, modello, compagnia o ICAO<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <button onClick={() => run(async () => {
        const data = await listAircraft();
        const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, aircraft: data })], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'archivio-aeromobili.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      })}>Esporta backup</button>
      <label>Importa backup<input type="file" accept="application/json,.json" onChange={e => {
        const file = e.target.files[0]; e.target.value = '';
        if (file) run(async () => { if (file.size > 100 * 1024 * 1024) throw new Error('Backup troppo grande (massimo 100 MB).'); await importBackup(JSON.parse(await file.text())); });
      }} /></label>
    </fieldset>
    {(message || error) && <p role="status">{message || error}</p>}
    <p role="status"><strong>{filtered.length} righe visibili</strong> su {rows.length} aeromobili in archivio</p>
    <p className="archive-color-legend"><span className="archive-legend-green">Verde: immagini presenti</span><span className="archive-legend-yellow">Giallo: nessuna immagine</span></p>
    <fieldset disabled={busy} className="archive-entries">
      <div className="archive-table-scroll">
        <table className="archive-table">
          <caption>Aeromobili rilevati · Apri una riga per immagini e dati completi</caption>
          <thead><tr><th scope="col">Marche</th><th scope="col">Modello</th><th scope="col">Compagnia del volo</th><th scope="col">Ultimo rilevamento</th><th scope="col">Immagini</th><th scope="col">Dettagli</th></tr></thead>
          <tbody>{filtered.map(row => {
            const expanded = expandedHex === row.hex;
            const resolvedImage = imagesByHex.get(row.hex);
            const toggle = () => { if (!busy) setExpandedHex(expanded ? null : row.hex); };
            return <React.Fragment key={row.hex}>
              <tr className={`archive-summary ${resolvedImage ? 'has-images' : 'no-images'}`} onClick={toggle}>
                <th scope="row">{row.registration}</th>
                <td>{row.model}</td>
                <td>{row.airline ? <AirlineName aircraft={row} /> : 'N/D'}</td>
                <td>{new Date(row.lastSeen).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td>{row.images.length ? `${row.images.length} presenti` : resolvedImage ? 'Rappresentativa automatica' : 'Da aggiungere'}</td>
                <td><button aria-expanded={expanded} aria-controls={`archive-detail-${row.hex}`} aria-label={`${expanded ? 'Chiudi' : 'Apri'} dettagli ${row.registration}`} onClick={e => { e.stopPropagation(); toggle(); }}>{expanded ? '▾ Chiudi' : '▸ Apri'}</button></td>
              </tr>
              <tr hidden={!expanded} className="archive-detail-row"><td colSpan="6" id={`archive-detail-${row.hex}`}>
                {expanded && <AircraftEntry aircraft={row} run={run} resolvedImage={resolvedImage} />}
              </td></tr>
            </React.Fragment>;
          })}</tbody>
        </table>
      </div>
    </fieldset>
    {!filtered.length && <p className="empty-state">{rows.length ? 'Nessun aeromobile corrisponde ai filtri selezionati.' : 'L’archivio si popola mentre il radar riceve nuovi dati.'}</p>}
  </main>;
}
