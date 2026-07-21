import { useEffect, useState } from 'react';
import { ScreenHeader } from '../components/ui.jsx';
import { Check, ShieldTick } from '../components/Icons.jsx';
import { RECORDS } from '../i18n/dict.js';
import { api } from '../lib/api.js';

const demo = (lang) => RECORDS[lang].map((r) => ({ name: r[0], date: r[1], source: r[2], verified: true }));

export default function Records({ c, lang, A }) {
  const [records, setRecords] = useState(() => demo(lang));

  // Upgrade to live eGovChain-anchored records if the backend is reachable; otherwise keep the demo set.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.records();
        if (alive && Array.isArray(res) && res.length) {
          setRecords(res.map((r) => ({
            name: r.title,
            date: r.createdAt ? new Date(r.createdAt).toLocaleDateString(lang === 'tl' ? 'fil-PH' : 'en-PH', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
            source: r.sourceFacility,
            verified: !!(r.anchor && r.anchor.verified),
          })));
        }
      } catch { /* keep demo fallback */ }
    })();
    return () => { alive = false; };
  }, [lang]);

  return (
    <div className="screen">
      <ScreenHeader onBack={A.back} label={c.recordsTitle} />
      <h1 className="h1" data-stagger>{c.recordsTitle}</h1>
      <p className="sub" data-stagger>{c.recordsSub}</p>

      <div className="stack" style={{ marginTop: 18 }}>
        {records.map((r, i) => (
          <div key={i} data-stagger className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800 }}>{r.name}</div>
                <div className="sub" style={{ margin: '3px 0 0' }}>{r.date}</div>
              </div>
              {r.verified && <span className="pill green"><Check size={13} /> {c.verifiedBadge}</span>}
            </div>
            <div className="rowsep" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--teal)', fontSize: '0.88em', fontWeight: 600 }}>
              <ShieldTick size={17} />
              <span style={{ color: 'var(--muted)' }}>{c.verifiedFrom} <b style={{ color: 'var(--ink)' }}>{r.source}</b></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
