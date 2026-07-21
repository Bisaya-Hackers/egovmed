import { ScreenHeader, Btn } from '../components/ui.jsx';
import { Hospital, Check } from '../components/Icons.jsx';
import { SLOTS, CONST } from '../i18n/dict.js';

export default function Book({ c, lang, S, A }) {
  const slots = SLOTS[lang];
  const dept = S.triage?.specialty || CONST.dept;

  return (
    <div className="screen">
      <ScreenHeader onBack={A.back} step={4} label={c.stepBook} />
      <h1 className="h1" data-stagger>{c.bookTitle}</h1>

      {/* hospital card */}
      <div className="card" data-stagger style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--teal-50)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <Hospital size={24} />
        </span>
        <div>
          <div style={{ fontWeight: 800 }}>{CONST.hospital}</div>
          <div style={{ fontSize: '0.85em', fontWeight: 700, color: 'var(--teal)', marginTop: 2 }}>{c.deptPre}: {dept}</div>
        </div>
      </div>

      <div className="overline" style={{ marginTop: 22, marginBottom: 10 }}>{c.pickSlot}</div>

      {S.slotsLoading ? (
        <div className="stack" role="status">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 14 }} />)}
          <p className="sub" style={{ textAlign: 'center' }}>{c.loadingSlots}</p>
        </div>
      ) : (
        <div className="stack">
          {slots.map((s, i) => {
            const disabled = s[2];
            const sel = S.selectedSlot === i;
            return (
              <button
                key={i}
                disabled={disabled}
                onClick={() => A.selectSlot(i)}
                aria-pressed={sel}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  borderRadius: 14, padding: '15px 16px', minHeight: 60,
                  border: disabled ? '1.5px solid var(--line-2)' : sel ? '2px solid var(--primary)' : '1.5px solid var(--line)',
                  background: disabled ? 'var(--line-2)' : sel ? 'var(--blue-50)' : 'var(--surface)',
                  color: disabled ? '#9aa6ba' : 'var(--ink)',
                }}
              >
                <span>
                  <span style={{ display: 'block', fontWeight: 700 }}>{s[0]}</span>
                  <span style={{ display: 'block', fontSize: '0.82em', color: 'var(--muted)' }}>{s[1]}</span>
                </span>
                <span style={{ width: 22, height: 22, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: sel ? 'var(--primary)' : 'transparent', border: sel ? 'none' : '2px solid var(--line)' }}>
                  {sel && <Check size={14} color="#fff" />}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Btn disabled={S.selectedSlot == null || S.booking} onClick={() => A.doBook(slots[S.selectedSlot]?.[0])}>
          {S.booking ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><span className="spinner white" /> {c.booking}</span> : c.confirmBook}
        </Btn>
      </div>
    </div>
  );
}
