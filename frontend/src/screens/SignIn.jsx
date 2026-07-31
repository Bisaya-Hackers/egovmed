import { useState } from 'react';
import PinInput from '../components/PinInput.jsx';
import { Fingerprint } from '../components/Icons.jsx';
import communityArt from '../assets/signin-filipino-community.png';
import ProfileSetup from '../components/ProfileSetup.jsx';

export default function SignIn({ c, S, A }) {
  const live = S.authMode === 'live';
  const loading = S.authMode === 'loading';
  // Set when the landing URL carried an eGovPH exchange code. The code is spent by this button
  // and nowhere else, so a link prefetch can never consume it (see the mount effect in App.jsx).
  const codeReady = !!S.pendingExchangeCode;
  const [mpin, setMpin] = useState(['', '', '', '', '', '']);
  const [editingProfile, setEditingProfile] = useState(false);
  const onChange = (arr) => {
    setMpin(arr);
    if (arr.every((d) => d)) setTimeout(() => A.doSignIn(), 260);
  };

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <h1 className="h1" style={{ marginTop: 20 }} data-stagger>{c.welcomeBack}</h1>
      <p className="sub" data-stagger>
        {live ? 'Continue securely through your eGovPH account.' : c.mpinPrompt}
      </p>

      {!live && !loading && (
        <>
          <div data-stagger style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: '0.92em' }}>{c.mpinLabel}</span>
            <button className="btn ghost" style={{ width: 'auto' }} onClick={() => setMpin(['', '', '', '', '', ''])}>{c.clearLabel}</button>
          </div>
          <div data-stagger>
            <PinInput values={mpin} onChange={onChange} masked autoFocus ariaLabel={c.mpinLabel} />
          </div>
        </>
      )}

      {S.signingIn ? (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginTop: 18, color: 'var(--muted)', fontWeight: 600 }}>
          <span className="spinner" /> <span>{c.signingIn}</span>
        </div>
      ) : !live && !loading ? (
        <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => A.toast(c.forgotMpin)}>{c.forgotMpin}</button>
      ) : null}

      <div className="rowsep" style={{ margin: '20px 0' }} />

      {codeReady && (
        <p className="sub" data-stagger style={{ textAlign: 'center', marginBottom: 12, fontWeight: 650, color: 'var(--ink)' }}>
          {c.ssoCodeReady}
        </p>
      )}

      <button
        data-stagger
        onClick={A.doSignIn}
        disabled={loading || S.signingIn}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', minHeight: 56, border: '1.5px solid var(--line)', background: 'var(--canvas)', color: 'var(--ink)', borderRadius: 16, fontWeight: 700 }}
      >
        {loading || S.signingIn ? <span className="spinner" /> : <Fingerprint size={22} color="var(--primary)" />}
        <span>{loading ? 'Checking eGovPH…' : (live || codeReady) ? 'Continue with eGovPH' : c.fingerprint}</span>
      </button>

      {S.flowError && (
        <div role="alert" className="card" style={{ marginTop: 14, color: 'var(--red)', fontWeight: 650, fontSize: '0.9em' }}>
          {/* Backend messages arrive in English only, so the ones we have our own wording for
              re-resolve here and follow the EN/TL toggle. The rest show exactly what the server said. */}
          {(S.flowErrorKey && c[S.flowErrorKey]) || S.flowError}
        </div>
      )}

      {live && !codeReady && !S.authLaunchUrl && !S.flowError && (
        <p className="sub" style={{ textAlign: 'center', marginTop: 14 }}>
          Launch eGovMed from the eGovPH app to sign in.
        </p>
      )}

      {/* "Not you?" is a question, so the answer has to be "then set who I am". It used to toast
          its own label; now it opens the two fields that actually decide whose profile this is.
          Mock mode only — a live eGovPH session brings its own PhilSys-backed identity. */}
      {!live && (editingProfile ? (
        <ProfileSetup
          c={c}
          onCancel={() => setEditingProfile(false)}
          onSaved={(patient) => { setEditingProfile(false); A.onPatientUpdated(patient); A.toast(c.contactSaved); }}
        />
      ) : (
        <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setEditingProfile(true)}>
          {c.notYou} {c.switchAccount}
        </button>
      ))}

      <div className="spacer" style={{ minHeight: 16 }} />
      <img
        src={communityArt}
        alt=""
        style={{ width: 'calc(100% + 44px)', height: 150, margin: '0 -22px -28px', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}
