import { useEffect, useRef, useState } from 'react';
import { ScreenHeader, Btn } from '../components/ui.jsx';
import { User, Check } from '../components/Icons.jsx';
import { Pop } from '../components/anim.jsx';

export default function Liveness({ c, S, A }) {
  const verified = S.liveness === 'verified';
  const verifying = S.liveness === 'verifying';
  const failed = S.liveness === 'failed';
  // The patient closed the eVerify SDK's capture window themselves. Deliberately NOT `failed`:
  // nothing was checked and rejected, so this gets a calm status card, not the red alert.
  const cancelled = S.liveness === 'cancelled';
  const capturing = !verified && !failed && !cancelled; // camera circle + "hold still" copy
  const videoRef = useRef(null);
  const [camera, setCamera] = useState('idle'); // 'idle' | 'live' | 'denied' | 'unavailable'

  // Real camera preview during the liveness capture (works in mock too, so the flow feels live).
  // In LIVE Face Liveness mode the browser will instead redirect to Amazon's hosted UI which
  // opens its own camera — this preview short-circuits before that redirect anyway.
  useEffect(() => {
    if (S.liveness !== 'capturing' && S.liveness !== 'verifying') return undefined;
    // The eVerify Web SDK opens its own camera capture UI — running this preview at the same
    // time would fight it for the camera device.
    if (import.meta.env.VITE_EVERIFY_SDK_ENABLED === 'true') return undefined;
    if (!navigator.mediaDevices?.getUserMedia) { setCamera('unavailable'); return undefined; }
    let stream, cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamera('live');
      } catch (err) {
        setCamera(err && err.name === 'NotAllowedError' ? 'denied' : 'unavailable');
      }
    })();
    return () => { cancelled = true; if (stream) stream.getTracks().forEach((t) => t.stop()); setCamera('idle'); };
  }, [S.liveness]);

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
      <div style={{ width: '100%' }}>
        <ScreenHeader onBack={A.back} step={3} label={c.stepVerify} />
      </div>

      {capturing && (
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
      ) : cancelled ? (
        <div role="status" aria-live="polite" className="card" style={{ width: '100%', textAlign: 'center' }}>
          <h2 className="h2">{c.livenessCancelled}</h2>
          <p className="sub" style={{ marginTop: 8 }}>{c.livenessCancelledSub}</p>
          <div style={{ marginTop: 18 }}><Btn onClick={A.retryLiveness}>{c.livenessTryAgain}</Btn></div>
          <div style={{ marginTop: 10 }}><Btn variant="secondary" onClick={A.declineConsent}>{c.consentDecline}</Btn></div>
        </div>
      ) : failed ? (
        <div role="alert" className="card" style={{ width: '100%', textAlign: 'center' }}>
          <h2 className="h2">Verification was not completed</h2>
          <p className="sub" style={{ color: 'var(--red)', marginTop: 8 }}>{S.flowError || 'Please try the liveness check again.'}</p>
          <div style={{ marginTop: 18 }}><Btn onClick={A.retryLiveness}>{c.livenessTryAgain}</Btn></div>
        </div>
      ) : (
        <div role="status" aria-live="polite" style={{ position: 'relative', width: 230, height: 230, borderRadius: '50%', background: '#D3E0F5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: `0 0 0 4px ${verifying ? 'var(--blue-50)' : 'var(--teal-50)'}` }}>
          {camera === 'live' ? (
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          ) : (
            <User size={120} color="#9db6da" />
          )}
          {verifying ? (
            <span className="spinner lg" style={{ position: 'absolute' }} />
          ) : (
            <span style={{ position: 'absolute', left: '8%', right: '8%', height: 3, background: 'var(--teal)', borderRadius: 3, boxShadow: '0 0 12px var(--teal)', animation: 'scanline 1.6s ease-in-out infinite alternate' }} />
          )}
        </div>
      )}
      {camera === 'denied' && capturing && (
        <p className="sub" style={{ textAlign: 'center', marginTop: 8, fontSize: '0.85em', color: 'var(--amber)' }}>
          Camera permission was blocked. The flow will continue in demo mode.
        </p>
      )}

      {capturing && (
        <p className="sub" style={{ textAlign: 'center', marginTop: 18, fontWeight: 600 }}>{verifying ? c.livenessVerifying : c.livenessHold}</p>
      )}

      <div className="spacer" style={{ minHeight: 20 }} />
      {verified && (
        <div style={{ width: '100%' }}>
          <Btn onClick={A.continueAfterVerify}>{S.verifyReturnTo === 'records' ? c.recordsLockedBackToRecords : c.continue}</Btn>
        </div>
      )}
    </div>
  );
}
