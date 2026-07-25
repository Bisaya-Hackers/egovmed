// Builds patient-facing reference numbers like "PGH-4821-QK".
//
// Two modes:
//  - No seed (no real appointment to anchor to — the offline/fallback case): everything
//    is freshly randomized, so we stop showing the same hardcoded demo number to everyone.
//  - With a seed (a real appointment's id/queue number): the letter suffix is derived
//    deterministically from the seed, so the SAME booking always renders the SAME
//    reference number across reloads, screens (Home, Confirm), and reload-resume syncs.

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no ambiguous I/O

const randDigits = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
const randLetters = (n) => Array.from({ length: n }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');

// Small deterministic string hash (FNV-1a) — same input always yields the same output.
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function lettersFromSeed(seed) {
  const h = hash(String(seed));
  return LETTERS[h % LETTERS.length] + LETTERS[Math.floor(h / LETTERS.length) % LETTERS.length];
}

/**
 * @param {string} [hospital='PGH'] hospital name/abbreviation to prefix with
 * @param {number|string} [queueNumber] real queue number for a booking, if one exists
 * @param {string|number} [seed] stable identifier (e.g. appointment id) to derive the
 *   letter suffix from; falls back to `queueNumber` when omitted
 */
export function makeRefNo(hospital = 'PGH', queueNumber, seed) {
  const digits = queueNumber != null && queueNumber !== ''
    ? String(queueNumber).padStart(4, '0')
    : randDigits(4);
  const anchor = seed != null && seed !== '' ? seed : queueNumber;
  const letters = anchor != null && anchor !== '' ? lettersFromSeed(anchor) : randLetters(2);
  return `${hospital}-${digits}-${letters}`;
}
