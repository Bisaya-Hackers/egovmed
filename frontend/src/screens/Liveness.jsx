import { ScreenHeader, Btn } from '../components/ui.jsx';
import { User, Check } from '../components/Icons.jsx';
import { Pop } from '../components/anim.jsx';

export default function Liveness({ c, S, A }) {
  const verified = S.liveness === 'verified';
  const verifying = S.liveness === 'verifying';
  const failed = S.liveness === 'failed';

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 'calc(100vh - 96px)' }}>
      <div style={{ width: '100%' }}>
        <ScreenHeader onBack={A.back} step={3} label={c.stepVerify} />
      </div>

      {!verified && !failed && (
        <>
          <h1 className="h1" style={{ textAlign: 'center', marginTop: 8 }}>{c.livenessLook}</h1>
          <p className="sub" style={{ textAlign: 'center' }}>{c.livenessSubLook}</p>
        </>
      )}

      <div className="spacer" style={{ minHeight: 20 }} />

      {verified ? (
        <div style={{ textAlign: 'center' }} role="status" aria-live="polite">
          <Pop className="checkdisc"><Check size={40} /></Pop>
          <h2 className="h2" style={{ marginTop: 18 }}>{c.verified}</h2>
          <p className="sub">{c.verifiedSub}</p>
        </div>
      ) : failed ? (
        <div role="alert" className="card" style={{ width: '100%', textAlign: 'center' }}>
          <h2 className="h2">Verification was not completed</h2>
          <p className="sub" style={{ color: 'var(--red)', marginTop: 8 }}>{S.flowError || 'Please try the liveness check again.'}</p>
          <div style={{ marginTop: 18 }}><Btn onClick={A.retryLiveness}>Try again</Btn></div>
        </div>
      ) : (
        <div role="status" aria-live="polite" style={{ position: 'relative', width: 230, height: 230, borderRadius: '50%', background: '#D3E0F5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: `0 0 0 4px ${verifying ? 'var(--blue-50)' : 'var(--teal-50)'}` }}>
          <User size={120} color="#9db6da" />
          {verifying ? (
            <span className="spinner lg" style={{ position: 'absolute' }} />
          ) : (
            <span style={{ position: 'absolute', left: '8%', right: '8%', height: 3, background: 'var(--teal)', borderRadius: 3, boxShadow: '0 0 12px var(--teal)', animation: 'scanline 1.6s ease-in-out infinite alternate' }} />
          )}
        </div>
      )}

      {!verified && !failed && (
        <p className="sub" style={{ textAlign: 'center', marginTop: 18, fontWeight: 600 }}>{verifying ? c.livenessVerifying : c.livenessHold}</p>
      )}

      <div className="spacer" style={{ minHeight: 20 }} />
      {verified && (
        <div style={{ width: '100%' }}>
          <Btn onClick={A.goBook}>{c.continue}</Btn>
        </div>
      )}
    </div>
  );
}
