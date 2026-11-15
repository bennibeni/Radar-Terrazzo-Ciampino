import React from 'react';

const additionalSources = [
  {
    title: 'FAA · Dati trasmessi via ADS‑B',
    url: 'https://www.faa.gov/air_traffic/technology/equipadsb/resources/faq',
    description: 'Spiega quali informazioni di posizione, quota e velocità possono essere trasmesse dagli aeromobili.'
  },
  {
    title: 'AIP Italia · Ciampino, §12 (PDF)',
    url: 'https://aip.rossiya-airlines.com/Italia/AIP/ad/ad2/ADPRA1-1.pdf',
    description: 'Le coordinate delle soglie 15 e 33 sono il riferimento per disegnare la pista sul radar.'
  },
  {
    title: 'Roma Capitale · Piano di protezione civile (PDF)',
    url: 'https://www.comune.roma.it/web-resources/cms/documents/PPC2024_1_InformazioneGenerale_Allegati.pdf',
    description: 'Le coordinate dell’ippodromo sono il riferimento per Capannelle sulla mappa.'
  },
  {
    title: 'OpenStreetMap · Quarto Miglio',
    url: 'https://www.openstreetmap.org/node/262143087',
    description: 'Punto di riferimento del quartiere usato sul radar.'
  },
  {
    title: 'Comune di Marino · Piano di protezione civile (PDF)',
    url: 'https://old.comune.marino.rm.it/sites/default/files/01_-_pec_-_piano_protezione_civile_comune_di_marino_maggio_2024.pdf',
    description: 'Fonte del punto indicativo di Marino sulla mappa.'
  },
  {
    title: 'NOAA · Calcolo della posizione solare (PDF)',
    url: 'https://www.gml.noaa.gov/grad/solcalc/solareqns.PDF',
    description: 'Le formule per calcolare l’altezza del Sole, usata dall’app per stimare la luce naturale e l’opacità della foto.'
  },
  {
    title: 'NOAA · Dettagli del calcolo solare',
    url: 'https://gmd-int.cmdl.noaa.gov/grad/solcalc/calcdetails.html',
    description: 'Descrive il metodo di calcolo e gli effetti delle condizioni atmosferiche sulle stime.'
  },
  {
    title: 'NOAA · Glossario solare e crepuscolo civile',
    url: 'https://www.gml.noaa.gov/grad/solcalc/glossary.html',
    description: 'Definisce il limite del crepuscolo civile a 6° sotto l’orizzonte, usato come zero dell’indice di luce.'
  }
];

export default function RunwayGuide() {
  return (
    <main className="container runway-guide">
      <header>
        <div>
          <a className="panorama-back" href="#/">← Torna al radar</a>
          <h1>La pista di Ciampino dal terrazzo</h1>
        </div>
      </header>

      <p className="runway-intro">
        Ciampino ha <strong>una sola pista asfaltata</strong>, usata nei due sensi a seconda della
        direzione del vento. Si chiama <strong>Pista 15</strong> quando si atterra o si decolla da
        nord verso sud e <strong>Pista 33</strong> quando si opera da sud verso nord.
      </p>

      <div className="runway-configurations">
        <section className="card" aria-labelledby="runway-15">
          <h2 id="runway-15">Pista 15</h2>
          <p className="subtitle">Vento da sud / Scirocco</p>
          <h3>Atterraggi</h3>
          <p>
            Sono i più spettacolari dal terrazzo. Gli aerei scendono allineati lungo il sentiero
            che passa sopra Appia, Quarto Miglio e Capannelle, sfilando davanti a te verso sinistra
            a bassa quota (tra 300 e 800 metri) con i fari accesi.
          </p>
          <h3>Decolli</h3>
          <p>
            Gli aerei partono verso sud, in direzione dei Castelli Romani e di Marino. Molti, pochi
            minuti dopo il decollo, effettuano una larga virata a destra e rientrano nel tuo campo
            visivo verso ovest o sud-ovest mentre salgono di quota.
          </p>
        </section>

        <section className="card" aria-labelledby="runway-33">
          <h2 id="runway-33">Pista 33</h2>
          <p className="subtitle">Vento da nord / Tramontana</p>
          <h3>Decolli</h3>
          <p>
            Sono ben visibili. Gli aerei staccano le ruote verso nord-ovest, in direzione di Roma
            Centro, passando alla tua sinistra a circa 2–3 km di distanza. Per ridurre il rumore
            sui quartieri densamente abitati, virano quasi subito verso ovest o sud-ovest, verso
            l’EUR e il Tirreno, attraversando lo skyline del centro di Roma davanti al terrazzo.
          </p>
          <h3>Atterraggi</h3>
          <p>
            Gli aerei arrivano da sud, sopra Frascati, Marino e i Castelli Romani, e si allineano
            alla testata sud della pista. Se hai visuale libera verso sud-est, alla tua estrema
            sinistra guardando il centro, puoi vederli in finale a circa 6–8 km di distanza prima
            che tocchino terra.
          </p>
        </section>
      </div>

      <section className="card runway-sources" aria-labelledby="runway-sources">
        <h2 id="runway-sources">Fonti e approfondimenti</h2>
        <ul>
          <li>
            <a className="page-link" href="https://www.adr.it/documents/10157/18384682/PE.S16.%2BADC%2BVolume%2B2%2BAbilitazione%2Balla%2Bguida%2Bin%2Barea%2BdI%2Bmanovra-%2Brev%2B3%2Bdel%2B31.03_ultima.pdf/0eaf0e8f-e601-5214-9566-9dbcf094621e?t=1649321574862">
              Aeroporti di Roma · Manuale dell’area di manovra (PDF)
            </a>
            <p>Il capitolo 4 illustra orientamento, testate e segnaletica della pista 15/33.</p>
          </li>
          <li>
            <a className="page-link" href="https://www.eurocontrol.int/sites/default/files/2020-12/eurocontrol-prc-technical-note-airport-capacity-imbalance-11122020.pdf#page=105">
              EUROCONTROL · Scheda di Ciampino, p. 104 (PDF)
            </a>
            <p>Nell’analisi del traffico del 2019, la configurazione 15 è stata la più utilizzata (91%).</p>
          </li>
          {additionalSources.map(({ title, url, description }) => (
            <li key={url}>
              <a className="page-link" href={url}>{title}</a>
              <p>{description}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
