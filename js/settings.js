// Tab: Instellingen ("Meer") — thema, pincode (incl. lock-scherm), sportdoel
// en de update-melding.
import { showToast, haptic, LS, getGoal } from './core.js';

// ---- Pincode (app-slot) ----
const PIN_HASH_KEY = LS.pin;
const PIN_SALT_KEY = LS.pinSalt;
const PIN_ITERATIONS = 150000;

export function isPinSet() {
  return !!localStorage.getItem(PIN_HASH_KEY);
}

function getPinSalt() {
  let s = localStorage.getItem(PIN_SALT_KEY);
  if (!s) {
    const b = crypto.getRandomValues(new Uint8Array(16));
    s = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(PIN_SALT_KEY, s);
  }
  return s;
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

// Gesalte PBKDF2-afleiding (v2): duur genoeg om brute-force af te remmen.
async function derivePin(pin) {
  const salt = hexToBytes(getPinSalt());
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PIN_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Oud formaat (v1): ongesalte SHA-256 met vaste prefix. Alleen om bestaande
// pincodes te herkennen en stilletjes te upgraden naar het nieuwe formaat.
async function legacyHashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('dagboek:' + pin));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function setPin(pin) {
  localStorage.setItem(PIN_HASH_KEY, await derivePin(pin));
}

// true als de pin klopt; upgradet een oude v1-hash transparant naar v2.
async function verifyPin(pin) {
  const stored = localStorage.getItem(PIN_HASH_KEY);
  if (!stored) return false;
  if ((await derivePin(pin)) === stored) return true;
  if ((await legacyHashPin(pin)) === stored) {
    await setPin(pin); // upgrade bij eerste juiste invoer
    return true;
  }
  return false;
}

function refreshPinUI() {
  const has = isPinSet();
  document.getElementById('pin-status').textContent = has
    ? 'Pincode staat aan. De app vergrendelt bij openen en zodra hij naar de achtergrond gaat. Let op: dit is een drempel, geen versleuteling — je data staat onversleuteld op dit apparaat.'
    : 'Geen pincode ingesteld. Stel er een in om de app te vergrendelen.';
  document.getElementById('pin-set-row').classList.toggle('hidden', has);
  document.getElementById('btn-pin-remove').classList.toggle('hidden', !has);
}

export function initPinUI() {
  refreshPinUI();
  document.getElementById('btn-pin-set').addEventListener('click', async () => {
    const input = document.getElementById('pin-new');
    const pin = input.value.trim();
    if (!/^\d{4}$/.test(pin)) {
      showToast('Voer 4 cijfers in');
      return;
    }
    await setPin(pin);
    input.value = '';
    refreshPinUI();
    showToast('Pincode ingesteld 🔒');
  });
  document.getElementById('btn-pin-remove').addEventListener('click', () => {
    // vraag huidige pin via het lock-scherm in "verwijder"-modus
    openLockScreen(true);
  });
  buildKeypad();
}

let lockRemoveMode = false;
let lockEntry = '';
let pinFailCount = 0;
let pinLockUntil = 0;

function startPinLockCountdown() {
  const err = document.getElementById('lock-error');
  err.classList.remove('hidden');
  const tick = () => {
    const left = Math.ceil((pinLockUntil - Date.now()) / 1000);
    if (left > 0) {
      err.textContent = `Te veel pogingen. Wacht ${left}s.`;
      setTimeout(tick, 500);
    } else {
      err.textContent = 'Onjuiste pincode';
      err.classList.add('hidden');
    }
  };
  tick();
}

export function openLockScreen(removeMode = false) {
  lockRemoveMode = removeMode;
  lockEntry = '';
  document.getElementById('lock-error').classList.add('hidden');
  document.querySelector('#lock-screen h2').textContent = removeMode ? 'Voer je pincode in om te verwijderen' : 'Voer je pincode in';
  updateLockDots();
  document.getElementById('lock-screen').classList.remove('hidden');
  document.documentElement.classList.add('locked');
}

function closeLockScreen() {
  document.getElementById('lock-screen').classList.add('hidden');
  document.documentElement.classList.remove('locked');
}

function updateLockDots() {
  const dots = document.querySelectorAll('#lock-dots i');
  dots.forEach((d, i) => d.classList.toggle('filled', i < lockEntry.length));
}

function buildKeypad() {
  const pad = document.getElementById('lock-keypad');
  pad.innerHTML = '';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  for (const k of keys) {
    const btn = document.createElement('button');
    btn.className = 'key';
    if (k === '') { btn.classList.add('key-empty'); btn.disabled = true; }
    btn.textContent = k;
    btn.addEventListener('click', () => onKeypad(k));
    pad.appendChild(btn);
  }
}

async function onKeypad(k) {
  if (pinLockUntil > Date.now()) return; // tijdelijk vergrendeld na te veel pogingen
  if (k === '⌫') {
    lockEntry = lockEntry.slice(0, -1);
  } else if (k && lockEntry.length < 4) {
    lockEntry += k;
  }
  updateLockDots();
  if (lockEntry.length === 4) {
    const ok = await verifyPin(lockEntry);
    if (ok) {
      pinFailCount = 0;
      if (lockRemoveMode) {
        localStorage.removeItem(PIN_HASH_KEY);
        refreshPinUI();
        showToast('Pincode verwijderd');
      }
      closeLockScreen();
    } else {
      pinFailCount++;
      lockEntry = '';
      updateLockDots();
      if (pinFailCount >= 5) {
        pinFailCount = 0;
        pinLockUntil = Date.now() + 30000; // 30s afkoelen
        startPinLockCountdown();
      } else {
        const err = document.getElementById('lock-error');
        err.textContent = 'Onjuiste pincode';
        err.classList.remove('hidden');
      }
    }
  }
}

// ---- Thema (licht/donker/AMOLED/auto) ----
const THEME_COLORS = { light: '#ffffff', dark: '#181b22', amoled: '#000000' };

function applyThemeColorMeta(theme) {
  let resolved = theme;
  if (theme === 'auto') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[resolved] || '#ffffff');
}

function getTheme() {
  return localStorage.getItem(LS.theme) || 'auto';
}

function setTheme(theme) {
  localStorage.setItem(LS.theme, theme);
  document.documentElement.dataset.theme = theme;
  applyThemeColorMeta(theme);
  for (const b of document.querySelectorAll('#theme-segment button')) {
    b.classList.toggle('active', b.dataset.themeChoice === theme);
  }
}

export function initThemeUI() {
  const cur = getTheme();
  document.documentElement.dataset.theme = cur;
  setTheme(cur);
  document.getElementById('theme-segment').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    setTheme(btn.dataset.themeChoice);
    haptic(10);
  });
  // volg systeemwissel wanneer 'auto' actief is
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'auto') applyThemeColorMeta('auto');
  });
}

// ---- Sportdoel ----
export function initGoalUI() {
  const input = document.getElementById('goal-input');
  input.value = getGoal() || '';
  input.addEventListener('input', () => {
    const v = Math.min(10080, Math.max(0, parseInt(input.value, 10) || 0));
    localStorage.setItem(LS.goalExercise, String(v));
  });
}

// ---- Update-melding ----
let waitingWorker = null;
export function showUpdateBanner(worker) {
  waitingWorker = worker;
  document.getElementById('update-banner').classList.remove('hidden');
}
export function applyUpdate() {
  if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}
