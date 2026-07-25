// Builds patient-facing reference numbers like "PGH-4821-QK".
//
// Two things this fixes vs. a naive version:
//  - Hospital is abbreviated (e.g. "Philippine General Hospital" -> "PGH") instead of
//    spelling the whole facility name into the reference, which read as a generic label
//    rather than a reference code.
//  - The digit block is derived from a hash of the booking's stable id, not the raw queue
//    number — queue numbers are small and sequential (0001, 0002, …), which made every
//    reference look like a predictable, generic placeholder. Hashing keeps the same
//    booking always rendering the same reference (stable across reloads/screens) while
//    looking like a real, unpredictable reference code.
//
// Two modes:
//  - No seed (no real appointment to anchor to — the offline/fallback case): everything
//    is freshly randomized on each render.
//  - With a seed (a real appointment's id, falling back to queue number): both the digit
//    and letter blocks are derived deterministically from the seed.

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no ambiguous I/O
const STOPWORDS = new Set(['ng', 'ang', 'sa', 'at', 'the', 'of', 'and', 'for']);

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

// "Philippine General Hospital" -> "PGH", "Makati Medical Center" -> "MMC",
// "Ospital ng Maynila" -> "OM" (stopwords skipped). Already-short abbreviations
// (e.g. someone passes "PGH" directly) pass through unchanged.
function abbreviateHospital(name) {
  const raw = String(name || '').trim();
  if (!raw) return 'GEN';
  const words = raw.split(/\s+/).filter((w) => w && !STOPWORDS.has(w.toLowerCase()));
  if (words.length <= 1) return raw.slice(0, 4).toUpperCase() || 'GEN';
  return words.map((w) => w[0].toUpperCase()).join('').slice(0, 4);
}

function digitsFromSeed(seed) {
  const h = hash(`D:${seed}`);
  return String(1000 + (h % 9000)); // 1000-9999, stable per seed, no visible sequence
}

function lettersFromSeed(seed) {
  const h = hash(`L:${seed}`);
  return LETTERS[h % LETTERS.length] + LETTERS[Math.floor(h / LETTERS.length) % LETTERS.length];
}

/**
 * @param {string} [hospital='PGH'] hospital name (abbreviated automatically) to prefix with
 * @param {number|string} [queueNumber] real queue number for a booking, used as the seed
 *   fallback when no explicit seed is given
 * @param {string|number} [seed] stable identifier (e.g. appointment id) to derive the
 *   digit + letter blocks from; falls back to `queueNumber` when omitted
 */
export function makeRefNo(hospital = 'PGH', queueNumber, seed) {
  const abbr = abbreviateHospital(hospital);
  const anchor = seed != null && seed !== '' ? seed : queueNumber;
  if (anchor != null && anchor !== '') {
    return `${abbr}-${digitsFromSeed(anchor)}-${lettersFromSeed(anchor)}`;
  }
  return `${abbr}-${randDigits(4)}-${randLetters(2)}`;
}
