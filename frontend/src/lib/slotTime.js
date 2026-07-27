// Turns a display slot label like "Today · 2:30 PM" (see SLOTS in i18n/dict.js) into a real
// ISO datetime, so booking can send an actual `scheduledFor` instead of leaving every stored
// appointment dateless (which made unrelated bookings collapse into looking identical once
// their labels get re-derived server-side).
const DAY_TOKENS = {
  en: { Today: 0, Tomorrow: 1, weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
  tl: { Ngayon: 0, Bukas: 1, weekdays: ['Lin', 'Lun', 'Mar', 'Miy', 'Huw', 'Biy', 'Sab'] },
};

function resolveDayOffset(token, lang) {
  const cfg = DAY_TOKENS[lang] || DAY_TOKENS.en;
  if (token === (lang === 'tl' ? 'Ngayon' : 'Today')) return 0;
  if (token === (lang === 'tl' ? 'Bukas' : 'Tomorrow')) return 1;
  const targetDow = cfg.weekdays.findIndex((w) => token.startsWith(w));
  if (targetDow === -1) return null;
  const currentDow = new Date().getDay();
  let diff = targetDow - currentDow;
  if (diff <= 0) diff += 7; // named weekdays always mean the next occurrence
  return diff;
}

function parseTime(str) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(str).trim());
  if (!m) return null;
  let hour = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) hour += 12;
  return { hour, minute: parseInt(m[2], 10) };
}

export function parseSlotLabel(label, lang) {
  const [dayPart, timePart] = String(label || '').split('·').map((s) => s.trim());
  const dayOffset = resolveDayOffset(dayPart, lang);
  const time = timePart ? parseTime(timePart) : null;
  if (dayOffset == null || !time) return null;
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(time.hour, time.minute, 0, 0);
  return d.toISOString();
}
