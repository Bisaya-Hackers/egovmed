import { ScreenHeader } from '../components/ui.jsx';
import { Check, ShieldTick } from '../components/Icons.jsx';
import { RECORDS } from '../i18n/dict.js';

export default function Records({ c, lang, A }) {
  return (
    <div className="screen">
      <ScreenHeader onBack={A.back} label={c.recordsTitle} />
      <h1 className="h1" data-stagger>{c.recordsTitle}</h1>
      <p className="sub" data-stagger>{c.recordsSub}</p>

      <div className="stack" style={{ marginTop: 18 }}>
        {RECORDS[lang].map((r, i) => (
          <div key={i} data-stagger className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800 }}>{r[0]}</div>
                <div className="sub" style={{ margin: '3px 0 0' }}>{r[1]}</div>
              </div>
              <span className="pill green"><Check size={13} /> {c.verifiedBadge}</span>
            </div>
            <div className="rowsep" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--teal)', fontSize: '0.88em', fontWeight: 600 }}>
              <ShieldTick size={17} />
              <span style={{ color: 'var(--muted)' }}>{c.verifiedFrom} <b style={{ color: 'var(--ink)' }}>{r[2]}</b></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
