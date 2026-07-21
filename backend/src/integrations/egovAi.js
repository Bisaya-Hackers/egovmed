'use strict';
const { env } = require('../config/env');
const http = require('../lib/http');
const logger = require('../lib/logger');

const cfg = env.egovAi;

const SPECIALTIES = [
  'General Medicine', 'Cardiology', 'Pulmonology', 'Neurology', 'Gastroenterology',
  'Orthopedics', 'Pediatrics', 'OB-GYN', 'Dermatology', 'ENT', 'Ophthalmology',
  'Psychiatry', 'Emergency Medicine', 'Surgery',
];

const SYSTEM_PROMPT = `You are the triage engine for eGovMed, a Philippine public-hospital front door.
Input may be in Tagalog, English, or Taglish. Translate internally as needed.
You are DECISION SUPPORT, not a diagnosis. A nurse confirms every result.
Classify the patient's symptoms and respond with STRICT JSON only, no prose:
{
  "specialty": one of ${JSON.stringify(SPECIALTIES)},
  "urgency": "emergency" | "urgent" | "routine",
  "red_flags": string[],           // concrete danger signs found, [] if none
  "summary_en": string,            // 1-2 sentence English summary for the doctor
  "reasoning": string,             // short rationale
  "recommended_action": string,    // e.g. "Proceed to ER immediately", "Book Cardiology"
  "confidence": number             // 0..1
}
Always include an urgency flag. If any life-threatening sign is present, set urgency "emergency".`;

// eGov AI auth: mint a Bearer token from the team access code (per apidocumentation/eGov-AI-API.md).
let aiTokenCache = null;
const isAiLive = () => cfg.mode === 'live' && !!cfg.accessCode && !!cfg.baseUrl;
async function egovAiToken() {
  if (aiTokenCache && aiTokenCache.expiresAt > Date.now() + 5000) return aiTokenCache.token;
  const res = await http.post(`${cfg.baseUrl}/api/v1/egov/integration/token`, { access_code: cfg.accessCode });
  const token = res && res.access_token;
  if (!token) throw new Error('eGov AI token endpoint returned no access_token');
  aiTokenCache = { token, expiresAt: Date.now() + (res.expires_in_seconds || 28800) * 1000 };
  return token;
}

// The AI endpoints return free text in `data`; pull the JSON object out of it.
function parseJsonFromText(s) {
  if (!s || typeof s !== 'string') return {};
  const t = s.replace(/```(?:json)?/gi, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  try { return JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t); } catch { return {}; }
}

/**
 * Classify free-text symptoms → structured triage result.
 * live: eGov AI /ai_assistant/generate (prompt → free text, parsed to JSON). mock: deterministic rule-based fallback.
 */
async function classifySymptoms({ text, language = 'auto', patientContext = {} }) {
  if (isAiLive()) {
    try {
      const token = await egovAiToken();
      const prompt = `${SYSTEM_PROMPT}\n\nPatient context: ${JSON.stringify(patientContext)}\nInput language: ${language}\nSymptoms: ${text}\n\nReturn ONLY the JSON object described above, no prose.`;
      const res = await http.post(`${cfg.baseUrl}/api/v1/egov/integration/ai_assistant/generate`, {
        prompt, category: cfg.category,
      }, { headers: { Authorization: `Bearer ${token}` }, timeoutMs: 25000 });
      return sanitize(parseJsonFromText(res?.data), text); // sanitize() applies the rule-based emergency floor
    } catch (err) {
      logger.warn('eGov AI live call failed — using rule-based fallback', { err: err.message });
    }
  }
  return ruleBasedTriage(text);
}

function sanitize(parsed, text) {
  // Model output is untrusted: it may be null, an array, a string, or an adversarially
  // crafted object (prompt injection via the symptom text). Coerce to a safe object first.
  const p = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};

  let specialty = SPECIALTIES.includes(p.specialty) ? p.specialty : 'General Medicine';
  let urgency = ['emergency', 'urgent', 'routine'].includes(p.urgency) ? p.urgency : 'routine';
  let redFlags = Array.isArray(p.red_flags) ? p.red_flags.filter((s) => typeof s === 'string') : [];
  let recommendedAction = typeof p.recommended_action === 'string' && p.recommended_action ? p.recommended_action : null;

  // SAFETY FLOOR: never let the live model under-triage below the deterministic rule check.
  // If the offline rules see an emergency, the result is forced to emergency regardless of
  // what the model returned (malformed JSON, injection, or a genuine miss).
  const floor = ruleBasedTriage(text);
  if (floor.urgency === 'emergency' && urgency !== 'emergency') {
    urgency = 'emergency';
    specialty = 'Emergency Medicine';
    redFlags = Array.from(new Set([...redFlags, ...floor.redFlags]));
    recommendedAction = 'Proceed to ER immediately — seek immediate human medical assessment';
  }

  const confidence = Number.isFinite(p.confidence) ? Math.min(1, Math.max(0, p.confidence)) : 0.6;
  return {
    specialty,
    urgency,
    redFlags,
    summaryEn: typeof p.summary_en === 'string' && p.summary_en ? p.summary_en : text.slice(0, 200),
    reasoning: typeof p.reasoning === 'string' ? p.reasoning : '',
    recommendedAction: recommendedAction || (urgency === 'emergency' ? 'Proceed to ER immediately' : `Book ${specialty}`),
    confidence,
    engine: 'egov-ai',
  };
}

/** Transparent keyword heuristic. Bilingual (EN/TL). Good enough to demo offline. */
function ruleBasedTriage(text = '') {
  const t = text.toLowerCase();
  const has = (...ks) => ks.some((k) => t.includes(k));

  const emergency = has(
    'chest pain', 'sakit ng dibdib', 'heart attack', 'atake sa puso',
    'hindi makahinga', 'difficulty breathing', 'shortness of breath', 'not breathing', 'hindi humihinga',
    'choking', 'nasasamid', 'hindi makalunok',
    'unconscious', 'nawalan ng malay', 'unresponsive', 'blue lips', 'nangingitim',
    'seizure', 'convulsion', 'kombulsyon', 'stroke', 'paralysis', 'paralisado',
    'bleeding', 'dugo', 'hemorrhage', 'dumudugo',
    'anaphylaxis', 'allergic reaction', 'namamaga ang lalamunan',
    'overdose', 'poison', 'lason', 'nalason',
    'labor', 'manganganak', 'nanganganak', 'putok ng panubigan',
    'suicidal', 'severe', 'grabe', 'matindi',
  );
  let specialty = 'General Medicine';
  const redFlags = [];

  if (has('chest pain', 'sakit ng dibdib', 'palpitation', 'kabog')) specialty = 'Cardiology';
  else if (has('hindi makahinga', 'ubo', 'cough', 'hika', 'asthma', 'breathing')) specialty = 'Pulmonology';
  else if (has('sakit ng ulo', 'headache', 'dizzy', 'hilo', 'seizure', 'numbness', 'manhid')) specialty = 'Neurology';
  else if (has('tiyan', 'abdomen', 'stomach', 'suka', 'vomit', 'diarrhea', 'lbm')) specialty = 'Gastroenterology';
  else if (has('buto', 'bone', 'fracture', 'bali', 'joint', 'kasukasuan')) specialty = 'Orthopedics';
  else if (has('bata', 'child', 'anak', 'infant', 'sanggol')) specialty = 'Pediatrics';
  else if (has('buntis', 'pregnan', 'regla', 'menstru')) specialty = 'OB-GYN';
  else if (has('balat', 'skin', 'rash', 'pantal', 'itch')) specialty = 'Dermatology';
  else if (has('mata', 'eye', 'vision', 'malabo')) specialty = 'Ophthalmology';
  else if (has('malungkot', 'depress', 'anxiety', 'balisa', 'suicidal')) specialty = 'Psychiatry';

  if (has('chest pain', 'sakit ng dibdib', 'heart attack', 'atake sa puso')) redFlags.push('Chest pain / possible cardiac event');
  if (has('hindi makahinga', 'difficulty breathing', 'shortness of breath', 'not breathing', 'hindi humihinga')) redFlags.push('Breathing difficulty');
  if (has('choking', 'nasasamid', 'hindi makalunok')) redFlags.push('Choking / airway obstruction');
  if (has('bleeding', 'dugo', 'hemorrhage', 'dumudugo')) redFlags.push('Active bleeding');
  if (has('nawalan ng malay', 'unconscious', 'unresponsive')) redFlags.push('Loss of consciousness');
  if (has('stroke', 'paralysis', 'paralisado')) redFlags.push('Possible stroke');
  if (has('seizure', 'convulsion', 'kombulsyon')) redFlags.push('Seizure');
  if (has('anaphylaxis', 'allergic reaction', 'namamaga ang lalamunan')) redFlags.push('Possible anaphylaxis');
  if (has('overdose', 'poison', 'lason', 'nalason')) redFlags.push('Poisoning / overdose');
  if (has('labor', 'manganganak', 'nanganganak', 'putok ng panubigan')) redFlags.push('Obstetric emergency (labor)');
  if (has('suicidal')) redFlags.push('Suicidal ideation');

  const urgency = emergency ? 'emergency' : redFlags.length ? 'urgent' : 'routine';
  return {
    specialty: emergency ? 'Emergency Medicine' : specialty,
    urgency,
    redFlags,
    summaryEn: text.slice(0, 200),
    reasoning: 'Keyword-based fallback triage (eGov AI unavailable).',
    recommendedAction: urgency === 'emergency' ? 'Proceed to ER immediately' : `Book ${specialty}`,
    confidence: 0.4,
    engine: 'rule-based-fallback',
  };
}

/** Summarize a patient's history for the doctor (used at the visit step). */
async function summarizeHistory({ records = [], triage = [] }) {
  if (isAiLive()) {
    try {
      const token = await egovAiToken();
      // eGovAI expects natural-language prompts, not raw JSON (rejects with 422). Build a compact
      // human-readable brief with only titles/dates/facility/summary — NO raw PHI values.
      const labLines = records.filter((r) => r.type === 'lab').slice(-8).map((r) => {
        const date = r.createdAt ? String(r.createdAt).slice(0, 10) : 'unknown date';
        const src = r.sourceFacility || 'unknown facility';
        const note = r.summary ? ` — ${String(r.summary).slice(0, 160)}` : '';
        return `- ${r.title} at ${src} on ${date}${note}`;
      });
      const triageLines = triage.slice(-5).map((t) => {
        const when = t.createdAt ? String(t.createdAt).slice(0, 10) : 'recent';
        return `- ${when}: routed to ${t.specialty || 'General Medicine'} (${t.urgency || 'routine'})`;
      });
      const prompt = [
        'Summarize this Filipino patient\'s medical history for a clinician in 4-6 concise English bullet points.',
        'Note trends, risk flags, and follow-up items. Do not invent data.',
        '',
        labLines.length ? `Labs on file (${records.filter((r) => r.type === 'lab').length}):` : 'No labs on file.',
        ...labLines,
        '',
        triageLines.length ? `Recent triage results (${triage.length}):` : 'No prior triage.',
        ...triageLines,
      ].join('\n');
      const res = await http.post(`${cfg.baseUrl}/api/v1/egov/integration/ai_assistant/generate`, {
        prompt, category: cfg.category,
      }, { headers: { Authorization: `Bearer ${token}` }, timeoutMs: 20000 });
      const text = res && res.data;
      return typeof text === 'string' && text.trim() ? text : fallbackSummary(records, triage);
    } catch (err) {
      logger.warn('history summary live call failed', { err: err.message });
    }
  }
  return fallbackSummary(records, triage);
}

function fallbackSummary(records, triage) {
  const labs = records.filter((r) => r.type === 'lab').map((r) => `${r.title} (${r.sourceFacility})`);
  const lastTriage = triage[triage.length - 1];
  return [
    `Records on file: ${records.length}`,
    labs.length ? `Verified labs: ${labs.join('; ')}` : 'No verified labs on file.',
    lastTriage ? `Latest triage: ${lastTriage.specialty} / ${lastTriage.urgency}` : 'No prior triage.',
  ].join('\n• ');
}

module.exports = { classifySymptoms, summarizeHistory, SPECIALTIES };
