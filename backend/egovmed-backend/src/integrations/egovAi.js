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

/**
 * Classify free-text symptoms → structured triage result.
 * live: calls eGov AI. mock/no-key: deterministic rule-based fallback so the demo never breaks.
 */
async function classifySymptoms({ text, language = 'auto', patientContext = {} }) {
  if (cfg.mode === 'live' && cfg.apiKey) {
    try {
      const res = await http.post(`${cfg.baseUrl}/v1/chat/completions`, {
        model: cfg.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify({ symptoms: text, language, patientContext }) },
        ],
      }, { headers: { Authorization: `Bearer ${cfg.apiKey}` }, timeoutMs: 25000 });

      const content = res?.choices?.[0]?.message?.content ?? res?.output ?? res;
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      return sanitize(parsed, text);
    } catch (err) {
      logger.warn('eGov AI live call failed — using rule-based fallback', { err: err.message });
    }
  }
  return ruleBasedTriage(text);
}

function sanitize(p, text) {
  const specialty = SPECIALTIES.includes(p.specialty) ? p.specialty : 'General Medicine';
  const urgency = ['emergency', 'urgent', 'routine'].includes(p.urgency) ? p.urgency : 'routine';
  return {
    specialty,
    urgency,
    redFlags: Array.isArray(p.red_flags) ? p.red_flags : [],
    summaryEn: p.summary_en || text.slice(0, 200),
    reasoning: p.reasoning || '',
    recommendedAction: p.recommended_action || (urgency === 'emergency' ? 'Proceed to ER immediately' : `Book ${specialty}`),
    confidence: typeof p.confidence === 'number' ? p.confidence : 0.6,
    engine: 'egov-ai',
  };
}

/** Transparent keyword heuristic. Bilingual (EN/TL). Good enough to demo offline. */
function ruleBasedTriage(text = '') {
  const t = text.toLowerCase();
  const has = (...ks) => ks.some((k) => t.includes(k));

  const emergency = has('chest pain', 'sakit ng dibdib', 'hindi makahinga', 'difficulty breathing', 'shortness of breath',
    'unconscious', 'nawalan ng malay', 'seizure', 'kombulsyon', 'stroke', 'bleeding', 'dugo', 'suicidal', 'severe');
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

  if (has('chest pain', 'sakit ng dibdib')) redFlags.push('Chest pain');
  if (has('hindi makahinga', 'difficulty breathing', 'shortness of breath')) redFlags.push('Breathing difficulty');
  if (has('bleeding', 'dugo')) redFlags.push('Active bleeding');
  if (has('nawalan ng malay', 'unconscious')) redFlags.push('Loss of consciousness');
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
  if (cfg.mode === 'live' && cfg.apiKey) {
    try {
      const res = await http.post(`${cfg.baseUrl}/v1/chat/completions`, {
        model: cfg.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'Summarize this patient history for a clinician in 4-6 concise bullet points. English.' },
          { role: 'user', content: JSON.stringify({ records, triage }) },
        ],
      }, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
      return res?.choices?.[0]?.message?.content || fallbackSummary(records, triage);
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
