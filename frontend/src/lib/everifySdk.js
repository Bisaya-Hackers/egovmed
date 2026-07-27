// eVerify Face Liveness Web SDK loader.
// Per the eVerify portal's "Face Liveness Web SDK Integration Guide": load this script, then call
// window.eKYC().start({ pubKey }) to run an in-browser liveness capture. On success it resolves
// { status: 'COMPLETED', result: { session_id, photo, photo_url } } — session_id is what the
// backend's POST /identity/liveness/everify-sdk registers, then POST /identity/verify consumes.
const SDK_SRC = 'https://hackathon-everify-face-liveness.e.gov.ph/js/everify-liveness-sdk.min.js';

let loadPromise = null;

function loadScript() {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (window.eKYC) { resolve(); return; }
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => (window.eKYC ? resolve() : reject(new Error('eVerify SDK loaded but window.eKYC is missing')));
    script.onerror = () => reject(new Error('Failed to load the eVerify Face Liveness SDK'));
    document.body.appendChild(script);
  });
  return loadPromise;
}

/** Runs the eVerify Web SDK's in-browser liveness capture. Returns the session_id on success. */
export async function runEverifyLivenessCapture(pubKey) {
  if (!pubKey) throw new Error('eVerify pubKey is not configured');
  await loadScript();
  const response = await window.eKYC().start({ pubKey });
  const sessionId = response?.result?.session_id;
  if (!sessionId) throw new Error('eVerify SDK did not return a session_id');
  return sessionId;
}
