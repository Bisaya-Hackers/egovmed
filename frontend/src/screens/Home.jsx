import { HeartPulse, FileText, Card, Flag, Chat, ChevronRight } from '../components/Icons.jsx';
import { CONST } from '../i18n/dict.js';
import rosaAvatar from '../assets/home-avatar-rosa.png';
import digitalIdArt from '../assets/home-digital-id.png';
import verifiedLabsArt from '../assets/home-verified-labs.png';

function Service({ icon, label, color, badge, onClick }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, flex: 1 }}>
      <span style={{ position: 'relative', width: 60, height: 60, borderRadius: '50%', background: 'var(--blue-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color || 'var(--primary)' }}>
        {icon}
        {badge && (
          <span style={{ position: 'absolute', top: -2, right: -2, background: 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 999, padding: '2px 6px' }}>{badge}</span>
        )}
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{label}</span>
    </button>
  );
}

export default function Home({ c, lang, S, A }) {
  const dept = S.triage?.specialty || CONST.dept;
  return (
    <div className="screen">
      {/* greeting */}
      <div data-stagger style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
        <img src={rosaAvatar} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: '1.3em', fontWeight: 800, color: 'var(--primary)', lineHeight: 1.1, margin: 0 }}>{c.greeting}</h1>
          <div className="sub" style={{ margin: '3px 0 0' }}>{CONST.phone}</div>
        </div>
        <img src={digitalIdArt} alt="Secure digital health identity" style={{ width: 92, height: 58, borderRadius: 14, objectFit: 'contain', flex: 'none' }} />
      </div>

      {/* hero — start a visit */}
      <button
        data-stagger
        onClick={() => A.go('symptom')}
        style={{ width: '100%', textAlign: 'left', marginTop: 18, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 20, padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}
      >
        <span style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <HeartPulse size={26} color="#fff" />
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: '1.15em', fontWeight: 800 }}>{c.startVisit}</span>
          <span style={{ display: 'block', fontSize: '0.9em', opacity: 0.9, marginTop: 2 }}>{c.startVisitSub}</span>
        </span>
        <ChevronRight size={22} color="#fff" />
      </button>

      {/* quick services */}
      <div data-stagger style={{ display: 'flex', gap: 6, marginTop: 20 }}>
        <Service icon={<FileText size={24} />} label={c.navRecords} onClick={A.goRecords} />
        <Service icon={<Card size={24} />} label={c.navPay} color="var(--teal)" onClick={() => (S.booked ? A.goPayment() : A.toast(c.noAppts))} />
        <Service icon={<Flag size={24} />} label={c.navReport} color="var(--red)" badge={lang === 'tl' ? 'Bago' : 'New'} onClick={A.openReport} />
        <Service icon={<Chat size={24} />} label={c.navMessages} onClick={A.openMessages} />
      </div>

      {/* upcoming appointment */}
      <div className="overline" style={{ marginTop: 24, marginBottom: 10 }}>{c.upcoming}</div>
      {S.booked ? (
        <div data-stagger className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05em' }}>{dept}</div>
              <div className="sub" style={{ margin: '4px 0 0' }}>{S.slotLabel || 'Today · 2:30 PM'}</div>
              <div className="sub" style={{ margin: '2px 0 0' }}>{CONST.hospital}</div>
            </div>
            <span className="pill green">{c.verifiedBadge}</span>
          </div>
          <div className="rowsep" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: '0.9em', color: 'var(--muted)' }}>{S.refNo}</span>
            {!S.paid && (
              <button onClick={A.goPayment} className="chip add" style={{ fontWeight: 800 }}>{c.payNow}</button>
            )}
          </div>
        </div>
      ) : (
        <div data-stagger className="card" style={{ border: '1.5px dashed var(--border)', background: 'transparent', textAlign: 'center' }}>
          <div style={{ fontWeight: 700 }}>{c.noAppts}</div>
          <p className="sub" style={{ margin: '6px 0 0' }}>{c.noApptsSub}</p>
        </div>
      )}

      {/* featured */}
      <div className="overline" style={{ marginTop: 22, marginBottom: 10 }}>{c.featured}</div>
      <div data-stagger className="card tint" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800 }}>{c.featuredTitle}</div>
          <p className="sub" style={{ margin: '5px 0 0' }}>{c.featuredSub}</p>
        </div>
        <img src={verifiedLabsArt} alt="Verified lab records shared across hospitals" style={{ width: 76, height: 60, borderRadius: 12, objectFit: 'contain', flex: 'none' }} />
      </div>
    </div>
  );
}
