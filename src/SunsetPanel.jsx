import React from 'react';
import { Sunset } from 'lucide-react';

export default function SunsetPanel({ sunData }) {
  return (
<div className="card">
          <div className="card-header">
            <span>Luce & Tramonto dal Terrazzo</span>
            <Sunset size={16} color="#fbbf24" />
          </div>

          <div className="sunset-box">
            <div className="sunset-row">
              <div>
                <div className="sunset-label">Luce calda (stima: tramonto −45 min)</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Ideale per foto con fari accesi</div>
              </div>
              <div className="sunset-val">{sunData ? sunData.goldenHour : '--:--'}</div>
            </div>

            <div className="sunset-row">
              <div>
                <div className="sunset-label">Tramonto astronomico (ora di Roma)</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Sole all'orizzonte verso Ovest</div>
              </div>
              <div className="sunset-val">{sunData ? sunData.sunset : '--:--'}</div>
            </div>

            <div className="sunset-row">
              <div>
                <div className="sunset-label">Fine Crepuscolo Civile</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>La visibilità dipende da meteo e ostacoli</div>
              </div>
              <div className="sunset-val" style={{ color: '#94a3b8' }}>
                {sunData ? sunData.twilightEnd : '--:--'}
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.4rem', lineHeight: 1.45 }}>
              <strong>Consiglio di avvistamento:</strong> Guarda l'angolo di elevazione indicato su ogni scheda.
              Se segna <strong>10°–25°</strong> dentro il cono del terrazzo, l’altezza apparente è indicativa: la visibilità dipende anche dai palazzi di fronte a te.
            </div>
          </div>
        </div>
  );
}
