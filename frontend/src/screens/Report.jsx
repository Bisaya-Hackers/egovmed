import { useEffect, useRef, useState } from 'react';
import { ScreenHeader, Btn } from '../components/ui.jsx';
import PinInput from '../components/PinInput.jsx';
import { Check, Warning } from '../components/Icons.jsx';
import { Pop } from '../components/anim.jsx';
import { CATS, TRACK, TRACKNOTE } from '../i18n/dict.js';

// Map whatever status the case is in (mock always returns "open"; live eReport can also
// return in_review/assigned/resolved/escalated) onto the 4-step tracker used for a fresh filing.
const STATUS_STEP = { open: 0, in_review: 1, assigned: 2, resolved: 3, escalated: 1 };
const STATUS_KEY = { open: 'statusOpen', in_review: 'statusInReview', assigned: 'statusAssigned', resolved: 'statusResolved', escalated: 'statusEscalated' };

// Rows come from GET /reports, which returns summaries only (no description) — enough to pick a
// case without having written its number down, which is the whole point of the list.
function MyReportRow({ c, lang, report, active, onPick }) {
  const status = String(report.status || '').toLowerCase();
  const statusLabel = c[STATUS_KEY[status]] || report.status;
  // Categories are stored in English (that's what gets filed upstream), so map back through
  // CATS for display. Falls through to the raw value for anything live eReport returns that
  // isn't one of ours.
  const catIndex = CATS.en.indexOf(report.category);
  const catLabel = catIndex === -1 ? report.category : CATS[lang][catIndex];
  const filed = new Date(report.createdAt);
  const when = Number.isNaN(filed.getTime()) ? '' : filed.toLocaleDateString(lang === 'tl' ? 'fil-PH' : 'en-PH', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <button
      onClick={() => onPick(report.caseNumber)}
      aria-label={`${report.caseNumber}, ${catLabel}, ${statusLabel}`}
      style={{
        width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 14, background: 'var(--surface)', cursor: 'pointer',
        border: active ? '2px solid var(--primary)' : '1.5px solid var(--line)',
      }}
    >
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="mono" style={{ display: 'block', fontWeight: 700, letterSpacing: '0.04em', overflowWrap: 'anywhere' }}>{report.caseNumber}</span>
        <span className="sub" style={{ display: 'block', margin: '2px 0 0' }}>
          {catLabel}{when ? ` · ${when}` : ''}
        </span>
      </span>
      <span className={`pill ${status === 'escalated' ? 'amber' : status === 'resolved' ? 'green' : 'blue'}`} style={{ flex: 'none' }}>{statusLabel}</span>
    </button>
  );
}

// Vertical step tracker, shared by the just-filed confirmation and the status-check result.
function Tracker({ lang, stepIndex }) {
  return (
    <div data-stagger className="card" style={{ marginTop: 12 }}>
      {TRACK[lang].map((label, i) => {
        const done = i < stepIndex, current = i === stepIndex;
        return (
          <div key={i} style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? 'var(--green)' : current ? 'var(--blue)' : 'var(--line)', boxShadow: current ? '0 0 0 4px var(--blue-50)' : 'none' }}>
                {done && <Check size={15} color="#fff" />}
              </span>
              {i < 3 && <span style={{ width: 2, flex: 1, minHeight: 22, background: done ? 'var(--green)' : 'var(--line)' }} />}
            </div>
            <div style={{ paddingBottom: 16 }}>
              <div style={{ fontWeight: 700, color: current ? 'var(--blue)' : done ? 'var(--ink)' : 'var(--muted)' }}>{label}</div>
              <div className="sub" style={{ margin: '2px 0 0' }}>{TRACKNOTE[lang][i]}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Report({ c, lang, S, set, A }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendSecs, setResendSecs] = useState(30);
  const resendTimer = useRef(null);

  const startResendCountdown = () => {
    if (resendTimer.current) clearInterval(resendTimer.current);
    setResendSecs(30);
    resendTimer.current = setInterval(() => {
      setResendSecs((s) => {
        if (s <= 1) { clearInterval(resendTimer.current); resendTimer.current = null; return 0; }
        return s - 1;
      });
    }, 1000);
  };

  // Start (and restart on re-entry) the 30s resend countdown whenever the OTP step is shown.
  useEffect(() => {
    if (S.reportStage === 'otp') startResendCountdown();
    return () => { if (resendTimer.current) { clearInterval(resendTimer.current); resendTimer.current = null; } };
  }, [S.reportStage]);

  const handleResend = () => {
    if (resendSecs > 0) return;
    setOtp(['', '', '', '', '', '']);
    startResendCountdown();
    A.toast(c.resendSent);
  };

  if (S.reportStage === 'track') {
    const result = S.trackResult;
    const stepIndex = result ? (STATUS_STEP[String(result.status || '').toLowerCase()] ?? 0) : 0;
    const escalated = String(result?.status || '').toLowerCase() === 'escalated';
    return (
      <div className="screen" key={S.reportStage}>
        <ScreenHeader onBack={() => set({ reportStage: 'form' })} label={c.trackTitle} />
        <h1 className="h1" data-stagger>{c.trackTitle}</h1>
        <p className="sub" data-stagger>{c.trackSub}</p>

        <div className="overline" data-stagger style={{ marginTop: 20, marginBottom: 10 }}>{c.myReportsLabel}</div>
        {/* One data-stagger wrapper that is always present, so the list arriving asynchronously
            never changes the set of elements the screen-entry stagger is animating. */}
        <div data-stagger>
          {S.myReportsLoading ? (
            <div className="sub" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="spinner" /> {c.myReportsLoadingText}
            </div>
          ) : S.myReports.length === 0 ? (
            <div className="sub">{c.myReportsEmpty}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {S.myReports.map((r) => (
                <MyReportRow
                  key={r.id} c={c} lang={lang} report={r}
                  active={r.caseNumber === S.trackCaseNo}
                  onPick={A.trackMyReport}
                />
              ))}
            </div>
          )}
        </div>

        <div className="overline" data-stagger style={{ marginTop: 20, marginBottom: 10 }}>{c.trackManualLabel}</div>
        <input
          data-stagger className="field mono" value={S.trackCaseNo}
          onChange={(e) => A.setTrackCaseNo(e.target.value)}
          placeholder={c.caseNumberPlaceholder} aria-label={c.caseNumberLabel}
          style={{ letterSpacing: '0.04em' }}
        />
        {S.trackError && (
          <div data-stagger style={{ display: 'flex', gap: 9, marginTop: 10, color: 'var(--red)', background: 'var(--red-50)', borderRadius: 14, padding: '12px 14px', fontSize: '0.85em', fontWeight: 600 }} role="alert">
            <Warning size={18} />
            <span>{S.trackError === 'invalid' ? c.trackInvalid : c.trackNotFound}</span>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <Btn disabled={!S.trackCaseNo.trim() || S.trackLoading} onClick={A.submitTrackCase}>
            {S.trackLoading ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><span className="spinner white" /> {c.trackChecking}</span> : c.trackButton}
          </Btn>
        </div>

        {result && (
          <>
            <div data-stagger className="card" style={{ marginTop: 18, textAlign: 'center' }}>
              <div className="overline">{c.caseLabel}</div>
              <div className="mono" style={{ fontSize: '1.3em', fontWeight: 700, letterSpacing: '0.06em', marginTop: 6 }}>{result.caseNumber}</div>
              {escalated && <span className="pill amber" style={{ marginTop: 10 }}>{c.statusEscalated}</span>}
            </div>
            <Tracker lang={lang} stepIndex={stepIndex} />
            <button
              data-stagger onClick={() => set({ trackCaseNo: '', trackResult: null, trackError: null })}
              style={{ background: 'none', border: 'none', padding: 0, marginTop: 4, color: 'var(--primary)', fontWeight: 700, fontSize: '0.9em', textDecoration: 'underline' }}
            >
              {c.trackAnother}
            </button>
          </>
        )}
      </div>
    );
  }

  if (S.reportStage === 'filed') {
    return (
      <div className="screen" key={S.reportStage}>
        <div style={{ textAlign: 'center', marginTop: 12 }} role="status">
          <Pop className="checkdisc"><Check size={40} /></Pop>
          <h1 className="h1" style={{ marginTop: 18 }}>{c.caseTitle}</h1>
        </div>

        <div data-stagger className="card" style={{ marginTop: 18, textAlign: 'center' }}>
          <div className="overline">{c.caseLabel}</div>
          <div className="mono" style={{ fontSize: '1.5em', fontWeight: 700, letterSpacing: '0.06em', marginTop: 6 }}>{S.caseNo}</div>
        </div>

        {/* vertical tracker */}
        <Tracker lang={lang} stepIndex={1} />

        <div data-stagger style={{ display: 'flex', gap: 9, marginTop: 12, color: 'var(--amber)', background: 'var(--amber-50)', borderRadius: 14, padding: '12px 14px', fontSize: '0.85em', fontWeight: 600 }} role="note">
          {c.escalation}
        </div>

        <div style={{ marginTop: 18 }}>
          <Btn variant="secondary" onClick={A.resetToHome}>{c.backHome}</Btn>
        </div>
      </div>
    );
  }

  if (S.reportStage === 'otp') {
    const ready = otp.every((d) => d);
    return (
      <div className="screen" key={S.reportStage}>
        <ScreenHeader onBack={() => set({ reportStage: 'form' })} label={c.otpTitle} />
        <h1 className="h1" data-stagger>{c.otpTitle}</h1>
        <p className="sub" data-stagger>{c.otpSub}</p>
        <div data-stagger style={{ marginTop: 20 }}>
          <PinInput values={otp} onChange={setOtp} autoFocus ariaLabel={c.otpTitle} />
        </div>
        <button className="btn ghost" style={{ marginTop: 14 }} disabled={resendSecs > 0} onClick={handleResend}>
          {resendSecs > 0 ? `${c.resendPrefix} 0:${String(resendSecs).padStart(2, '0')}` : c.resendReady}
        </button>
        <div style={{ marginTop: 12 }}>
          <Btn disabled={!ready} onClick={() => A.verifyOtp(CATS.en[S.reportCat])}>{c.verifyOtp}</Btn>
        </div>
      </div>
    );
  }

  // form stage
  const canSubmit = S.reportCat != null && S.reportDesc.trim();
  return (
    <div className="screen" key={S.reportStage}>
      <ScreenHeader onBack={A.back} label={c.reportTitle} />
      <h1 className="h1" data-stagger>{c.reportTitle}</h1>
      <p className="sub" data-stagger>{c.reportSub}</p>
      <button
        data-stagger onClick={A.openTrackReport}
        style={{ background: 'none', border: 'none', padding: 0, marginTop: 4, color: 'var(--primary)', fontWeight: 700, fontSize: '0.9em', textDecoration: 'underline' }}
      >
        {c.reportTrackLink}
      </button>

      <div className="overline" data-stagger style={{ marginTop: 20, marginBottom: 10 }}>{c.reportCatLabel}</div>
      <div data-stagger style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {CATS[lang].map((label, i) => {
          const sel = S.reportCat === i;
          return (
            <button
              key={i}
              onClick={() => A.setCat(i)}
              aria-pressed={sel}
              style={{ borderRadius: 999, padding: '10px 16px', fontWeight: 700, fontSize: '0.9em', border: sel ? '2px solid var(--primary)' : '1.5px solid var(--line)', background: sel ? 'var(--blue-50)' : 'var(--surface)', color: sel ? 'var(--primary)' : 'var(--ink)' }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="overline" data-stagger style={{ marginTop: 20, marginBottom: 10 }}>{c.descLabel}</div>
      <textarea data-stagger className="field" style={{ minHeight: 130 }} value={S.reportDesc} onChange={(e) => A.setDesc(e.target.value)} placeholder={c.descPlaceholder} aria-label={c.descLabel} />

      <div style={{ marginTop: 18 }}>
        <Btn disabled={!canSubmit} onClick={A.submitReport}>{c.submitReport}</Btn>
      </div>
    </div>
  );
}
