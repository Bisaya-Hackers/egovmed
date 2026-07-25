import { useCallback, useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { DICT, CONST, CHANNELS, HOSPITALS } from './i18n/dict.js';
import { api, getToken, setToken } from './lib/api.js';
import { fallbackTriage } from './lib/triageFallback.js';
import { makeRefNo } from './lib/refNo.js';
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
import Messages from './screens/Messages.jsx';
import Account from './screens/Account.jsx';
import Report from './screens/Report.jsx';
import Tokens from './screens/Tokens.jsx';
import BottomNav from './components/BottomNav.jsx';
import { DemoSheet, TimeoutModal, Toast, HospitalSheet } from './components/Overlays.jsx';

const FONT = { 0: 17, 1: 19, 2: 21 };
const initial = () => ({
  lang: 'en', screen: 'signin', stack: [], textScale: 0,
  signingIn: false, signinErr: false,
  authMode: 'loading', authLaunchUrl: null, authCallbackUrl: null, flowError: null,
  symptom: '', recording: false, recSec: 0, thinking: false,
  emergency: false, liveness: 'idle', livenessSessionId: null,
  triage: null,
  slotsLoading: false, selectedSlot: null, booking: false, booked: false, slotLabel: '', refNo: makeRefNo(CONST.hospital),
  hospital: CONST.hospital, showHospitalPicker: false,
  channel: null, paying: false, paid: false, paymentStatus: null,
  messages: [], unreadMessages: 0,
  reportStage: 'form', reportCat: null, reportDesc: '', caseNo: CONST.caseNo,
  trackCaseNo: '', trackLoading: false, trackError: null, trackResult: null,
  showDemo: false, showTimeout: false, toast: null,
});

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const tryApi = async (p) => { try { return await p; } catch { return null; } };

const SCREENS = { signin: SignIn, home: Home, symptom: Symptom, triage: Triage, consent: Consent, liveness: Liveness, book: Book, confirm: Confirm, payment: Payment, records: Records, messages: Messages, account: Account, report: Report, tokens: Tokens };
const NAV_SCREENS = new Set(['home', 'records', 'messages', 'account']);

export default function App() {
  const [S, setS] = useState(initial);
  const timers = useRef([]);
  const recTimer = useRef(null);
  const recognizer = useRef(null); // Web Speech API instance
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const resumeStarted = useRef(false);

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

  // Primary screens share one scroll container; always open a newly selected screen at its top.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [S.screen]);

  // Resume eGovPH, hosted-liveness, and eGovPay redirects. Session JWTs live in
  // sessionStorage so they survive same-tab provider redirects but disappear when the tab closes.
  useEffect(() => {
    if (resumeStarted.current) return;
    resumeStarted.current = true;
    const cleanUrl = () => window.history.replaceState({}, '', '/');
    const finishPayment = async (billId) => {
      let latest = null;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        latest = await api.paymentStatus(billId);
        const status = String(latest?.status || '').toLowerCase();
        if (['paid', 'settled', 'success', 'successful', 'completed', 'failed', 'voided'].includes(status)) break;
        await delay(1500);
      }
      return latest;
    };

    // Re-derive the appointment/payment/message state from the backend. This is what keeps the
    // Home "upcoming appointment" card (and its paid state) alive across full-page navigations —
    // e.g. the eGovPay hosted-checkout redirect reloads the app and wipes in-memory React state,
    // so without this the card would silently vanish even though the booking still exists server-side.
    const SETTLED = ['paid', 'settled', 'success', 'successful', 'completed'];
    const syncPatientState = async () => {
      const [appts, pays, msgs] = await Promise.all([tryApi(api.appointments()), tryApi(api.payments()), tryApi(api.messages())]);
      if (Array.isArray(msgs)) set({ messages: msgs });
      if (Array.isArray(appts) && appts.length) {
        const active = [...appts]
          .filter((a) => a.status !== 'cancelled')
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
        if (active) {
          const latestPaid = Array.isArray(pays) && pays.some((p) => SETTLED.includes(String(p.status || '').toLowerCase()));
          set((p) => ({
            booked: true,
            triage: { ...(p.triage || {}), specialty: active.specialty },
            slotLabel: active.scheduledFor
              ? new Date(active.scheduledFor).toLocaleString(p.lang === 'tl' ? 'fil-PH' : 'en-PH', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
              : p.slotLabel,
            refNo: makeRefNo(active.hospital || 'PGH', active.queueNumber, active.id || active.queueNumber),
            hospital: active.hospital && active.hospital !== 'PGH' ? active.hospital : p.hospital,
            paid: p.paid || latestPaid,
          }));
        }
      }
    };

    (async () => {
      try {
        const auth = await api.authConfig();
        set({ authMode: auth?.mode || 'mock', authLaunchUrl: auth?.launchUrl || null, authCallbackUrl: auth?.callbackUrl || null });

        const current = new URL(window.location.href);
        const exchangeCode = current.searchParams.get('exchange_code') || current.searchParams.get('exchangeCode');
        if (exchangeCode) {
          cleanUrl();
          set({ signingIn: true, signinErr: false, flowError: null });
          const result = await api.login(exchangeCode);
          if (!result?.token) throw new Error('eGovPH returned no session token');
          setToken(result.token);
          await syncPatientState();
          set({ signingIn: false, screen: 'home', stack: [] });
          return;
        }

        if (current.pathname.endsWith('/liveness/callback')) {
          cleanUrl();
          const sessionId = window.sessionStorage.getItem('egovmed.livenessSessionId');
          if (!getToken() || !sessionId) throw new Error('The liveness session could not be resumed');
          set({ screen: 'liveness', stack: ['consent'], liveness: 'verifying', livenessSessionId: sessionId, flowError: null });
          const result = await api.verifyIdentity(sessionId);
          window.sessionStorage.removeItem('egovmed.livenessSessionId');
          if (!result?.verified) throw new Error('Identity verification did not pass');
          set({ liveness: 'verified' });
          return;
        }

        if (current.pathname.endsWith('/payment/return')) {
          cleanUrl();
          const billId = window.sessionStorage.getItem('egovmed.pendingBillId');
          if (!getToken() || !billId) throw new Error('The payment session could not be resumed');
          set({ screen: 'payment', stack: ['home'], paying: true, channel: 0, flowError: null });
          const payment = await finishPayment(billId);
          window.sessionStorage.removeItem('egovmed.pendingBillId');
          const status = String(payment?.status || '').toLowerCase();
          const paid = ['paid', 'settled', 'success', 'successful', 'completed'].includes(status);
          set({ paying: false, paid, paymentStatus: status, flowError: paid ? null : `Payment status: ${status || 'pending'}` });
          await syncPatientState();
          return;
        }

        if (getToken()) {
          await api.me();
          await syncPatientState();
          set({ screen: 'home', stack: [] });
        }
      } catch (err) {
        set((p) => ({
          authMode: p.authMode === 'loading' ? 'mock' : p.authMode,
          signingIn: false,
          signinErr: true,
          liveness: 'failed',
          paying: false,
          flowError: err.message || 'The live flow failed',
        }));
      }
    })();
  }, [set]);

  const A = {
    setLang: (l) => set({ lang: l }),
    cycleText: () => set((p) => ({ textScale: (p.textScale + 1) % 3 })),
    go: (screen) => set((p) => ({ screen, stack: [...p.stack, p.screen], ...(screen === 'messages' ? { unreadMessages: 0 } : {}) })),
    back: () => set((p) => { const k = [...p.stack]; const prev = k.pop() || 'home'; return { screen: prev, stack: k }; }),
    toast,

    // Mock mode exchanges a demo code. Live mode starts the partner-provided eGovPH launch URL;
    // eGovPH returns to /egovph/sso?exchange_code=... and the mount effect above completes login.
    doSignIn: async () => {
      if (S.authMode === 'live') {
        if (S.authLaunchUrl && /^https:\/\//i.test(S.authLaunchUrl)) {
          window.location.assign(S.authLaunchUrl);
        } else {
          set({ signinErr: true, flowError: 'Open eGovMed from the eGovPH app, or configure EGOVPH_LAUNCH_URL.' });
        }
        return;
      }
      set({ signingIn: true, signinErr: false });
      const [res] = await Promise.all([tryApi(api.login('demo')), delay(900)]);
      if (res?.token) {
        setToken(res.token);
        set({ signingIn: false, screen: 'home', stack: [], flowError: null });
      } else if (S.authMode === 'mock') {
        // Keep the hackathon demo usable during a backend outage without minting a
        // fake session: protected API calls remain unauthenticated and use UI fallbacks.
        set({ signingIn: false, screen: 'home', stack: [], flowError: null });
      } else {
        set({ signingIn: false, signinErr: true, flowError: 'Unable to sign in.' });
      }
    },

    // Symptom intake
    setSymptom: (v) => set({ symptom: v }),
    addChip: (t) => set((p) => { const s = p.symptom.trim(); return { symptom: s ? s.replace(/[.,]$/, '') + ', ' + t.toLowerCase() : t }; }),
    toggleRec: () => {
      if (S.recording) {
        if (recTimer.current) { clearInterval(recTimer.current); recTimer.current = null; }
        if (recognizer.current) { try { recognizer.current.stop(); } catch { /* already stopped */ } recognizer.current = null; }
        set({ recording: false });
        // Only inject the scripted sample if the real recognizer produced nothing (offline / permission denied / no SR support).
        after(400, () => set((p) => {
          if (p.symptom.trim()) return {};
          const sample = p.lang === 'tl'
            ? 'Sumasakit ang dibdib ko at medyo hirap huminga mula kaninang umaga.'
            : 'I’ve had chest pain and a bit of shortness of breath since this morning.';
          return { symptom: sample };
        }));
      } else {
        set({ recording: true, recSec: 0 });
        recTimer.current = setInterval(() => set((p) => ({ recSec: p.recSec + 1 })), 1000);
        // Real Web Speech API when the browser supports it (Chrome/Edge on desktop, most modern mobiles).
        const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
        if (SR) {
          try {
            const rec = new SR();
            rec.lang = S.lang === 'tl' ? 'fil-PH' : 'en-PH';
            rec.interimResults = true;
            rec.continuous = true;
            const baseText = S.symptom.trim();
            rec.onresult = (e) => {
              let transcript = '';
              for (let i = 0; i < e.results.length; i += 1) transcript += e.results[i][0].transcript;
              set({ symptom: (baseText ? baseText + ' ' : '') + transcript.trim() });
            };
            rec.onerror = (e) => { if (e.error !== 'aborted' && e.error !== 'no-speech') console.warn('speech recognition error:', e.error); };
            rec.onend = () => { recognizer.current = null; };
            rec.start();
            recognizer.current = rec;
          } catch { /* fall through — sample injection on stop will cover it */ }
        }
      }
    },
    // eGovAI triage
    doAnalyze: async () => {
      if (!S.symptom.trim() || S.thinking) return;
      set({ thinking: true });
      const [apiResult] = await Promise.all([tryApi(api.triage(S.symptom, S.lang)), delay(1900)]);
      const localFallback = fallbackTriage(S.symptom, S.lang);
      const res = apiResult || localFallback;
      const emergency = S.emergency || res?.urgency === 'emergency';
      const triage = {
        specialty: res?.specialty || CONST.dept,
        urgency: emergency ? 'emergency' : res?.urgency || 'urgent',
        redFlags: Array.isArray(res?.redFlags) ? res.redFlags : [],
        inputSymptoms: res?.inputSymptoms || S.symptom,
        reasoning: ['rule-based-fallback', 'on-device-fallback'].includes(res?.engine) ? localFallback.reasoning : res?.reasoning || null,
        recommendedAction: res?.recommendedAction || null,
        confidence: res?.confidence ?? null,
        engine: res?.engine || null,
        id: res?.id || null,
      };
      set({ thinking: false, emergency, triage, screen: 'triage', stack: [...S.stack, 'symptom'] });
    },
    continueTriage: () => A.go('consent'),

    // Consent + Face Liveness (National ID eVerify)
    declineConsent: () => A.back(),
    acceptConsent: async () => {
      set((p) => ({ screen: 'liveness', stack: [...p.stack, 'consent'], liveness: 'capturing', flowError: null }));
      try {
        const sess = await api.startLiveness();
        const sid = sess?.sessionId || sess?.session_id || null;
        if (!sid) throw new Error('Face Liveness returned no session ID');
        set({ livenessSessionId: sid });
        if (sess?.url) {
          const hosted = new URL(sess.url);
          if (hosted.protocol !== 'https:') throw new Error('Face Liveness returned an insecure URL');
          window.sessionStorage.setItem('egovmed.livenessSessionId', sid);
          window.location.assign(hosted.href);
          return;
        }
        await delay(900);
        set({ liveness: 'verifying' });
        const result = await api.verifyIdentity(sid);
        if (!result?.verified) throw new Error('Identity verification did not pass');
        set({ liveness: 'verified' });
      } catch (err) {
        set({ liveness: 'failed', flowError: err.message || 'Identity verification failed' });
      }
    },
    retryLiveness: () => A.acceptConsent(),

    // Booking + eMessage
    goBook: () => { A.go('book'); set({ slotsLoading: true, selectedSlot: null }); after(1100, () => set({ slotsLoading: false })); },
    selectSlot: (i) => set({ selectedSlot: i }),
    toggleHospitalPicker: () => set((p) => ({ showHospitalPicker: !p.showHospitalPicker })),
    // Switching hospitals re-queries slots for that facility (mocked with the same short delay as goBook).
    setHospital: (name) => {
      set({ hospital: name, showHospitalPicker: false, selectedSlot: null, slotsLoading: true });
      after(900, () => set({ slotsLoading: false }));
    },
    doBook: async (slotLabel) => {
      if (S.selectedSlot == null || S.booking) return;
      set({ booking: true });
      const specialty = S.triage?.specialty || CONST.dept;
      const [res] = await Promise.all([tryApi(api.book(specialty, S.hospital, undefined, S.triage?.id)), delay(1500)]);
      const appt = res?.appointment;
      const refNo = appt ? makeRefNo(appt.hospital || 'PGH', appt.queueNumber, appt.id || appt.queueNumber) : null;
      // Optimistic confirmation bubble so Messages feels instant; A.loadMessages() below reconciles
      // it with the real, server-persisted row (with its real msg_… id) a moment later.
      const optimistic = {
        id: 'local_' + Date.now(), kind: 'confirmation', status: 'sent', channel: 'sms', provider: 'mock',
        createdAt: new Date().toISOString(), meta: { specialty, hospital: appt?.hospital || S.hospital, queueNumber: appt?.queueNumber },
      };
      set((p) => ({
        booking: false, booked: true, slotLabel, refNo: refNo || p.refNo,
        messages: [optimistic, ...p.messages], unreadMessages: p.unreadMessages + 1,
        screen: 'confirm', stack: ['home'],
      }));
      toast(S.lang === 'tl' ? 'Ipinadala ang kumpirmasyon sa SMS' : 'Confirmation texted to you');
      after(1200, A.loadMessages);
    },

    // Payment (eGovPay)
    goPayment: () => A.go('payment'),
    setChannel: (i) => set({ channel: i }),
    doPay: async (amount = 300) => {
      if (S.channel == null || S.paying) return;
      set({ paying: true, flowError: null });
      try {
        const payment = await api.pay(amount, CHANNELS[S.channel]?.[0] || 'card');
        if (payment?.provider !== 'mock' && payment?.checkoutUrl) {
          const checkout = new URL(payment.checkoutUrl);
          if (checkout.protocol !== 'https:') throw new Error('Payment provider returned an insecure checkout URL');
          window.sessionStorage.setItem('egovmed.pendingBillId', payment.id);
          window.location.assign(checkout.href);
          return;
        }
        const refreshed = payment?.id ? await api.paymentStatus(payment.id) : payment;
        const status = String(refreshed?.status || '').toLowerCase();
        const paid = ['paid', 'settled', 'success', 'successful', 'completed'].includes(status);
        set({ paying: false, paid, paymentStatus: status, flowError: paid ? null : `Payment status: ${status || 'pending'}` });
        if (paid) toast(S.lang === 'tl' ? 'Ipinadala ang resibo sa SMS' : 'Receipt texted to you');
      } catch (err) {
        set({ paying: false, flowError: err.message || 'Payment failed' });
      }
    },

    // Messages (eMessage) — list refresh + reply thread
    loadMessages: async () => {
      const rows = await tryApi(api.messages());
      if (Array.isArray(rows)) set({ messages: rows });
      return rows;
    },
    sendMessageReply: async (id, text) => {
      const res = await tryApi(api.replyToMessage(id, text));
      if (res?.reply) set((p) => ({ messages: [res.reply, ...p.messages] }));
      if (res?.ack) after(1000, () => set((p) => ({ messages: [res.ack, ...p.messages] })));
      return res;
    },

    // Records + Report
    goRecords: () => A.go('records'),
    openReport: () => { set({ reportStage: 'form', reportCat: null, reportDesc: '', trackCaseNo: '', trackError: null, trackResult: null }); A.go('report'); },
    setCat: (i) => set({ reportCat: i }),
    setDesc: (v) => set({ reportDesc: v }),
    submitReport: () => { if (S.reportCat == null || !S.reportDesc.trim()) return; set({ reportStage: 'otp' }); },
    verifyOtp: async (catLabel) => {
      set({ reportStage: 'filed' });
      const res = await tryApi(api.fileReport(catLabel, S.reportDesc));
      if (res?.caseNumber) set({ caseNo: res.caseNumber });
    },

    // Check the status of a previously filed report (GET /reports/:caseNumber)
    openTrackReport: () => set({ reportStage: 'track', trackCaseNo: '', trackError: null, trackResult: null }),
    setTrackCaseNo: (v) => set({ trackCaseNo: v.toUpperCase(), trackError: null }),
    submitTrackCase: async () => {
      const caseNo = S.trackCaseNo.trim();
      if (!/^EGM-\d{4}-\d{6}$/.test(caseNo)) { set({ trackError: 'invalid' }); return; }
      set({ trackLoading: true, trackError: null, trackResult: null });
      try {
        const res = await api.trackCase(caseNo);
        set({ trackLoading: false, trackResult: res || null, trackError: res ? null : 'notfound' });
      } catch {
        set({ trackLoading: false, trackError: 'notfound' });
      }
    },

    // Overlays / demo controls
    resetToHome: () => set({ screen: 'home', stack: [], selectedSlot: null, channel: null, paid: false, paying: false, reportStage: 'form', reportCat: null, reportDesc: '', trackCaseNo: '', trackResult: null, trackError: null }),
    toggleDemo: () => set((p) => ({ showDemo: !p.showDemo })),
    toggleEmergency: () => set((p) => ({ emergency: !p.emergency })),
    triggerTimeout: () => set({ showDemo: false, showTimeout: true }),
    stayIn: () => set({ showTimeout: false }),
    logout: () => { clearTimers(); setToken(null); window.sessionStorage.removeItem('egovmed.livenessSessionId'); window.sessionStorage.removeItem('egovmed.pendingBillId'); setS((p) => ({ ...initial(), lang: p.lang, textScale: p.textScale })); },
    openTokens: () => { set({ showDemo: false }); A.go('tokens'); },
    resetFlow: () => { clearTimers(); setS((p) => ({ ...initial(), lang: p.lang, textScale: p.textScale })); },
  };

  const Screen = SCREENS[S.screen] || Home;
  const showNav = NAV_SCREENS.has(S.screen);

  return (
    <div className="device" style={{ fontSize: FONT[S.textScale] }}>
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
      {S.showHospitalPicker && <HospitalSheet c={c} S={S} A={A} hospitals={HOSPITALS} />}
    </div>
  );
}

function SegBtn({ on, children, ...p }) {
  const style = on
    ? { border: 'none', background: 'var(--blue)', color: '#fff', fontWeight: 800, borderRadius: 999, padding: '5px 13px', fontSize: 13 }
    : { border: 'none', background: 'transparent', color: 'var(--muted)', fontWeight: 700, borderRadius: 999, padding: '5px 13px', fontSize: 13 };
  return <button aria-pressed={on} style={style} {...p}>{children}</button>;
}
