# Radar Terrazzo Ciampino (V.le Antonio Ciamarra 255, Roma)

Applicazione React + Vite per monitorare in tempo reale il traffico aereo intorno all'aeroporto di Roma Ciampino (LIRA/CIA) dal tuo terrazzo orientato verso il centro di Roma.

## Funzionalità incluse
- **Filtro Cono Terrazzo**: attivo all'apertura, mostra solo gli aerei nel settore provvisorio 270° → Nord → 10° (100°). Limiti indicati dall'utente, ancora da verificare; non rappresentano una garanzia di visibilità rispetto agli ostacoli. Puoi disattivarlo per vedere tutti i voli della zona.
- **Avviso Sonoro di Prossimità (< 4 km)**: riproduce un doppio tono aeronautico tramite Web Audio API quando un volo in quota passa entro 4 km da casa tua dentro il cono del terrazzo, anche quando il filtro visivo è disattivato.
- **Telemetria Completa**: distanza esatta, angolo di elevazione sull'orizzonte (in gradi), quota in metri/piedi, velocità al suolo, rateo di salita/discesa, modello aereo, immatricolazione, codice Squawk, esadecimale ICAO e rotta Origine/Destinazione.
- **Orologio Golden Hour & Tramonto**: orari calcolati sulle tue coordinate.

## Archivio aeromobili
- Apri “Archivio aeromobili” dal radar: i velivoli rilevati entro 18 km vengono registrati automaticamente, anche fuori dal cono. Lo stato a terra è escluso.
- Identificazione per codice ICAO esadecimale, con marche, modello, primo/ultimo rilevamento e avvistamenti separati da almeno 10 minuti di assenza.
- Ogni scheda supporta note e più immagini JPG/PNG/WebP/GIF (massimo 8 MB ciascuna), con scelta dell'immagine principale mostrata nelle schede dei voli.
- Dati e immagini sono conservati in IndexedDB nel browser corrente, senza sincronizzazione. “Esporta backup” include le immagini; “Importa backup” unisce i dati agli esistenti, senza duplicare immagini identiche né sommare nuovamente i conteggi.
- I dati locali possono essere rimossi cancellando i dati del sito: conserva periodicamente il backup. L'archivio inizia dai rilevamenti successivi all'aggiornamento e funziona mentre l'app è aperta.

## Avvio in locale
```bash
npm install
npm run dev
```

## Pubblicazione su Vercel
1. Carica questa cartella su GitHub (oppure esegui `npx vercel` nella cartella).
2. Il file `vercel.json` configura automaticamente il proxy `/api/adsb` evitando blocchi CORS.

## Attendibilità dei dati
- Radar centrato sul terrazzo, con esclusione degli aerei oltre 18 km.
- Velivoli segnalati a terra dalla fonte (`alt_baro: ground`) esclusi da radar e schede. Una quota mancante non viene interpretata come stato a terra.
- Altezza iniziale del sesto piano: 18 m sopra il suolo, modificabile e salvata nel browser. Terreno a 65 m s.l.m. stimati: sostituire con una misura verificata per maggiore precisione.
- Elevazione indicativa: quota geometrica se disponibile, altrimenti barometrica; nessuna correzione di pressione, riferimento verticale o ostacoli.
- Dati mancanti indicati come N/D. Salita/discesa sono stime, senza dedurre atterraggio o decollo.
- Età della posizione mostrata per ogni volo; posizioni con età nota oltre 60 s escluse. In assenza di una risposta valida per 20 s il radar viene svuotato. Un'età sconosciuta viene dichiarata e non abilita avvisi.
- Avvisi riabilitati quando l'aereo risulta uscito dalla condizione di prossimità. Rotte non disponibili dichiarate; un nuovo tentativo richiede ricaricare la pagina.
- Orari solari in Europe/Rome, ricaricati ogni ora; luce calda stimata a 45 minuti prima del tramonto.

Verifica della telemetria: `node --test src/telemetry.test.js`.
