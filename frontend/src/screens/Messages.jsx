import { useEffect, useState } from 'react';
import { ScreenHeader } from '../components/ui.jsx';
import { Bell, Chat, ChevronRight } from '../components/Icons.jsx';
import { api } from '../lib/api.js';

const kindLabel = (kind, c) => ({
  appointment_confirmation: c.messageConfirmation,
  confirmation: c.messageConfirmation,
  appointment_reminder: c.messageReminder,
  reminder: c.messageReminder,
  results_ready: c.messageResultsReady,
}[kind] || c.messageGeneric);

const channelLabel = (channel, c) => ({
  sms: c.channelSms,
  email: c.channelEmail,
  in_app: c.channelInApp,
}[String(channel || '').toLowerCase()] || String(channel || c.channelInApp).toUpperCase());

function relativeTime(iso, lang) {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  const seconds = Math.round((time - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(lang === 'tl' ? 'fil' : 'en', { numeric: 'auto' });
  if (abs < 60) return formatter.format(seconds, 'second');
  if (abs < 3600) return formatter.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return formatter.format(Math.round(seconds / 3600), 'hour');
  if (abs < 604800) return formatter.format(Math.round(seconds / 86400), 'day');
  return formatter.format(Math.round(seconds / 604800), 'week');
}

export default function Messages({ c, lang, A }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    api.messages()
      .then((rows) => { if (alive) setMessages(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="screen">
      <ScreenHeader onBack={A.back} label={c.navMessages} />
      <h1 className="h1" data-stagger>{c.messagesTitle}</h1>
      <p className="sub" data-stagger>{c.messagesSub}</p>

      <div data-stagger className="card tint" style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <span className="icirc"><Chat size={22} /></span>
        <div>
          <div style={{ fontWeight: 800 }}>{c.messagesIntro}</div>
          <p className="sub" style={{ margin: '4px 0 0', fontSize: '0.88em' }}>{c.messagesIntroSub}</p>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span className="spinner" aria-hidden="true" />
          <span className="sub" style={{ margin: 0 }}>{c.messagesLoading}</span>
        </div>
      ) : error ? (
        <div role="alert" className="card" style={{ marginTop: 18, color: 'var(--red)', textAlign: 'center' }}>{c.messagesError}</div>
      ) : messages.length === 0 ? (
        <div data-stagger className="card" style={{ marginTop: 18, border: '1.5px dashed var(--border)', background: 'transparent', textAlign: 'center' }}>
          <Bell size={28} color="var(--muted)" />
          <div style={{ fontWeight: 700, marginTop: 8 }}>{c.messagesEmpty}</div>
          <p className="sub" style={{ margin: '6px 0 0' }}>{c.messagesEmptySub}</p>
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 18 }}>
          {messages.map((message) => {
            const isReminder = ['appointment_reminder', 'reminder'].includes(message.kind);
            return (
              <article data-stagger className="card" key={message.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="icirc" style={isReminder ? { background: 'var(--amber-50)', color: 'var(--amber)' } : undefined}>
                  {isReminder ? <Bell size={21} /> : <Chat size={21} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>{kindLabel(message.kind, c)}</div>
                  <div className="sub" style={{ margin: '4px 0 0', display: 'flex', gap: 7, alignItems: 'center', fontSize: '0.85em' }}>
                    <span style={{ fontWeight: 700 }}>{channelLabel(message.channel, c)}</span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={message.createdAt}>{relativeTime(message.createdAt, lang)}</time>
                  </div>
                </div>
                <ChevronRight size={19} color="var(--muted)" aria-hidden="true" />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
