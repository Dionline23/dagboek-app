// Kern: gedeelde state, UI-helpers, scoreknoppen en tabnavigatie.
// Bezit de hertoewijsbare state (currentDate/currentRecord/activeTab) en
// exporteert die als live bindings; feature-modules lezen ze en muteren alleen
// properties. Zo blijft er één plek die de state daadwerkelijk hertoewijst.
import { todayStr, normalizeDay, relativeDayLabel, hasContent } from './logic.js';
import { dbGetDay, dbPutDay } from './db.js';

// ---- localStorage-sleutels (één bron van waarheid) ----
// Let op: js/boot.js gebruikt 'dagboek-theme' en 'dagboek-pin' letterlijk,
// omdat het als losse bootstrap vóór de modules draait.
export const LS = {
  theme: 'dagboek-theme',
  pin: 'dagboek-pin',
  pinSalt: 'dagboek-pin-salt',
  habits: 'dagboek-habits',
  goalExercise: 'dagboek-goal-exercise',
  gratitudeCount: 'dagboek-gratitude-count',
  onboarded: 'dagboek-onboarded',
  streakCelebrated: 'dagboek-streak-celebrated',
};

// ---- State (live bindings) ----
export let currentDate = todayStr();
export let currentRecord = null;
export let activeTab = 'vandaag';
let saveTimer = null;

export function emptyRecord(date) {
  return normalizeDay({ date });
}

export async function loadCurrent() {
  // normalizeDay vult ontbrekende velden centraal aan (nieuwe én ingeladen dagen)
  currentRecord = normalizeDay((await dbGetDay(currentDate)) || { date: currentDate });
}

export function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow(true), 400); // stil opslaan tijdens typen
}

export async function saveNow(silent = false) {
  clearTimeout(saveTimer);
  try {
    await dbPutDay(currentRecord);
    if (!silent) showToast('Opgeslagen ✓');
  } catch (err) {
    // bv. private mode of vol geheugen: meld het i.p.v. stil falen
    console.error('Opslaan mislukt', err);
    showToast('⚠️ Opslaan mislukt');
  }
}

export function getGoal() {
  return parseInt(localStorage.getItem(LS.goalExercise) || '0', 10) || 0;
}

// ---- "Opgeslagen"-toast ----
let toastTimer = null;
export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.add('hidden'), 250);
  }, 1100);
}

// ---- Lege-staat (vriendelijk, met icoon) ----
export function emptyState(icon, title, sub) {
  return `<div class="empty-state"><div class="es-icon">${icon}</div>` +
    `<div class="es-title">${title}</div>` +
    (sub ? `<div class="es-sub">${sub}</div>` : '') + '</div>';
}

// ---- Bevestigingsdialoog ----
export function confirmDialog({ title = 'Bevestigen', message = '', confirmText = 'Oké', danger = false }) {
  return new Promise((resolve) => {
    const ov = document.getElementById('dialog');
    document.getElementById('dialog-title').textContent = title;
    document.getElementById('dialog-msg').textContent = message;
    const c = document.getElementById('dialog-confirm');
    const cancel = document.getElementById('dialog-cancel');
    c.textContent = confirmText;
    c.classList.toggle('danger', danger);
    ov.classList.remove('hidden');
    const cleanup = (val) => {
      ov.classList.add('hidden');
      c.onclick = null; cancel.onclick = null; ov.onclick = null;
      resolve(val);
    };
    c.onclick = () => cleanup(true);
    cancel.onclick = () => cleanup(false);
    ov.onclick = (e) => { if (e.target === ov) cleanup(false); };
  });
}

// ---- Snackbar met "ongedaan maken" ----
let snackbarTimer = null;
export function showUndo(message, onUndo) {
  const sb = document.getElementById('snackbar');
  document.getElementById('snackbar-text').textContent = message;
  const act = document.getElementById('snackbar-action');
  sb.classList.remove('hidden');
  void sb.offsetHeight; // forceer reflow zodat de transitie speelt
  sb.classList.add('show');
  clearTimeout(snackbarTimer);
  const hide = () => {
    sb.classList.remove('show');
    setTimeout(() => sb.classList.add('hidden'), 250);
    act.onclick = null;
  };
  act.onclick = () => { onUndo(); hide(); haptic(12); };
  snackbarTimer = setTimeout(hide, 5000);
}

// ---- Haptische feedback (trilling bij tikken, alleen waar ondersteund) ----
export function haptic(ms = 8) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (e) { /* genegeerd */ }
  }
}

// ---- Score-knoppenrijen (gedeeld door Vandaag en Pijn) ----
export function buildScoreRow(container, field) {
  const min = Number(container.dataset.min);
  const max = Number(container.dataset.max);
  const noteField = field + 'Note';
  container.dataset.field = field;
  container.dataset.note = noteField;
  container.innerHTML = '';
  for (let v = min; v <= max; v++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = v;
    btn.dataset.value = v;
    btn.addEventListener('click', () => {
      currentRecord[field] = currentRecord[field] === v ? null : v;
      updateScoreRow(container, currentRecord[field]);
      saveNow();
    });
    container.appendChild(btn);
  }
  // kort toelichtingsveld op de vrije plek rechtsonder (waar voorheen de 10 stond)
  const note = document.createElement('input');
  note.type = 'text';
  note.className = 'score-note';
  note.placeholder = '✎ Toelichting (optioneel)';
  note.maxLength = 100;
  note.setAttribute('aria-label', 'Toelichting bij dit cijfer');
  note.addEventListener('input', (e) => {
    currentRecord[noteField] = e.target.value;
    scheduleSave();
  });
  container.appendChild(note);
}

// kleur op basis van waarde: 'good' = hoog groen, 'bad' = hoog rood
export function scaleColor(v, min, max, polarity) {
  const t = max === min ? 0.5 : (v - min) / (max - min);
  const hue = polarity === 'bad' ? (1 - t) * 120 : t * 120;
  return `hsl(${hue}, 60%, 45%)`;
}

export function updateScoreRow(container, value) {
  const min = Number(container.dataset.min);
  const max = Number(container.dataset.max);
  const polarity = container.dataset.polarity || 'good';
  for (const btn of container.querySelectorAll('button')) {
    const v = Number(btn.dataset.value);
    const sel = v === value;
    btn.classList.toggle('selected', sel);
    btn.style.background = sel ? scaleColor(v, min, max, polarity) : '';
    btn.style.borderColor = sel ? scaleColor(v, min, max, polarity) : '';
  }
  // toelichting bij dit cijfer terugzetten
  const ni = container.querySelector('.score-note');
  if (ni) ni.value = currentRecord[container.dataset.note] || '';
}

// ---- Tabnavigatie ----
const TAB_TITLES = { vandaag: 'Dagboek', pijn: 'Pijn', geschiedenis: 'Geschiedenis', inzichten: 'Inzichten', meer: 'Instellingen' };
// Renderers worden door main.js geregistreerd, zodat core geen feature-modules
// hoeft te importeren (voorkomt circulaire afhankelijkheden).
let tabRenderers = {};
export function registerTabRenderers(map) { tabRenderers = map; }

export function switchTab(name) {
  activeTab = name;
  for (const sec of document.querySelectorAll('.tab')) {
    sec.classList.toggle('hidden', sec.id !== `tab-${name}`);
  }
  for (const btn of document.querySelectorAll('.tabbtn')) {
    btn.classList.toggle('active', btn.dataset.tab === name);
  }
  document.getElementById('header-title').textContent = TAB_TITLES[name];
  document.getElementById('header-date').textContent =
    name === 'vandaag' || name === 'pijn' ? relativeDayLabel(currentDate) : '';

  // begin bovenaan bij elke tabwissel
  window.scrollTo({ top: 0, behavior: 'auto' });

  if (tabRenderers[name]) tabRenderers[name]();
}

// ---- Dag openen / navigeren (enige plek die currentDate/currentRecord hertoewijst) ----
export async function openDate(date) {
  await saveNow(true);
  currentDate = date;
  await loadCurrent();
  switchTab('vandaag');
}

export async function backToToday() {
  await saveNow(true);
  currentDate = todayStr();
  await loadCurrent();
  switchTab(activeTab);
}

// bij terugkeren uit de achtergrond: naar vandaag springen als de dag verstreken is
export async function advanceToTodayIfNeeded() {
  if (currentDate < todayStr() && document.getElementById('not-today-banner').classList.contains('hidden')) {
    currentDate = todayStr();
    await loadCurrent();
    switchTab(activeTab);
  }
}

export async function clearCurrentDay() {
  if (!hasContent(currentRecord)) { showToast('Deze dag is al leeg'); return; }
  const snapshot = JSON.parse(JSON.stringify(currentRecord));
  currentRecord = emptyRecord(currentDate);
  await saveNow(true);
  switchTab('vandaag');
  showUndo('Dag leeggemaakt', async () => {
    currentRecord = snapshot;
    await saveNow(true);
    switchTab('vandaag');
  });
}
