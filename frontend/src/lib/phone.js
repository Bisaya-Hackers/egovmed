// PH mobile number handling, shared by Account (editing your saved number) and SignIn
// (switching to a different eGovPH account).

// Accepts common PH mobile formats the user is likely to type (09XX, +63, 63, with or without
// spaces/dashes) and returns canonical E.164 (+63XXXXXXXXXX) or null if it doesn't match.
// Matches the backend's z.string().regex(/^\+63\d{10}$/) after normalization.
export function normalizePhone(raw) {
  const cleaned = String(raw || '').replace(/[\s\-()]/g, '');
  if (/^\+63\d{10}$/.test(cleaned)) return cleaned;
  if (/^63\d{10}$/.test(cleaned)) return '+' + cleaned;
  if (/^09\d{9}$/.test(cleaned)) return '+63' + cleaned.slice(1);
  return null;
}

// Display form for a canonical +63XXXXXXXXXX: "+63 917 ••• 1234". Keeps the country code and
// operator prefix (enough to recognise your own number) and the last 4, hiding the middle so a
// full mobile number is never rendered on the sign-in screen, which is visible pre-auth.
export function maskPhone(e164) {
  const m = /^\+63(\d{3})\d{3}(\d{4})$/.exec(String(e164 || ''));
  return m ? `+63 ${m[1]} ••• ${m[2]}` : String(e164 || '');
}
