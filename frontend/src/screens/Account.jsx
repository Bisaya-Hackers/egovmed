import { useEffect, useState } from 'react';
import { ScreenHeader, Btn } from '../components/ui.jsx';
import { Check, ShieldTick, User, Plus, ChevronRight } from '../components/Icons.jsx';
import { api } from '../lib/api.js';
import rosaAvatar from '../assets/home-avatar-rosa.png';

const displayName = (patient) => [patient?.firstName, patient?.middleName, patient?.lastName].filter(Boolean).join(' ');

// Real Philippine benefit/discount programs a patient could plausibly have. All of them are now
// wired into the eGovPay benefit engine (see backend paymentService.BENEFIT_RULES) and get a
// working "Add" button — keep this list in sync with BENEFIT_RULES/SUPPORTED_BENEFITS.
const BENEFIT_CATALOG = [
  { key: 'philhealth', label: 'PhilHealth' },
  { key: 'whiteCard', label: 'White Card (indigent)' },
  { key: 'sss', label: 'SSS' },
  { key: 'gsis', label: 'GSIS' },
  { key: 'pagibig', label: 'Pag-IBIG Fund' },
  { key: 'fourps', label: '4Ps (Pantawid Pamilyang Pilipino Program)' },
  { key: 'pwd', label: 'PWD ID discount' },
  { key: 'senior', label: 'Senior Citizen discount' },
  { key: 'soloParent', label: 'Solo Parent ID discount' },
  { key: 'owwa', label: 'OWWA' },
  { key: 'ecc', label: 'ECC (Employees\u2019 Compensation)' },
  { key: 'aics', label: 'DSWD AICS' },
];
const WIRED_BENEFIT_KEYS = BENEFIT_CATALOG.map((b) => b.key);

function BenefitRow({ label, active, c }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      <span className={active ? 'pill green' : 'pill'} style={active ? undefined : { background: 'var(--line-2)', color: 'var(--muted)' }}>
        {active && <Check size={13} />}{active ? c.benefitOn : c.benefitOff}
      </span>
    </div>
  );
}

// Row shown inside the "add a benefit" catalog — already-active benefits are filtered out
// before this renders, so it only ever needs a working Add button (wired programs) or a muted
// "Coming soon" fallback (any program not yet in BENEFIT_RULES).
function CatalogRow({ label, wired, busy, onAdd, c }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      {wired ? (
        <button onClick={onAdd} disabled={busy} className="chip add" style={{ fontWeight: 800, padding: '6px 12px', fontSize: '0.85em' }}>
          {busy ? c.benefitAdding : c.benefitAdd}
        </button>
      ) : (
        <span className="pill" style={{ background: 'var(--line-2)', color: 'var(--muted)' }}>{c.benefitComingSoon}</span>
      )}
    </div>
  );
}

export default function Account({ c, S, A }) {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showAddBenefit, setShowAddBenefit] = useState(false);
  const [addingKey, setAddingKey] = useState(null);

  useEffect(() => {
    let alive = true;
    api.me()
      .then((profile) => { if (alive) setPatient(profile); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const handleAddBenefit = async (key) => {
    if (addingKey) return;
    setAddingKey(key);
    try {
      const updated = await api.activateBenefit(key);
      setPatient(updated);
      A.toast(S.lang === 'tl' ? 'Idinagdag ang benepisyo' : 'Benefit added');
    } catch {
      A.toast(S.lang === 'tl' ? 'Hindi maidagdag ang benepisyo' : 'Couldn\u2019t add that benefit');
    } finally {
      setAddingKey(null);
    }
  };

  const activeBenefits = BENEFIT_CATALOG.filter((b) => patient?.benefits?.[b.key]);
  const addableBenefits = BENEFIT_CATALOG.filter((b) => !patient?.benefits?.[b.key]);

  return (
    <div className="screen">
      <ScreenHeader onBack={A.back} label={c.navAccount} />
      <h1 className="h1" data-stagger>{c.accountTitle}</h1>
      <p className="sub" data-stagger>{c.accountSub}</p>

      {loading ? (
        <div className="card" style={{ marginTop: 18, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
          <span className="spinner" aria-hidden="true" />
          <span className="sub" style={{ margin: 0 }}>{c.accountLoading}</span>
        </div>
      ) : error ? (
        <div className="card" role="alert" style={{ marginTop: 18, textAlign: 'center' }}>
          <User size={28} color="var(--muted)" />
          <div style={{ marginTop: 8, fontWeight: 700 }}>{c.accountError}</div>
          <Btn variant="secondary" onClick={A.logout} style={{ marginTop: 14 }}>{c.accountSignInAgain}</Btn>
        </div>
      ) : (
        <>
          <div className="overline" style={{ marginTop: 20, marginBottom: 9 }}>{c.accountProfile}</div>
          <section data-stagger className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <img src={rosaAvatar} alt="" style={{ width: 62, height: 62, objectFit: 'cover', borderRadius: '50%', flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '1.08em', fontWeight: 800 }}>{displayName(patient) || c.notAvailable}</div>
                {patient.identityVerified && <span className="pill green" style={{ marginTop: 6 }}><ShieldTick size={14} /> {c.verifiedBadge}</span>}
              </div>
            </div>
            <div className="rowsep" />
            <div className="stack" style={{ color: 'var(--muted)', fontSize: '0.9em', overflowWrap: 'anywhere' }}>
              <div>{patient.phone || c.notAvailable}</div>
              <div>{patient.email || c.notAvailable}</div>
            </div>
          </section>

          <div className="overline" style={{ marginTop: 20, marginBottom: 9 }}>{c.accountBenefits}</div>
          <section data-stagger className="card stack">
            {activeBenefits.length > 0 ? activeBenefits.map((b, i) => (
              <div key={b.key}>
                {i > 0 && <div className="rowsep" />}
                <BenefitRow label={b.label} active c={c} />
              </div>
            )) : (
              <p className="sub" style={{ margin: 0 }}>{c.benefitsNone}</p>
            )}
            <div className="rowsep" />
            <button
              onClick={() => setShowAddBenefit((v) => !v)}
              style={{ border: 'none', background: 'transparent', color: 'var(--primary)', padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontWeight: 800 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={16} />{c.benefitAddCta}</span>
              <ChevronRight size={16} style={{ transform: showAddBenefit ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
            </button>
            {showAddBenefit && (
              <>
                <div className="rowsep" />
                {addableBenefits.length > 0 ? (
                  <div className="stack">
                    {addableBenefits.map((b, i) => (
                      <div key={b.key}>
                        {i > 0 && <div className="rowsep" />}
                        <CatalogRow
                          label={b.label}
                          wired={WIRED_BENEFIT_KEYS.includes(b.key)}
                          busy={addingKey === b.key}
                          onAdd={() => handleAddBenefit(b.key)}
                          c={c}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="sub" style={{ margin: 0 }}>{c.benefitCatalogEmpty}</p>
                )}
              </>
            )}
          </section>
        </>
      )}

      <div className="overline" style={{ marginTop: 20, marginBottom: 9 }}>{c.accountPreferences}</div>
      <section data-stagger className="card stack">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 700 }}>{c.languageLabel}</span>
          <div className="seg" role="group" aria-label={c.languageLabel}>
            <button className={'chip' + (S.lang === 'en' ? ' add' : '')} aria-pressed={S.lang === 'en'} onClick={() => A.setLang('en')} style={{ border: 'none', padding: '7px 12px' }}>EN</button>
            <button className={'chip' + (S.lang === 'tl' ? ' add' : '')} aria-pressed={S.lang === 'tl'} onClick={() => A.setLang('tl')} style={{ border: 'none', padding: '7px 12px' }}>TL</button>
          </div>
        </div>
        <div className="rowsep" />
        <button onClick={A.cycleText} style={{ border: 'none', background: 'transparent', color: 'var(--ink)', padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span style={{ fontWeight: 700 }}>{c.textSizeLabel}</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }} aria-label={`${c.textSizeLabel}: ${S.textScale + 1}/3`}>
            {[0, 1, 2].map((size) => <span key={size} style={{ fontSize: `${0.78 + size * 0.18}em`, color: S.textScale === size ? 'var(--primary)' : 'var(--muted)', fontWeight: 800 }}>A</span>)}
          </span>
        </button>
      </section>

      <Btn data-stagger variant="secondary" onClick={A.logout} style={{ marginTop: 20, color: 'var(--red)', borderColor: 'var(--red)' }}>{c.logout}</Btn>
      <p className="sub" style={{ textAlign: 'center', fontSize: '0.78em', margin: '16px 8px 0' }}>{c.accountAbout}</p>
    </div>
  );
}
