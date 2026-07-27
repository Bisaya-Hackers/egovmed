import { useState } from 'react';
import PinInput from '../components/PinInput.jsx';
import { Btn } from '../components/ui.jsx';
import { Fingerprint, Phone } from '../components/Icons.jsx';
import { maskPhone } from '../lib/phone.js';
import communityArt from '../assets/signin-filipino-community.png';

export default function SignIn({ c, S, A }) {
  const live = S.authMode === 'live';
  const loading = S.authMode === 'loading';
  const [mpin, setMpin] = useState(['', '', '', '', '', '']);
  const onChange = (arr) => {
    setMpin(arr);
    if (arr.every((d) => d)) setTimeout(() => A.doSignIn(), 260);
  };

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ textAlign: 'center', marginTop: 6 }}>
        <span className="wm" style={{ fontSize: 26 }}>eGOV<span className="med">MED</span></span>
      </div>

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
        <button className="btn ghost" style={{ marginTop: 14 }} disabled={S.mpinResetSending} onClick={A.forgotMpin}>
          {S.mpinResetSending
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><span className="spinner" /> {c.mpinResetSending}</span>
            : c.forgotMpin}
        </button>
      ) : null}

      <div className="rowsep" style={{ margin: '20px 0' }} />

      <button
        data-stagger
        onClick={A.doSignIn}
        disabled={loading || S.signingIn}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', minHeight: 56, border: '1.5px solid var(--line)', background: 'var(--canvas)', color: 'var(--ink)', borderRadius: 16, fontWeight: 700 }}
      >
        {loading || S.signingIn ? <span className="spinner" /> : <Fingerprint size={22} color="var(--primary)" />}
        <span>{loading ? 'Checking eGovPH…' : live ? 'Continue with eGovPH' : c.fingerprint}</span>
      </button>

      {S.flowError && (
        <div role="alert" className="card" style={{ marginTop: 14, color: 'var(--red)', fontWeight: 650, fontSize: '0.9em' }}>
          {S.flowError}
        </div>
      )}

      {live && !S.authLaunchUrl && !S.flowError && (
        <p className="sub" style={{ textAlign: 'center', marginTop: 14 }}>
          Launch eGovMed from the eGovPH app to sign in.
        </p>
      )}

      {!live && !S.switchingAccount && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, color: 'var(--muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 999, padding: '7px 14px', fontSize: '0.9em', fontWeight: 600 }}>
          <Phone size={16} /> {maskPhone(S.signInPhone)}
        </span>
      </div>}
      {!live && !S.switchingAccount && <button className="btn ghost" style={{ marginTop: 10 }} onClick={A.openSwitchAccount}>
        {c.notYou} {c.switchAccount}
      </button>}

      {!live && S.switchingAccount && (
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700 }}>{c.switchAccountTitle}</div>
          <p className="sub" style={{ margin: '4px 0 0' }}>{c.switchAccountSub}</p>

          <div className="overline" style={{ marginTop: 14, marginBottom: 8 }}>{c.switchPhoneLabel}</div>
          <input
            className="field" type="tel" inputMode="tel" autoComplete="tel" autoFocus
            value={S.switchPhone}
            onChange={(e) => A.setSwitchPhone(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') A.confirmSwitchAccount(); }}
            placeholder={c.switchPhonePlaceholder}
            aria-label={c.switchPhoneLabel}
            aria-invalid={S.switchPhoneErr || undefined}
            aria-describedby={S.switchPhoneErr ? 'switch-phone-err' : undefined}
          />
          {S.switchPhoneErr && (
            <div id="switch-phone-err" role="alert" style={{ marginTop: 8, color: 'var(--red)', background: 'var(--red-50)', borderRadius: 14, padding: '10px 12px', fontSize: '0.85em', fontWeight: 600 }}>
              {c.phoneInvalid}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={A.cancelSwitchAccount}>{c.switchAccountCancel}</button>
            <Btn style={{ flex: 1 }} disabled={!S.switchPhone.trim()} onClick={A.confirmSwitchAccount}>{c.switchAccountConfirm}</Btn>
          </div>
        </div>
      )}

      <div className="spacer" style={{ minHeight: 16 }} />
      <img
        src={communityArt}
        alt=""
        style={{ width: 'calc(100% + 44px)', height: 150, margin: '0 -22px -28px', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}
