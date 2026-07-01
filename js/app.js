// ---- Datum-helpers (lokale tijdzone) ----
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

function formatDate(dateStr, withDay = true) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const base = `${d} ${MAANDEN[m - 1]} ${y}`;
  return withDay ? `${DAGEN[dt.getDay()]} ${base}` : base;
}

// "vandaag" / "gisteren" / "eergisteren" / volledige datum
function relativeDayLabel(dateStr) {
  const diff = Math.round((new Date(todayStr()) - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'Vandaag';
  if (diff === 1) return 'Gisteren';
  if (diff === 2) return 'Eergisteren';
  if (diff === -1) return 'Morgen';
  return formatDate(dateStr, false);
}

// ---- State ----
let currentDate = todayStr();
let currentRecord = null;
let saveTimer = null;

function emptyRecord(date) {
  return {
    date,
    mood: null,
    morningScore: null,
    morningScoreNote: '',
    eveningScore: null,
    eveningScoreNote: '',
    gratitude: ['', '', ''],
    journal: '',
    exerciseMinutes: null,
    habits: {},
    painMorning: null,
    painMorningNote: '',
    painAfternoon: null,
    painAfternoonNote: '',
    painEvening: null,
    painEveningNote: '',
    painLocations: [],
    painDetails: {},
    painNote: '',
    done: {},
  };
}

// representatieve pijnscore van een dag (gemiddelde van ingevulde dagdelen, anders oude losse score)
function painRepresentative(r) {
  if (!r) return null;
  const parts = [r.painMorning, r.painAfternoon, r.painEvening].filter((v) => v != null);
  if (parts.length) return parts.reduce((s, v) => s + v, 0) / parts.length;
  return r.painScore != null ? r.painScore : null;
}

// ---- Stemming ----
const MOODS = [
  { v: 1, e: '😞', l: 'Slecht' },
  { v: 2, e: '😕', l: 'Matig' },
  { v: 3, e: '😐', l: 'Neutraal' },
  { v: 4, e: '🙂', l: 'Goed' },
  { v: 5, e: '😄', l: 'Top' },
];

function buildMoodRow() {
  const row = document.getElementById('mood-row');
  row.innerHTML = '';
  for (const m of MOODS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mood-btn';
    btn.innerHTML = `<span class="mood-emoji">${m.e}</span><span class="mood-label">${m.l}</span>`;
    btn.title = m.l;
    btn.setAttribute('aria-label', m.l);
    btn.dataset.value = m.v;
    btn.addEventListener('click', () => {
      currentRecord.mood = currentRecord.mood === m.v ? null : m.v;
      renderMood();
      saveNow();
    });
    row.appendChild(btn);
  }
}

function renderMood() {
  for (const btn of document.getElementById('mood-row').children) {
    btn.classList.toggle('selected', Number(btn.dataset.value) === currentRecord.mood);
  }
}

// ---- Journal #tags ----
function extractTags(text) {
  const out = [];
  const re = /#([\p{L}0-9_]+)/gu;
  let m;
  while ((m = re.exec(text || '')) !== null) {
    const t = m[1].toLowerCase();
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

function renderJournalTags() {
  const wrap = document.getElementById('journal-tags');
  const tags = extractTags(currentRecord.journal);
  wrap.innerHTML = '';
  for (const t of tags) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.textContent = '#' + t;
    wrap.appendChild(chip);
  }
}

// ---- "Op deze dag" terugblik ----
function recSnippet(r) {
  if (r.journal && r.journal.trim()) return r.journal.trim().slice(0, 80) + (r.journal.length > 80 ? '…' : '');
  const parts = [];
  if (r.mood != null) parts.push((MOODS.find((x) => x.v === r.mood) || {}).e || '');
  if (r.eveningScore != null) parts.push(`avond ${r.eveningScore}`);
  else if (r.morningScore != null) parts.push(`ochtend ${r.morningScore}`);
  if ((r.gratitude || []).some((g) => g)) parts.push('dankbaarheid');
  return parts.join(' · ') || 'ingevuld';
}

async function renderOnThisDay() {
  const card = document.getElementById('onthisday-card');
  const list = document.getElementById('onthisday-list');
  card.classList.add('hidden');
  if (currentDate !== todayStr()) return;
  const [y, m, d] = todayStr().split('-').map(Number);
  const targets = [
    { label: '1 maand geleden', date: monthsAgo(y, m, d, 1) },
    { label: '1 jaar geleden', date: `${y - 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` },
    { label: '6 maanden geleden', date: monthsAgo(y, m, d, 6) },
  ];
  list.innerHTML = '';
  let any = false;
  for (const t of targets) {
    const rec = await dbGetDay(t.date);
    if (!rec || !hasContent(rec)) continue;
    any = true;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'onthisday-item';
    item.innerHTML = `<span class="otd-when">${t.label}</span><span class="otd-snip"></span>`;
    item.querySelector('.otd-snip').textContent = recSnippet(rec);
    item.addEventListener('click', () => openDate(t.date));
    list.appendChild(item);
  }
  card.classList.toggle('hidden', !any);
}

function monthsAgo(y, m, d, n) {
  const dt = new Date(y, m - 1 - n, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// ---- Streak: aantal dagen op rij ingevuld ----
let streakText = '';

function hasContent(r) {
  return r.mood != null || r.morningScore != null || r.eveningScore != null ||
    painRepresentative(r) != null || r.exerciseMinutes != null ||
    Object.values(r.habits || {}).some(Boolean) ||
    (r.painLocations || []).length > 0 || (r.journal || '').trim() !== '' ||
    (r.gratitude || []).some((g) => g && g.trim() !== '');
}

async function computeStreak() {
  const all = await dbGetAllDays();
  const filled = new Set(all.filter(hasContent).map((r) => r.date));
  let d = todayStr();
  if (!filled.has(d)) d = addDays(d, -1);
  let streak = 0;
  while (filled.has(d)) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

// ---- Inhaalprompt voor gemiste dagen ----
async function renderMissedPrompt() {
  const banner = document.getElementById('missed-banner');
  banner.classList.add('hidden');
  if (currentDate !== todayStr()) return;
  const all = await dbGetAllDays();
  const filled = new Set(all.filter(hasContent).map((r) => r.date));
  if (filled.size === 0) return;
  const first = [...filled].sort()[0];
  const missed = [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(todayStr(), -i);
    if (!filled.has(d) && d > first) missed.push(d);
  }
  if (missed.length === 0) return;
  banner.querySelector('span').textContent =
    missed.length === 1 ? 'Je miste 1 dag deze week' : `Je miste ${missed.length} dagen deze week`;
  banner.dataset.target = missed[0];
  banner.classList.remove('hidden');
}

// ---- "Klaar"-afvinkknoppen per onderdeel ----
const TODAY_DONE_KEYS = ['morning', 'evening', 'gratitude', 'journal', 'exercise'];

function toggleDone(key) {
  if (!currentRecord.done) currentRecord.done = {};
  currentRecord.done[key] = !currentRecord.done[key];
  renderDone();
  saveNow();
}

function renderDone() {
  const done = currentRecord.done || {};
  for (const btn of document.querySelectorAll('.done-btn')) {
    const isDone = !!done[btn.dataset.done];
    btn.classList.toggle('done', isDone);
    btn.closest('[data-done-card]').classList.toggle('card-done', isDone);
  }
  const total = TODAY_DONE_KEYS.length;
  const count = TODAY_DONE_KEYS.filter((k) => done[k]).length;

  // voortgangsring vullen
  const ringFill = document.getElementById('ring-fill');
  const circ = 2 * Math.PI * 20;
  ringFill.style.strokeDasharray = String(circ);
  ringFill.style.strokeDashoffset = String(circ * (1 - count / total));
  ringFill.classList.toggle('complete', count === total);
  document.getElementById('ring-text').textContent = `${count}/${total}`;

  document.getElementById('today-progress-label').textContent = count === total
    ? '🎉 Alles afgerond!'
    : count === 0 ? 'Begin je dag' : `${count} van ${total} afgerond`;
  document.getElementById('today-streak-label').textContent = streakText;
}

async function loadCurrent() {
  currentRecord = (await dbGetDay(currentDate)) || emptyRecord(currentDate);
  if (!currentRecord.painLocations) currentRecord.painLocations = [];
  if (!currentRecord.gratitude) currentRecord.gratitude = ['', '', ''];
  if (!currentRecord.done) currentRecord.done = {};
  if (!currentRecord.habits) currentRecord.habits = {};
  if (!currentRecord.painDetails) currentRecord.painDetails = {};
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow(true), 400); // stil opslaan tijdens typen
}

async function saveNow(silent = false) {
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

// ---- "Opgeslagen"-toast ----
let toastTimer = null;
function showToast(msg) {
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
function emptyState(icon, title, sub) {
  return `<div class="empty-state"><div class="es-icon">${icon}</div>` +
    `<div class="es-title">${title}</div>` +
    (sub ? `<div class="es-sub">${sub}</div>` : '') + '</div>';
}

// ---- Bevestigingsdialoog ----
function confirmDialog({ title = 'Bevestigen', message = '', confirmText = 'Oké', danger = false }) {
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
function showUndo(message, onUndo) {
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

// ---- Score-knoppenrijen ----
function buildScoreRow(container, field) {
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
function scaleColor(v, min, max, polarity) {
  const t = max === min ? 0.5 : (v - min) / (max - min);
  const hue = polarity === 'bad' ? (1 - t) * 120 : t * 120;
  return `hsl(${hue}, 60%, 45%)`;
}

function updateScoreRow(container, value) {
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

// ---- Sport-presets ----
const EXERCISE_PRESETS = [0, 15, 30, 45, 60];

function buildExercisePresets() {
  const row = document.getElementById('exercise-presets');
  row.innerHTML = '';
  for (const mins of EXERCISE_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = mins;
    btn.dataset.value = mins;
    btn.addEventListener('click', () => {
      currentRecord.exerciseMinutes = currentRecord.exerciseMinutes === mins ? null : mins;
      renderExercise();
      saveNow();
    });
    row.appendChild(btn);
  }
}

function renderExercise() {
  const mins = currentRecord.exerciseMinutes;
  for (const btn of document.getElementById('exercise-presets').children) {
    btn.classList.toggle('selected', Number(btn.dataset.value) === mins);
  }
  document.getElementById('exercise-minutes').value = mins == null ? '' : mins;
}

// ---- Dankbaarheid (aanpasbaar aantal velden) ----
function getGratitudeCount() {
  return Math.min(5, Math.max(1, parseInt(localStorage.getItem('dagboek-gratitude-count') || '3', 10) || 3));
}

function buildGratitude() {
  const wrap = document.getElementById('gratitude-list');
  wrap.innerHTML = '';
  const count = getGratitudeCount();
  for (let i = 0; i < count; i++) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'gratitude';
    inp.placeholder = `${i + 1}.`;
    inp.addEventListener('input', (e) => {
      if (!currentRecord.gratitude) currentRecord.gratitude = [];
      currentRecord.gratitude[i] = e.target.value;
      scheduleSave();
    });
    wrap.appendChild(inp);
  }
}

function renderGratitude() {
  const inputs = document.querySelectorAll('#gratitude-list .gratitude');
  inputs.forEach((inp, i) => { inp.value = (currentRecord.gratitude && currentRecord.gratitude[i]) || ''; });
}

// ---- Schrijfhulp: roterende reflectievragen (lokaal, geen AI) ----
const WRITING_PROMPTS = [
  'Wat was vandaag het mooiste moment?',
  'Waar ben je trots op vandaag?',
  'Wat heeft je vandaag energie gegeven?',
  'Wat heeft je vandaag energie gekost?',
  'Wie heeft vandaag een verschil voor je gemaakt?',
  'Wat zou je morgen anders willen doen?',
  'Welke gedachte bleef vandaag terugkomen?',
  'Wat heb je vandaag geleerd?',
  'Waar maakte je je zorgen over — en klopte dat?',
  'Wat gaf je vandaag rust?',
  'Welke kleine overwinning had je vandaag?',
  'Hoe voelde je lichaam zich vandaag?',
  'Waar kijk je naar uit?',
  'Wat zou je tegen jezelf van vanochtend zeggen?',
  'Waarvoor wil je jezelf vandaag bedanken?',
];
let promptIndex = 0;

function dayPromptIndex() {
  const [y, m, d] = todayStr().split('-').map(Number);
  return (y * 372 + m * 31 + d) % WRITING_PROMPTS.length;
}

function renderPrompt() {
  document.getElementById('prompt-text').textContent = WRITING_PROMPTS[promptIndex];
}

function insertPrompt() {
  const ta = document.getElementById('journal');
  const q = WRITING_PROMPTS[promptIndex];
  const cur = (currentRecord.journal || '').replace(/\s*$/, '');
  currentRecord.journal = (cur ? cur + '\n\n' : '') + q + '\n';
  ta.value = currentRecord.journal;
  renderJournalTags();
  saveNow();
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}

// ---- Gewoontes (aanpasbaar) ----
function getHabits() {
  try { return JSON.parse(localStorage.getItem('dagboek-habits')) || []; } catch { return []; }
}
function saveHabits(arr) { localStorage.setItem('dagboek-habits', JSON.stringify(arr)); }

function renderHabits() {
  const habits = getHabits();
  const wrap = document.getElementById('habits-list');
  wrap.innerHTML = '';
  if (!habits.length) {
    wrap.innerHTML = '<p class="hint" style="margin:0">Nog geen gewoontes. Voeg ze toe bij ⚙️ Meer → Gewoontes.</p>';
    return;
  }
  if (!currentRecord.habits) currentRecord.habits = {};
  for (const h of habits) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'habit-chip';
    btn.classList.toggle('done', !!currentRecord.habits[h.id]);
    btn.textContent = h.name;
    btn.addEventListener('click', () => {
      currentRecord.habits[h.id] = !currentRecord.habits[h.id];
      btn.classList.toggle('done', !!currentRecord.habits[h.id]);
      saveNow();
    });
    wrap.appendChild(btn);
  }
}

function renderHabitsManager() {
  const habits = getHabits();
  const wrap = document.getElementById('habits-manage');
  wrap.innerHTML = '';
  for (const h of habits) {
    const row = document.createElement('div');
    row.className = 'manage-row';
    const name = document.createElement('span');
    name.textContent = h.name;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'manage-del';
    del.textContent = '✕';
    del.addEventListener('click', () => {
      const removed = h;
      saveHabits(getHabits().filter((x) => x.id !== removed.id));
      renderHabitsManager();
      showUndo('Gewoonte verwijderd', () => {
        const arr = getHabits();
        arr.push(removed);
        saveHabits(arr);
        renderHabitsManager();
      });
    });
    row.appendChild(name);
    row.appendChild(del);
    wrap.appendChild(row);
  }
}

// ---- Tab: Vandaag ----
async function renderVandaag() {
  const streak = await computeStreak();
  streakText = streak >= 2 ? `🔥 ${streak} dagen op rij` : streak === 1 ? '🔥 1 dag' : '';
  const isToday = currentDate === todayStr();
  document.getElementById('header-date').textContent = relativeDayLabel(currentDate);
  const banner = document.getElementById('not-today-banner');
  banner.classList.toggle('hidden', isToday);
  if (!isToday) {
    document.getElementById('not-today-text').textContent = `Je bewerkt ${formatDate(currentDate, false)}`;
  }

  // dag-navigatie (vorige/volgende dag)
  document.getElementById('day-nav-label').textContent = relativeDayLabel(currentDate);
  document.getElementById('day-next').disabled = currentDate >= todayStr();

  renderMood();
  updateScoreRow(document.getElementById('morning-scores'), currentRecord.morningScore);
  updateScoreRow(document.getElementById('evening-scores'), currentRecord.eveningScore);
  renderGratitude();
  document.getElementById('journal').value = currentRecord.journal || '';
  renderJournalTags();
  renderExercise();
  renderHabits();
  renderDone();
  renderMissedPrompt();
  renderOnThisDay();
}

// ---- Tab: Pijn ----
const REGION_LABELS = {
  // voorkant
  hoofd: 'Hoofd', nek: 'Nek', 'schouder-l': 'Schouder links', 'schouder-r': 'Schouder rechts',
  borst: 'Borst', buik: 'Buik', 'arm-l': 'Arm links', 'arm-r': 'Arm rechts',
  'hand-l': 'Hand links', 'hand-r': 'Hand rechts', heup: 'Heupen/bekken',
  'been-l': 'Been links', 'been-r': 'Been rechts', 'knie-l': 'Knie links', 'knie-r': 'Knie rechts',
  'voet-l': 'Voet links', 'voet-r': 'Voet rechts',
  // achterkant
  achterhoofd: 'Achterhoofd', 'nek-achter': 'Nek (achter)',
  'schouder-l-achter': 'Schouder links (achter)', 'schouder-r-achter': 'Schouder rechts (achter)',
  bovenrug: 'Bovenrug', onderrug: 'Onderrug',
  'arm-l-achter': 'Arm links (achter)', 'arm-r-achter': 'Arm rechts (achter)',
  'bil-l': 'Bil links', 'bil-r': 'Bil rechts',
  'dij-l-achter': 'Bovenbeen links (achter)', 'dij-r-achter': 'Bovenbeen rechts (achter)',
  'kuit-l': 'Kuit links', 'kuit-r': 'Kuit rechts', 'hiel-l': 'Hiel links', 'hiel-r': 'Hiel rechts',
};

function buildBodyMap() {
  for (const shape of document.querySelectorAll('#tab-pijn .bodymap .region')) {
    shape.addEventListener('click', () => toggleRegion(shape.dataset.region));
  }
}

function toggleRegion(id) {
  const locs = currentRecord.painLocations;
  const i = locs.indexOf(id);
  if (i >= 0) locs.splice(i, 1);
  else locs.push(id);
  renderBodyMap();
  renderPainFields();
  saveNow();
}

function renderBodyMap() {
  const locs = currentRecord.painLocations || [];
  for (const shape of document.querySelectorAll('#tab-pijn .bodymap .region')) {
    shape.classList.toggle('sel', locs.includes(shape.dataset.region));
  }
  const text = document.getElementById('pain-locations-text');
  text.textContent = locs.length
    ? 'Geselecteerd: ' + locs.map((id) => REGION_LABELS[id] || id).join(', ')
    : 'Nog geen plekken geselecteerd.';
}

// ---- Pijn per plek: soort + intensiteit ----
const PAIN_TYPES = [
  { id: 'scherp', label: 'Scherp' },
  { id: 'zeurend', label: 'Zeurend' },
  { id: 'stekend', label: 'Stekend' },
  { id: 'branderig', label: 'Branderig' },
  { id: 'zenuw', label: 'Zenuw' },
];

function painDetail(id) {
  if (!currentRecord.painDetails) currentRecord.painDetails = {};
  if (!currentRecord.painDetails[id]) currentRecord.painDetails[id] = { type: null, intensity: null };
  return currentRecord.painDetails[id];
}

function renderPainFields() {
  const wrap = document.getElementById('pain-fields');
  const locs = currentRecord.painLocations || [];
  wrap.innerHTML = '';
  if (!locs.length) {
    wrap.innerHTML = emptyState('📍', 'Nog geen plek gekozen', 'Tik hierboven een plek aan om soort en intensiteit toe te voegen.');
    return;
  }
  for (const id of locs) {
    const d = painDetail(id);
    const block = document.createElement('div');
    block.className = 'painfield';

    const name = document.createElement('div');
    name.className = 'pf-name';
    name.textContent = '📍 ' + (REGION_LABELS[id] || id);
    block.appendChild(name);

    // soort pijn (tikbare knoppen)
    const tl = document.createElement('div');
    tl.className = 'pf-label';
    tl.textContent = 'Soort pijn';
    block.appendChild(tl);
    const types = document.createElement('div');
    types.className = 'pf-types';
    const refreshTypes = () => {
      [...types.children].forEach((x, i) => x.classList.toggle('sel', d.type === PAIN_TYPES[i].id));
    };
    for (const t of PAIN_TYPES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pf-type';
      b.textContent = t.label;
      b.addEventListener('click', () => {
        d.type = d.type === t.id ? null : t.id;
        refreshTypes();
        saveNow();
      });
      types.appendChild(b);
    }
    refreshTypes();
    block.appendChild(types);

    // intensiteit (tikbare 1-10 + fijnafstelling 0,1)
    const il = document.createElement('div');
    il.className = 'pf-label';
    il.innerHTML = 'Intensiteit <b class="pf-val"></b>';
    block.appendChild(il);
    const valEl = il.querySelector('.pf-val');
    const setVal = () => { valEl.textContent = d.intensity == null ? '–' : String(Math.round(d.intensity * 10) / 10).replace('.', ','); };

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'pf-slider';
    slider.min = '1';
    slider.max = '10';
    slider.step = '0.1';
    slider.value = d.intensity == null ? '5' : String(d.intensity);
    slider.setAttribute('aria-label', 'Intensiteit');
    slider.addEventListener('input', () => {
      d.intensity = Math.round(parseFloat(slider.value) * 10) / 10;
      setVal();
      scheduleSave();
    });
    slider.addEventListener('change', () => saveNow());
    block.appendChild(slider);

    setVal();
    wrap.appendChild(block);
  }
}

function painColorWidth(score) {
  return `${(score / 10) * 100}%`;
}

async function renderPijn() {
  const isToday = currentDate === todayStr();
  const banner = document.getElementById('pain-not-today-banner');
  banner.classList.toggle('hidden', isToday);
  if (!isToday) {
    document.getElementById('pain-not-today-text').textContent = `Je bewerkt ${formatDate(currentDate, false)}`;
  }

  updateScoreRow(document.getElementById('pain-morning'), currentRecord.painMorning);
  updateScoreRow(document.getElementById('pain-afternoon'), currentRecord.painAfternoon);
  updateScoreRow(document.getElementById('pain-evening'), currentRecord.painEvening);
  renderBodyMap();
  renderPainFields();
  renderDone();

  const wrap = document.getElementById('pain-recent');
  wrap.innerHTML = '';
  const today = todayStr();
  let any = false;
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, -i);
    const rec = date === currentDate ? currentRecord : await dbGetDay(date);
    const score = painRepresentative(rec);
    if (score == null) continue;
    any = true;
    const shown = Math.round(score * 10) / 10;
    const row = document.createElement('div');
    row.className = 'pain-day';
    const label = i === 0 ? 'vandaag' : i === 1 ? 'gisteren' : formatDate(date, false).replace(` ${date.slice(0, 4)}`, '');
    row.innerHTML = `<span class="d"></span><span class="bar"><i style="width:${painColorWidth(score)}"></i></span><span class="v">${String(shown).replace('.', ',')}</span>`;
    row.querySelector('.d').textContent = label;
    wrap.appendChild(row);
  }
  if (!any) {
    wrap.innerHTML = emptyState('🩹', 'Nog geen pijnscores', 'Vul hierboven je pijn per dagdeel in.');
  }
}

// ---- Tab: Geschiedenis ----
function matchesSearch(rec, term) {
  if (!term) return true;
  const haystack = [
    rec.journal || '',
    (rec.gratitude || []).join(' '),
    rec.painNote || '',
    formatDate(rec.date),
  ].join(' ').toLowerCase();
  return haystack.includes(term);
}

// Kalender-heatmap
let calMonth = null; // {y, m} (m = 0-11)

function scoreColor(score) {
  // 1 (rood) -> 10 (groen)
  const hue = ((score - 1) / 9) * 120; // 0=rood, 120=groen
  return `hsl(${hue}, 65%, 45%)`;
}

function renderCalendar() {
  if (!calMonth) {
    const [y, m] = todayStr().split('-').map(Number);
    calMonth = { y, m: m - 1 };
  }
  const { y, m } = calMonth;
  document.getElementById('cal-title').textContent = `${MAANDEN[m]} ${y}`;

  const wd = document.getElementById('cal-weekdays');
  wd.innerHTML = '';
  for (const d of ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']) {
    const el = document.createElement('div');
    el.className = 'cal-wd';
    el.textContent = d;
    wd.appendChild(el);
  }

  const grid = document.getElementById('cal-days');
  grid.innerHTML = '';
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // maandag = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  for (let i = 0; i < firstDow; i++) {
    grid.appendChild(document.createElement('div'));
  }
  const today = todayStr();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-day';
    if (date === today) cell.classList.add('cal-today');
    if (date > today) cell.disabled = true;
    cell.innerHTML = `<span class="n">${d}</span>`;
    const rec = calRecords.get(date);
    if (rec) {
      const sc = rec.eveningScore != null ? rec.eveningScore : rec.morningScore;
      if (sc != null) {
        cell.style.background = scoreColor(sc);
        cell.classList.add('has-score');
      } else if (hasContent(rec)) {
        cell.classList.add('has-dot');
      }
    }
    cell.addEventListener('click', () => openDate(date));
    grid.appendChild(cell);
  }
}

let calRecords = new Map();
let historyTagFilter = null;

function setTagFilter(tag) {
  historyTagFilter = tag;
  renderGeschiedenis();
}

async function renderGeschiedenis() {
  const all = await dbGetAllDays();
  calRecords = new Map(all.map((r) => [r.date, r]));
  renderCalendar();

  // filterbalk (actieve tag)
  const filterBar = document.getElementById('history-filter');
  if (historyTagFilter) {
    document.getElementById('history-filter-label').textContent = `Filter: #${historyTagFilter}`;
    filterBar.classList.remove('hidden');
  } else {
    filterBar.classList.add('hidden');
  }

  const list = document.getElementById('history-list');
  const term = document.getElementById('history-search').value.trim().toLowerCase();
  let days = all.slice().sort((a, b) => b.date.localeCompare(a.date))
    .filter((r) => matchesSearch(r, term))
    .filter((r) => !historyTagFilter || extractTags(r.journal).includes(historyTagFilter));
  list.innerHTML = '';
  if (days.filter(hasContent).length === 0) {
    list.innerHTML = (term || historyTagFilter)
      ? emptyState('🔍', 'Niets gevonden', 'Probeer een andere zoekterm of wis het filter.')
      : emptyState('🗓️', 'Nog geen dagen', 'Begin bij Vandaag — je eerste dag verschijnt hier.');
    return;
  }
  for (const rec of days) {
    if (!hasContent(rec)) continue;
    const item = document.createElement('div');
    item.className = 'history-item';

    const badges = [];
    if (rec.mood != null) badges.push((MOODS.find((x) => x.v === rec.mood) || {}).e || '');
    if (rec.morningScore != null) badges.push(`☀️ ${rec.morningScore}`);
    if (rec.eveningScore != null) badges.push(`🌙 ${rec.eveningScore}`);
    const pr = painRepresentative(rec);
    if (pr != null) badges.push(`🩹 ${String(Math.round(pr * 10) / 10).replace('.', ',')}`);
    if (rec.exerciseMinutes != null && rec.exerciseMinutes > 0) badges.push(`🏃 ${rec.exerciseMinutes}m`);

    const summaryParts = [];
    if (rec.journal) summaryParts.push(rec.journal.slice(0, 60) + (rec.journal.length > 60 ? '…' : ''));
    else if ((rec.gratitude || []).some((g) => g)) summaryParts.push('Dankbaarheid ingevuld');

    const left = document.createElement('div');
    const dateEl = document.createElement('div');
    dateEl.className = 'date';
    dateEl.textContent = formatDate(rec.date);
    left.appendChild(dateEl);
    if (summaryParts.length) {
      const sumEl = document.createElement('div');
      sumEl.className = 'summary';
      sumEl.textContent = summaryParts.join(' · ');
      left.appendChild(sumEl);
    }
    const tags = extractTags(rec.journal);
    if (tags.length) {
      const tagWrap = document.createElement('div');
      tagWrap.className = 'tag-chips';
      for (const t of tags) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'tag-chip clickable';
        chip.textContent = '#' + t;
        chip.addEventListener('click', (e) => { e.stopPropagation(); setTagFilter(t); });
        tagWrap.appendChild(chip);
      }
      left.appendChild(tagWrap);
    }

    const right = document.createElement('div');
    right.className = 'badges';
    for (const b of badges) {
      if (!b) continue;
      const el = document.createElement('span');
      el.className = 'badge';
      el.textContent = b;
      right.appendChild(el);
    }

    item.appendChild(left);
    item.appendChild(right);
    item.addEventListener('click', () => openDate(rec.date));
    list.appendChild(item);
  }
}

async function openDate(date) {
  await saveNow(true);
  currentDate = date;
  await loadCurrent();
  switchTab('vandaag');
}

// ---- Tab: Inzichten ----
let insightDays = 30;

function getGoal() {
  return parseInt(localStorage.getItem('dagboek-goal-exercise') || '0', 10) || 0;
}

function weekStats(byDate, today) {
  const vals = { morning: [], evening: [], pain: [], exercise: 0 };
  for (let i = 0; i < 7; i++) {
    const r = byDate.get(addDays(today, -i));
    if (!r) continue;
    if (r.morningScore != null) vals.morning.push(r.morningScore);
    if (r.eveningScore != null) vals.evening.push(r.eveningScore);
    const pr = painRepresentative(r);
    if (pr != null) vals.pain.push(pr);
    if (r.exerciseMinutes != null) vals.exercise += r.exerciseMinutes;
  }
  const avg = (a) => (a.length ? (a.reduce((s, v) => s + v, 0) / a.length).toFixed(1).replace('.', ',') : '–');
  document.getElementById('stat-morning').textContent = avg(vals.morning);
  document.getElementById('stat-evening').textContent = avg(vals.evening);
  document.getElementById('stat-pain').textContent = avg(vals.pain);
  document.getElementById('stat-exercise').textContent = vals.exercise > 0 ? `${vals.exercise}m` : '–';

  // sportdoel-voortgang
  const goal = getGoal();
  const wrap = document.getElementById('goal-wrap');
  if (goal > 0) {
    const pct = Math.min(100, Math.round((vals.exercise / goal) * 100));
    document.getElementById('goal-label').textContent = `${vals.exercise} / ${goal} min (${pct}%)`;
    document.getElementById('goal-fill').style.width = `${pct}%`;
    document.getElementById('goal-fill').classList.toggle('reached', vals.exercise >= goal);
    wrap.classList.remove('hidden');
  } else {
    wrap.classList.add('hidden');
  }
}

// ---- Slimme inzichten: lokale correlaties (geen AI) ----
function computeInsights(all) {
  const days = all.filter(hasContent);
  const out = [];
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const fmt = (x) => Math.abs(x).toFixed(1).replace('.', ',');
  const MIN = 3;

  const exDays = days.filter((d) => d.exerciseMinutes > 0);
  const noEx = days.filter((d) => !d.exerciseMinutes);

  // sport ↔ pijn
  const painEx = exDays.map(painRepresentative).filter((v) => v != null);
  const painNo = noEx.map(painRepresentative).filter((v) => v != null);
  if (painEx.length >= MIN && painNo.length >= MIN) {
    const diff = avg(painNo) - avg(painEx);
    if (Math.abs(diff) >= 0.3) {
      out.push({ icon: '🏃', text: diff > 0
        ? `Op sportdagen is je pijn gemiddeld ${fmt(diff)} lager.`
        : `Op sportdagen is je pijn gemiddeld ${fmt(diff)} hoger.` });
    }
  }
  // sport ↔ avondcijfer
  const evEx = exDays.map((d) => d.eveningScore).filter((v) => v != null);
  const evNo = noEx.map((d) => d.eveningScore).filter((v) => v != null);
  if (evEx.length >= MIN && evNo.length >= MIN) {
    const diff = avg(evEx) - avg(evNo);
    if (Math.abs(diff) >= 0.3) {
      out.push({ icon: '😊', text: diff > 0
        ? `Op sportdagen is je avondcijfer gemiddeld ${fmt(diff)} hoger.`
        : `Op sportdagen is je avondcijfer gemiddeld ${fmt(diff)} lager.` });
    }
  }
  // mood ↔ sport
  const moodEx = exDays.map((d) => d.mood).filter((v) => v != null);
  const moodNo = noEx.map((d) => d.mood).filter((v) => v != null);
  if (moodEx.length >= MIN && moodNo.length >= MIN) {
    const diff = avg(moodEx) - avg(moodNo);
    if (Math.abs(diff) >= 0.2) {
      out.push({ icon: '🙂', text: diff > 0
        ? `Op sportdagen is je stemming gemiddeld ${fmt(diff)} beter.`
        : `Op sportdagen is je stemming gemiddeld ${fmt(diff)} lager.` });
    }
  }
  return out;
}

function renderSmartInsights(all) {
  const wrap = document.getElementById('smart-list');
  const insights = computeInsights(all);
  if (!insights.length) {
    wrap.innerHTML = emptyState('🔍', 'Nog te weinig data', 'Vul meer dagen in (met o.a. sport) — dan verschijnen hier verbanden.');
    return;
  }
  wrap.innerHTML = '';
  for (const ins of insights) {
    const el = document.createElement('div');
    el.className = 'insight-row';
    el.innerHTML = `<span class="ins-icon">${ins.icon}</span><span class="ins-text"></span>`;
    el.querySelector('.ins-text').textContent = ins.text;
    wrap.appendChild(el);
  }
}

// ---- Beste & zwaarste dagen ----
function renderBestWorst(all) {
  const wrap = document.getElementById('bestworst');
  const scored = all.filter((d) => d.eveningScore != null)
    .map((d) => ({ date: d.date, score: d.eveningScore }));
  if (scored.length < 2) {
    wrap.innerHTML = emptyState('🏅', 'Nog te weinig avondcijfers', 'Geef je dagen een avondcijfer om dit te zien.');
    return;
  }
  const best = [...scored].sort((a, b) => b.score - a.score).slice(0, 3);
  const worst = [...scored].sort((a, b) => a.score - b.score).slice(0, 3);
  const mkCol = (title, items) => {
    const col = document.createElement('div');
    col.className = 'bw-col';
    const head = document.createElement('div');
    head.className = 'bw-head';
    head.textContent = title;
    col.appendChild(head);
    for (const it of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bw-item';
      const dateEl = document.createElement('span');
      dateEl.textContent = formatDate(it.date, false);
      const scoreEl = document.createElement('span');
      scoreEl.className = 'bw-score';
      scoreEl.textContent = it.score;
      btn.appendChild(dateEl);
      btn.appendChild(scoreEl);
      btn.addEventListener('click', () => openDate(it.date));
      col.appendChild(btn);
    }
    return col;
  };
  wrap.innerHTML = '';
  wrap.appendChild(mkCol('😄 Beste', best));
  wrap.appendChild(mkCol('😔 Zwaarste', worst));
}

// ---- Pijn-heatmap (voor- en achterkant) ----
function heatColor(r) {
  r = Math.max(0, Math.min(1, r));
  const a = [246, 221, 216]; // zacht roze
  const b = [178, 38, 30];   // diep rood
  const c = a.map((s, i) => Math.round(s + (b[i] - s) * r));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function renderPainHeatmap(all) {
  // heat = som van pijnintensiteit per plek over alle dagen
  // (vaker aangetikt → meer optellingen, hoger cijfer → grotere optelling)
  const heat = {};
  for (const day of all) {
    const locs = day.painLocations || [];
    const details = day.painDetails || {};
    const fb = painRepresentative(day);
    for (const id of locs) {
      const det = details[id];
      const inten = det && det.intensity != null ? det.intensity : (fb != null ? fb : 5);
      heat[id] = (heat[id] || 0) + inten;
    }
  }
  let max = 0;
  for (const k in heat) if (heat[k] > max) max = heat[k];

  for (const [srcId, dstId] of [['bodymap-front', 'heat-front'], ['bodymap-back', 'heat-back']]) {
    const src = document.getElementById(srcId);
    const dst = document.getElementById(dstId);
    if (!src || !dst) continue;
    const clone = src.cloneNode(true);
    clone.removeAttribute('id');
    clone.classList.add('heatmap');
    for (const sh of clone.querySelectorAll('.region')) {
      sh.classList.remove('sel');
      const h = heat[sh.dataset.region] || 0;
      sh.style.fill = (h > 0 && max > 0) ? heatColor(h / max) : 'var(--surface-2)';
      sh.style.stroke = 'var(--border)';
    }
    dst.replaceChildren(clone);
  }
}

async function renderInzichten() {
  const all = await dbGetAllDays();
  const byDate = new Map(all.map((r) => [r.date, r]));
  const today = todayStr();
  weekStats(byDate, today);
  renderSmartInsights(all);
  renderBestWorst(all);
  renderPainHeatmap(all);
  const dates = [];
  for (let i = insightDays - 1; i >= 0; i--) dates.push(addDays(today, -i));

  const pick = (field) =>
    dates
      .map((d) => ({ date: d, value: byDate.has(d) ? byDate.get(d)[field] : null }))
      .filter((p) => p.value != null);
  const pickPain = () =>
    dates
      .map((d) => ({ date: d, value: byDate.has(d) ? painRepresentative(byDate.get(d)) : null }))
      .filter((p) => p.value != null);

  drawLineChart(document.getElementById('chart-scores'), [
    { label: 'Ochtend', color: '#f0c24b', points: pick('morningScore') },
    { label: 'Avond', color: '#6aa0e6', points: pick('eveningScore') },
  ], { dates, yMin: 0, yMax: 10 });

  drawLineChart(document.getElementById('chart-pain'), [
    { label: 'Pijn', color: '#ef8aa8', points: pickPain() },
  ], { dates, yMin: 0, yMax: 10 });

  drawLineChart(document.getElementById('chart-exercise'), [
    { label: 'Sport', color: '#5cc2a3', points: pick('exerciseMinutes') },
  ], { dates, yMin: 0 });
}

// ---- Tabnavigatie ----
const TAB_TITLES = { vandaag: 'Dagboek', pijn: 'Pijn', geschiedenis: 'Geschiedenis', inzichten: 'Inzichten', meer: 'Instellingen' };
let activeTab = 'vandaag';

function switchTab(name) {
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

  if (name === 'vandaag') renderVandaag();
  if (name === 'pijn') renderPijn();
  if (name === 'geschiedenis') renderGeschiedenis();
  if (name === 'inzichten') renderInzichten();
}

// ---- Pincode (app-slot) ----
const PIN_HASH_KEY = 'dagboek-pin';
const PIN_SALT_KEY = 'dagboek-pin-salt';
const PIN_ITERATIONS = 150000;

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
  const has = !!localStorage.getItem(PIN_HASH_KEY);
  document.getElementById('pin-status').textContent = has
    ? 'Pincode staat aan. De app vergrendelt bij openen en zodra hij naar de achtergrond gaat. Let op: dit is een drempel, geen versleuteling — je data staat onversleuteld op dit apparaat.'
    : 'Geen pincode ingesteld. Stel er een in om de app te vergrendelen.';
  document.getElementById('pin-set-row').classList.toggle('hidden', has);
  document.getElementById('btn-pin-remove').classList.toggle('hidden', !has);
}

function initPinUI() {
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

function openLockScreen(removeMode = false) {
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
  return localStorage.getItem('dagboek-theme') || 'auto';
}

function setTheme(theme) {
  localStorage.setItem('dagboek-theme', theme);
  document.documentElement.dataset.theme = theme;
  applyThemeColorMeta(theme);
  for (const b of document.querySelectorAll('#theme-segment button')) {
    b.classList.toggle('active', b.dataset.themeChoice === theme);
  }
}

function initThemeUI() {
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
function initGoalUI() {
  const input = document.getElementById('goal-input');
  input.value = getGoal() || '';
  input.addEventListener('input', () => {
    const v = Math.max(0, parseInt(input.value, 10) || 0);
    localStorage.setItem('dagboek-goal-exercise', String(v));
  });
}

// ---- Update-melding ----
let waitingWorker = null;
function showUpdateBanner(worker) {
  waitingWorker = worker;
  document.getElementById('update-banner').classList.remove('hidden');
}

// ---- Haptische feedback (trilling bij tikken, alleen waar ondersteund) ----
function haptic(ms = 8) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (e) { /* genegeerd */ }
  }
}

// ---- Init ----
async function init() {
  // subtiele trilling bij het tikken op bedienbare elementen
  document.addEventListener('click', (e) => {
    if (e.target.closest('button:not(:disabled), .region')) haptic();
  }, true);

  buildMoodRow();
  buildScoreRow(document.getElementById('morning-scores'), 'morningScore');
  buildScoreRow(document.getElementById('evening-scores'), 'eveningScore');
  buildScoreRow(document.getElementById('pain-morning'), 'painMorning');
  buildScoreRow(document.getElementById('pain-afternoon'), 'painAfternoon');
  buildScoreRow(document.getElementById('pain-evening'), 'painEvening');
  buildExercisePresets();

  // Dankbaarheid: aantal velden instellen
  const gratCountVal = document.getElementById('grat-count-val');
  gratCountVal.textContent = getGratitudeCount();
  const changeGratCount = (dir) => {
    const next = Math.min(5, Math.max(1, getGratitudeCount() + dir));
    localStorage.setItem('dagboek-gratitude-count', String(next));
    gratCountVal.textContent = next;
    buildGratitude();
    renderGratitude();
  };
  document.getElementById('grat-minus').addEventListener('click', () => changeGratCount(-1));
  document.getElementById('grat-plus').addEventListener('click', () => changeGratCount(1));

  buildBodyMap();
  buildKeypad();

  // Schrijfhulp
  promptIndex = dayPromptIndex();
  renderPrompt();
  document.getElementById('btn-prompt-next').addEventListener('click', () => {
    promptIndex = (promptIndex + 1) % WRITING_PROMPTS.length;
    renderPrompt();
  });
  document.getElementById('btn-prompt-insert').addEventListener('click', insertPrompt);

  // Gewoontes-beheer
  renderHabitsManager();
  const addHabit = () => {
    const input = document.getElementById('habit-new');
    const name = input.value.trim();
    if (!name) return;
    const habits = getHabits();
    habits.push({ id: 'h' + Date.now(), name });
    saveHabits(habits);
    input.value = '';
    renderHabitsManager();
    showToast('Gewoonte toegevoegd');
  };
  document.getElementById('btn-habit-add').addEventListener('click', addHabit);
  document.getElementById('habit-new').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addHabit();
  });

  for (const btn of document.querySelectorAll('.done-btn')) {
    btn.addEventListener('click', () => toggleDone(btn.dataset.done));
  }

  buildGratitude();
  document.getElementById('journal').addEventListener('input', (e) => {
    currentRecord.journal = e.target.value;
    renderJournalTags();
    scheduleSave();
  });
  document.getElementById('exercise-minutes').addEventListener('input', (e) => {
    const v = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0);
    currentRecord.exerciseMinutes = v;
    for (const btn of document.getElementById('exercise-presets').children) {
      btn.classList.toggle('selected', Number(btn.dataset.value) === v);
    }
    scheduleSave();
  });

  const backToToday = async () => {
    await saveNow(true);
    currentDate = todayStr();
    await loadCurrent();
    switchTab(activeTab);
  };
  document.getElementById('btn-back-to-today').addEventListener('click', backToToday);
  document.getElementById('btn-pain-back-to-today').addEventListener('click', backToToday);

  // dag-navigatie: vorige/volgende dag
  document.getElementById('day-prev').addEventListener('click', () => openDate(addDays(currentDate, -1)));
  document.getElementById('day-next').addEventListener('click', () => {
    if (currentDate < todayStr()) openDate(addDays(currentDate, 1));
  });
  document.getElementById('btn-fill-missed').addEventListener('click', () => {
    const target = document.getElementById('missed-banner').dataset.target;
    if (target) openDate(target);
  });

  document.getElementById('history-search').addEventListener('input', () => renderGeschiedenis());
  document.getElementById('history-filter-clear').addEventListener('click', () => setTagFilter(null));
  document.getElementById('cal-prev').addEventListener('click', () => {
    calMonth.m--; if (calMonth.m < 0) { calMonth.m = 11; calMonth.y--; }
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calMonth.m++; if (calMonth.m > 11) { calMonth.m = 0; calMonth.y++; }
    renderCalendar();
  });

  for (const btn of document.querySelectorAll('.tabbtn')) {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  }

  // header krijgt schaduw zodra de pagina gescrolld is
  const headerEl = document.querySelector('.app-header');
  const onScroll = () => headerEl.classList.toggle('scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.getElementById('period-segment').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    insightDays = Number(btn.dataset.days);
    for (const b of document.querySelectorAll('#period-segment button')) {
      b.classList.toggle('active', b === btn);
    }
    renderInzichten();
  });

  // back-up
  document.getElementById('btn-export').addEventListener('click', async () => {
    await saveNow(true);
    await exportBackup();
    document.getElementById('backup-status').textContent = 'Back-up gedownload.';
  });
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('btn-export-csv').addEventListener('click', async () => {
    await saveNow(true);
    await exportCsv();
    document.getElementById('backup-status').textContent = 'CSV gedownload.';
  });
  document.getElementById('btn-export-txt').addEventListener('click', async () => {
    await saveNow(true);
    await exportText();
  });
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const status = document.getElementById('backup-status');
    const ok = await confirmDialog({
      title: 'Back-up importeren?',
      message: 'Dagen uit het bestand worden samengevoegd; bestaande dagen met dezelfde datum worden overschreven.',
      confirmText: 'Importeren',
    });
    if (!ok) { e.target.value = ''; return; }
    try {
      const count = await importBackup(file);
      await loadCurrent();
      status.textContent = `${count} dag(en) geïmporteerd.`;
    } catch (err) {
      status.textContent = `Import mislukt: ${err.message}`;
    }
    e.target.value = '';
  });

  // Dag leegmaken (met ongedaan-maken)
  document.getElementById('btn-clear-day').addEventListener('click', async () => {
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
  });

  // instellingen
  initThemeUI();
  initPinUI();
  initGoalUI();

  // update-banner knop
  document.getElementById('btn-update').addEventListener('click', () => {
    if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  });

  // bij achtergrond: vergrendel meteen zodat terugkeren om de pincode vraagt
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') {
      if (localStorage.getItem(PIN_HASH_KEY)) openLockScreen(false);
      return;
    }
    if (document.visibilityState === 'visible') {
      // bij terugkeren: nieuwe dag?
      if (currentDate < todayStr() && document.getElementById('not-today-banner').classList.contains('hidden')) {
        currentDate = todayStr();
        await loadCurrent();
        switchTab(activeTab);
      }
    }
  });

  await loadCurrent();
  switchTab('vandaag');

  // onboarding bij eerste gebruik
  const ob = document.getElementById('onboarding');
  if (!localStorage.getItem('dagboek-onboarded')) ob.classList.remove('hidden');
  document.getElementById('ob-start').addEventListener('click', () => {
    localStorage.setItem('dagboek-onboarded', '1');
    ob.classList.add('hidden');
  });

  // pincode: vergrendel bij openen
  if (localStorage.getItem('dagboek-pin')) openLockScreen(false);
  else document.documentElement.classList.remove('locked');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(nw);
          }
        });
      });
    });
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  }
}

init();
