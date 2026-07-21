import { useEffect, useState } from 'react';
import { ScreenHeader, Btn } from '../components/ui.jsx';
import { Check, ShieldTick } from '../components/Icons.jsx';
import { RECORDS } from '../i18n/dict.js';
import { api } from '../lib/api.js';

const demo = (lang) => RECORDS[lang].map((r, i) => ({
  id: `demo_${i}`, name: r[0], date: r[1], source: r[2], verified: true, isDemo: true,
}));

const formatDate = (iso, lang) => (iso
  ? new Date(iso).toLocaleDateString(lang === 'tl' ? 'fil-PH' : 'en-PH', { day: '2-digit', month: 'short', year: 'numeric' })
  : '');

export default function Records({ c, lang, A }) {
  const [records, setRecords] = useState(() => demo(lang));
  const [openId, setOpenId] = useState(null); // record id whose detail sheet is open

  // Upgrade to live eGovChain-anchored records if the backend is reachable; otherwise keep the demo set.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.records();
        if (alive && Array.isArray(res) && res.length) {
          setRecords(res.map((r) => ({
            id: r.id,
            name: r.title,
            date: formatDate(r.createdAt, lang),
            source: r.sourceFacility,
            type: r.type,
            summary: r.summary,
            verified: !!(r.anchor && r.anchor.verified),
            isDemo: false,
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
        {records.map((r) => (
          <button
            key={r.id}
            data-stagger
            className="card"
            onClick={() => setOpenId(r.id)}
            style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
            aria-label={`${r.name} — ${r.date}, ${lang === 'tl' ? 'pindutin para tingnan ang detalye' : 'tap for details'}`}
          >
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
          </button>
        ))}
      </div>

      {openId && <RecordSheet record={records.find((r) => r.id === openId)} lang={lang} c={c} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function RecordSheet({ record, lang, c, onClose }) {
  const [detail, setDetail] = useState(null);
  const [verify, setVerify] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Escape to close
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!record) return;
    if (record.isDemo) {
      // Deterministic sample content that matches the design's demo intent
      setDetail({
        title: record.name, sourceFacility: record.source, summary: record.summary || 'CBC within normal limits; mild anemia noted.',
        data: { hemoglobin: '11.2 g/dL', wbc: '7.5 x10^9/L', platelets: '250 x10^9/L', interpretation: 'Mild anemia; otherwise within normal limits' },
        anchor: null,
      });
      setVerify({ verified: true, integrityOk: true, anchoredOnChain: true, badge: `Verified from ${record.source}` });
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const [d, v] = await Promise.all([api.getRecord(record.id), api.verifyRecord(record.id)]);
        if (alive) { setDetail(d); setVerify(v); }
      } catch (e) {
        if (alive) setError(e.message || (lang === 'tl' ? 'Hindi ma-load ang rekord' : 'Could not load record'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [record, lang]);

  if (!record) return null;
  const short = (s) => (s && s.length > 20 ? s.slice(0, 10) + '…' + s.slice(-8) : s);
  const entries = detail && detail.data && typeof detail.data === 'object' && !Array.isArray(detail.data)
    ? Object.entries(detail.data)
    : [];

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={record.name} onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--line)', margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div className="overline">{record.type || (lang === 'tl' ? 'Lab' : 'Lab')}</div>
            <h2 className="h2" style={{ margin: '4px 0 0' }}>{record.name}</h2>
            <div className="sub" style={{ margin: '2px 0 0' }}>{record.date}</div>
          </div>
          {verify?.verified && <span className="pill green"><Check size={13} /> {c.verifiedBadge}</span>}
        </div>

        <div className="rowsep" />

        {loading ? (
          <div className="sub" style={{ textAlign: 'center' }}>Loading…</div>
        ) : error ? (
          <div role="alert" style={{ color: 'var(--red)', fontSize: '0.9em', textAlign: 'center' }}>{error}</div>
        ) : (
          <>
            {detail?.summary && (
              <div className="card tint" style={{ marginBottom: 12 }}>
                <div className="overline" style={{ marginBottom: 6 }}>{lang === 'tl' ? 'Buod' : 'Summary'}</div>
                <div style={{ fontSize: '0.95em', lineHeight: 1.45 }}>{detail.summary}</div>
              </div>
            )}

            {entries.length > 0 && (
              <>
                <div className="overline" style={{ marginBottom: 8 }}>{lang === 'tl' ? 'Mga Resulta' : 'Results'}</div>
                <div className="stack" style={{ marginBottom: 14 }}>
                  {entries.map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
                      <span style={{ color: 'var(--muted)', fontWeight: 600, textTransform: 'capitalize', fontSize: '0.9em' }}>{String(k).replace(/_/g, ' ')}</span>
                      <span style={{ fontWeight: 700, textAlign: 'right', wordBreak: 'break-word' }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="overline" style={{ marginTop: 4, marginBottom: 8 }}>{lang === 'tl' ? 'Pinagmulan at Verification' : 'Source & Verification'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
              <ShieldTick size={18} color="var(--teal)" />
              <span style={{ color: 'var(--muted)' }}>{c.verifiedFrom} <b style={{ color: 'var(--ink)' }}>{record.source}</b></span>
            </div>
            {detail?.anchor && (
              <div className="card" style={{ background: 'var(--line-2)', border: 'none', fontSize: '0.82em', color: 'var(--muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{lang === 'tl' ? 'Fingerprint' : 'Content hash'}</span><span className="mono" style={{ color: 'var(--ink)' }}>{short(detail.anchor.hash)}</span></div>
                {detail.anchor.txHash && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}><span>{lang === 'tl' ? 'Chain tx' : 'Chain tx'}</span><span className="mono" style={{ color: 'var(--ink)' }}>{short(detail.anchor.txHash)}</span></div>}
                {detail.anchor.anchoredAt && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}><span>{lang === 'tl' ? 'Naka-anchor noong' : 'Anchored at'}</span><span style={{ color: 'var(--ink)' }}>{formatDate(detail.anchor.anchoredAt, lang)}</span></div>}
                {verify && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                    <span>{lang === 'tl' ? 'Katunayan' : 'Integrity'}</span>
                    <span style={{ color: verify.integrityOk ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                      {verify.integrityOk ? (lang === 'tl' ? 'Hindi binago' : 'Untampered') : (lang === 'tl' ? 'Nabago' : 'Tampered')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: 16 }}>
          <Btn variant="secondary" onClick={onClose}>{lang === 'tl' ? 'Isara' : 'Close'}</Btn>
        </div>
      </div>
    </div>
  );
}
