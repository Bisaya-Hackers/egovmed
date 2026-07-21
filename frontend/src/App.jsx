import { useCallback, useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { DICT, CONST } from './i18n/dict.js';
import { api, setToken } from './lib/api.js';
import { Gear, Bell, Check } from './components/Icons.jsx';

import SignIn from './screens/SignIn.jsx';
import Home from './screens/Home.jsx';
import Symptom from './screens/Symptom.jsx';
import Triage from './screens/Triage.jsx';
import Consent from './screens/Consent.jsx';
import Liveness from './screens/Liveness.jsx';
import Book from './screens/Book.jsx';
import Confirm from './screens/Confirm.jsx';
import Payment from './screens/Payment.jsx';
import Records from './screens/Records.jsx';
import Report from './screens/Report.jsx';
import Tokens from './screens/Tokens.jsx';
import BottomNav from './components/BottomNav.jsx';
import { DemoSheet, TimeoutModal, Toast } from './components/Overlays.jsx';

const FONT = { 0: 17, 1: 19, 2: 21 };
const initial = () => ({
  lang: 'en', screen: 'signin', stack: [], textScale: 0,
  signingIn: false, signinErr: false,
  symptom: '', recording: false, recSec: 0, thinking: false,
  emergency: false, liveness: 'idle', livenessSessionId: null,
  triage: null,
  slotsLoading: false, selectedSlot: null, booking: false, booked: false, slotLabel: '', refNo: CONST.refNo,
  channel: null, paying: false, paid: false,
  reportStage: 'form', reportCat: null, reportDesc: '', caseNo: CONST.caseNo,
  showDemo: false, showTimeout: false, toast: null,
});

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const tryApi = async (p) => { try { return await p; } catch { return null; } };

const SCREENS = { signin: SignIn, home: Home, symptom: Symptom, triage: Triage, consent: Consent, liveness: Liveness, book: Book, confirm: Confirm, payment: Payment, records: Records, report: Report, tokens: Tokens };
const NAV_SCREENS = new Set(['home', 'records']);

export default function App() {
  const [S, setS] = useState(initial);
  const timers = useRef([]);
  const recTimer = useRef(null);
  const scrollRef = useRef(null);
  const contentRef = useRef(null);

  const set = useCallback((patch) => setS((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) })), []);
  const after = useCallback((ms, fn) => { const id = setTimeout(fn, ms); timers.current.push(id); return id; }, []);
  const clearTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; if (recTimer.current) { clearInterval(recTimer.current); recTimer.current = null; } }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const c = DICT[S.lang];
  const toast = (m) => { set({ toast: m }); after(2600, () => set({ toast: null })); };

  // Screen transition (GSAP): fade/slide the content in, then stagger [data-stagger] cards.
  useGSAP(() => {
    const el = contentRef.current;
    if (!el) return;
    gsap.fromTo(el, { autoAlpha: 0.35, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' });
    const cards = el.querySelectorAll('[data-stagger]');
    if (cards.length) gsap.fromTo(cards, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, stagger: 0.06, ease: 'power2.out', delay: 0.04 });
  }, { dependencies: [S.screen], scope: contentRef });

  // Keep the document language in sync so screen readers use the right pronunciation for EN/TL.
  useEffect(() => { document.documentElement.lang = S.lang === 'tl' ? 'fil' : 'en'; }, [S.lang]);

  const A = {
    setLang: (l) => set({ lang: l }),
    cycleText: () => set((p) => ({ textScale: (p.textScale + 1) % 3 })),
    go: (screen) => set((p) => ({ screen, stack: [...p.stack, p.screen] })),
    back: () => set((p) => { const k = [...p.stack]; const prev = k.pop() || 'home'; return { screen: prev, stack: k }; }),
    toast,

    // Sign in (eGovPH SSO — mock exchange-code login)
    doSignIn: async () => {
      set({ signingIn: true, signinErr: false });
      const [res] = await Promise.all([tryApi(api.login()), delay(1500)]);
      if (res && res.token) setToken(res.token);
      set({ signingIn: false, screen: 'home', stack: [] });
    },

    // Symptom intake
    setSymptom: (v) => set({ symptom: v }),
    addChip: (t) => set((p) => { const s = p.symptom.trim(); return { symptom: s ? s.replace(/[.,]$/, '') + ', ' + t.toLowerCase() : t }; }),
    toggleRec: () => {
      if (S.recording) {
        if (recTimer.current) { clearInterval(recTimer.current); recTimer.current = null; }
        set({ recording: false });
        after(350, () => set((p) => {
          if (p.symptom.trim()) return {};
          const sample = p.lang === 'tl'
            ? 'Sumasakit ang dibdib ko at medyo hirap huminga mula kaninang umaga.'
            : 'I’ve had chest pain and a bit of shortness of breath since this morning.';
          return { symptom: sample };
        }));
      } else {
        set({ recording: true, recSec: 0 });
        recTimer.current = setInterval(() => set((p) => ({ recSec: p.recSec + 1 })), 1000);
      }
    },
    // eGovAI triage
    doAnalyze: async () => {
      if (!S.symptom.trim() || S.thinking) return;
      set({ thinking: true });
      const [res] = await Promise.all([tryApi(api.triage(S.symptom, S.lang)), delay(1900)]);
      const emergency = S.emergency || res?.urgency === 'emergency';
      const triage = {
        specialty: res?.specialty || CONST.dept,
        urgency: emergency ? 'emergency' : res?.urgency || 'urgent',
        redFlags: res?.redFlags || null,
        id: res?.id || null,
      };
      set({ thinking: false, emergency, triage, screen: 'triage', stack: [...S.stack, 'symptom'] });
    },
    continueTriage: () => A.go('consent'),

    // Consent + Face Liveness (National ID eVerify)
    declineConsent: () => A.back(),
    acceptConsent: async () => {
      set((p) => ({ screen: 'liveness', stack: [...p.stack, 'consent'], liveness: 'capturing' }));
      const sess = await tryApi(api.startLiveness());
      const sid = sess?.sessionId || sess?.session_id || null;
      set({ livenessSessionId: sid });
      after(1600, () => { set({ liveness: 'verifying' }); if (sid) tryApi(api.verifyIdentity(sid)); });
      after(3300, () => set({ liveness: 'verified' }));
    },

    // Booking + eMessage
    goBook: () => { A.go('book'); set({ slotsLoading: true, selectedSlot: null }); after(1100, () => set({ slotsLoading: false })); },
    selectSlot: (i) => set({ selectedSlot: i }),
    doBook: async (slotLabel) => {
      if (S.selectedSlot == null || S.booking) return;
      set({ booking: true });
      const specialty = S.triage?.specialty || CONST.dept;
      const [res] = await Promise.all([tryApi(api.book(specialty, slotLabel, S.triage?.id)), delay(1500)]);
      set((p) => ({ booking: false, booked: true, slotLabel, refNo: res?.appointment?.reference_no || p.refNo, screen: 'confirm', stack: ['home'] }));
      toast(S.lang === 'tl' ? 'Ipinadala ang kumpirmasyon sa SMS' : 'Confirmation texted to you');
    },

    // Payment (eGovPay)
    goPayment: () => A.go('payment'),
    setChannel: (i) => set({ channel: i }),
    doPay: async (amount = 300) => {
      if (S.channel == null || S.paying) return;
      set({ paying: true });
      await Promise.all([tryApi(api.pay(amount)), delay(1900)]);
      set({ paying: false, paid: true });
      toast(S.lang === 'tl' ? 'Ipinadala ang resibo sa SMS' : 'Receipt texted to you');
    },

    // Records + Report
    goRecords: () => A.go('records'),
    openReport: () => { set({ reportStage: 'form', reportCat: null, reportDesc: '' }); A.go('report'); },
    setCat: (i) => set({ reportCat: i }),
    setDesc: (v) => set({ reportDesc: v }),
    submitReport: () => { if (S.reportCat == null || !S.reportDesc.trim()) return; set({ reportStage: 'otp' }); },
    verifyOtp: async (catLabel) => {
      set({ reportStage: 'filed' });
      const res = await tryApi(api.fileReport(catLabel, S.reportDesc));
      if (res?.caseNumber) set({ caseNo: res.caseNumber });
    },

    // Overlays / demo controls
    openMessages: () => toast(S.lang === 'tl' ? 'Walang bagong mensahe' : 'No new messages'),
    resetToHome: () => set({ screen: 'home', stack: [], selectedSlot: null, channel: null, paid: false, paying: false, reportStage: 'form', reportCat: null, reportDesc: '' }),
    toggleDemo: () => set((p) => ({ showDemo: !p.showDemo })),
    toggleEmergency: () => set((p) => ({ emergency: !p.emergency })),
    triggerTimeout: () => set({ showDemo: false, showTimeout: true }),
    stayIn: () => set({ showTimeout: false }),
    logout: () => { clearTimers(); setToken(null); setS((p) => ({ ...initial(), lang: p.lang, textScale: p.textScale })); },
    openTokens: () => { set({ showDemo: false }); A.go('tokens'); },
    resetFlow: () => { clearTimers(); setS((p) => ({ ...initial(), lang: p.lang, textScale: p.textScale })); },
  };

  const Screen = SCREENS[S.screen] || Home;
  const showNav = NAV_SCREENS.has(S.screen);

  return (
    <div className="device" style={{ fontSize: FONT[S.textScale] }}>
      {/* status bar (decorative chrome) */}
      <div className="statusbar" aria-hidden="true">
        <span>9:41</span>
        <span className="glyphs">
          <Signal /><Wifi /><Battery />
        </span>
      </div>

      {/* utility strip */}
      <header className="util">
        <span className="wm">eGOV<span className="med">MED</span></span>
        <div className="util-right">
          <div className="seg" role="group" aria-label="Language">
            <SegBtn on={S.lang === 'en'} onClick={() => A.setLang('en')}>EN</SegBtn>
            <SegBtn on={S.lang === 'tl'} onClick={() => A.setLang('tl')}>TL</SegBtn>
          </div>
          <button className={'iconbtn' + (S.textScale ? ' active' : '')} onClick={A.cycleText} aria-label={c.textSize} title={c.textSize}>AA</button>
          <button className="iconbtn" onClick={A.toggleDemo} aria-label="Demo controls"><Gear size={17} /></button>
          {S.screen === 'home' && (
            <button className="iconbtn" onClick={() => A.toast(c.notifications)} aria-label={c.notifications} style={{ position: 'relative' }}>
              <Bell size={17} />
              <span style={{ position: 'absolute', top: 6, right: 7, width: 7, height: 7, borderRadius: 999, background: 'var(--red)' }} />
            </button>
          )}
        </div>
      </header>

      {/* active screen */}
      <main className="scroll" ref={scrollRef}>
        <div className="screen-wrap" ref={contentRef}>
          <Screen c={c} lang={S.lang} S={S} set={set} A={A} />
        </div>
      </main>

      {showNav && <BottomNav c={c} S={S} A={A} />}

      {/* overlays */}
      {S.toast && <Toast msg={S.toast} icon={<Check size={16} />} />}
      {S.showTimeout && <TimeoutModal c={c} A={A} />}
      {S.showDemo && <DemoSheet c={c} S={S} A={A} />}
    </div>
  );
}

function SegBtn({ on, children, ...p }) {
  const style = on
    ? { border: 'none', background: 'var(--blue)', color: '#fff', fontWeight: 800, borderRadius: 999, padding: '5px 13px', fontSize: 13 }
    : { border: 'none', background: 'transparent', color: 'var(--muted)', fontWeight: 700, borderRadius: 999, padding: '5px 13px', fontSize: 13 };
  return <button aria-pressed={on} style={style} {...p}>{children}</button>;
}

const Signal = () => <svg width="17" height="12" viewBox="0 0 17 12" aria-hidden="true"><g fill="currentColor">{[0, 1, 2, 3].map((i) => <rect key={i} x={i * 4.5} y={8 - i * 2.4} width="3" height={4 + i * 2.4} rx="1" />)}</g></svg>;
const Wifi = () => <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M1 4a10 10 0 0114 0M3.5 6.6a6.5 6.5 0 019 0" /><circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" /></svg>;
const Battery = () => <svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true"><rect x="1" y="1.5" width="20" height="9" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5" /><rect x="2.5" y="3" width="15" height="6" rx="1.2" fill="currentColor" /><rect x="22" y="4" width="1.6" height="4" rx="0.8" fill="currentColor" opacity="0.5" /></svg>;
