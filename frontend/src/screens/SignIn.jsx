import { useState } from 'react';
import PinInput from '../components/PinInput.jsx';
import { Fingerprint, Phone } from '../components/Icons.jsx';
import { CONST } from '../i18n/dict.js';

export default function SignIn({ c, S, A }) {
  const [mpin, setMpin] = useState(['', '', '', '', '', '']);
  const onChange = (arr) => {
    setMpin(arr);
    if (arr.every((d) => d)) setTimeout(() => A.doSignIn(), 260);
  };

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 96px)' }}>
      <div style={{ textAlign: 'center', marginTop: 6 }}>
        <span className="wm" style={{ fontSize: 26 }}>eGOV<span className="med">MED</span></span>
      </div>

      <h1 className="h1" style={{ marginTop: 20 }} data-stagger>{c.welcomeBack}</h1>
      <p className="sub" data-stagger>{c.mpinPrompt}</p>

      <div data-stagger style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: '0.92em' }}>{c.mpinLabel}</span>
        <button className="btn ghost" style={{ width: 'auto' }} onClick={() => setMpin(['', '', '', '', '', ''])}>{c.clearLabel}</button>
      </div>
      <div data-stagger>
        <PinInput values={mpin} onChange={onChange} masked autoFocus ariaLabel={c.mpinLabel} />
      </div>

      {S.signingIn ? (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginTop: 18, color: 'var(--muted)', fontWeight: 600 }}>
          <span className="spinner" /> <span>{c.signingIn}</span>
        </div>
      ) : (
        <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => A.toast(c.forgotMpin)}>{c.forgotMpin}</button>
      )}

      <div className="rowsep" style={{ margin: '20px 0' }} />

      <button
        data-stagger
        onClick={A.doSignIn}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', minHeight: 56, border: '1.5px solid var(--line)', background: 'var(--canvas)', color: 'var(--ink)', borderRadius: 16, fontWeight: 700 }}
      >
        <Fingerprint size={22} color="var(--primary)" /> <span>{c.fingerprint}</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, color: 'var(--muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 999, padding: '7px 14px', fontSize: '0.9em', fontWeight: 600 }}>
          <Phone size={16} /> {CONST.phone}
        </span>
      </div>
      <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => A.toast(c.switchAccount)}>
        {c.notYou} {c.switchAccount}
      </button>

      <div className="spacer" style={{ minHeight: 16 }} />
      <div className="img-slot" style={{ height: 150, margin: '0 -22px -28px', background: 'var(--sun)', color: '#8a6d00' }} aria-hidden="true">
        Filipino illustration
      </div>
    </div>
  );
}
