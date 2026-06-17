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
    eveningScore: null,
    gratitude: ['', '', ''],
    journal: '',
    exerciseMinutes: null,
    sleepHours: null,
    sleepQuality: null,
    energy: null,
    water: null,
    weight: null,
    painMorning: null,
    painAfternoon: null,
    painEvening: null,
    painLocations: [],
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
    btn.textContent = m.e;
    btn.title = m.l;
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
    r.sleepHours != null || r.sleepQuality != null || r.energy != null ||
    r.water != null || r.weight != null ||
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
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow(true), 400); // stil opslaan tijdens typen
}

async function saveNow(silent = false) {
  clearTimeout(saveTimer);
  await dbPutDay(currentRecord);
  if (!silent) showToast('Opgeslagen ✓');
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

// ---- Score-knoppenrijen ----
function buildScoreRow(container, field) {
  const min = Number(container.dataset.min);
  const max = Number(container.dataset.max);
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
  for (const btn of container.children) {
    const v = Number(btn.dataset.value);
    const sel = v === value;
    btn.classList.toggle('selected', sel);
    btn.style.background = sel ? scaleColor(v, min, max, polarity) : '';
    btn.style.borderColor = sel ? scaleColor(v, min, max, polarity) : '';
  }
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

// ---- Generieke mini-schaal (1..max) ----
function buildMiniScale(container) {
  const field = container.dataset.field;
  const max = Number(container.dataset.max);
  container.innerHTML = '';
  for (let v = 1; v <= max; v++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mini-dot';
    btn.textContent = v;
    btn.dataset.value = v;
    btn.addEventListener('click', () => {
      currentRecord[field] = currentRecord[field] === v ? null : v;
      renderMiniScale(container);
      saveNow();
    });
    container.appendChild(btn);
  }
}

function renderMiniScale(container) {
  const field = container.dataset.field;
  const max = Number(container.dataset.max);
  for (const btn of container.children) {
    const v = Number(btn.dataset.value);
    const sel = v === currentRecord[field];
    btn.classList.toggle('selected', sel);
    btn.style.background = sel ? scaleColor(v, 1, max, 'good') : '';
    btn.style.borderColor = sel ? scaleColor(v, 1, max, 'good') : '';
  }
}

// ---- Generieke stepper (+/-) ----
function buildStepper(el) {
  const field = el.dataset.field;
  const step = parseFloat(el.dataset.step);
  const min = parseFloat(el.dataset.min);
  const max = parseFloat(el.dataset.max);
  const change = (dir) => {
    let v = currentRecord[field];
    if (v == null) v = 0;
    v = Math.min(max, Math.max(min, Math.round((v + dir * step) * 10) / 10));
    currentRecord[field] = v;
    renderStepper(el);
    saveNow();
  };
  el.querySelector('.step-minus').addEventListener('click', () => change(-1));
  el.querySelector('.step-plus').addEventListener('click', () => change(1));
}

function renderStepper(el) {
  const field = el.dataset.field;
  const v = currentRecord[field];
  el.querySelector('.step-val').textContent = v == null ? '–' : String(v).replace('.', ',');
}

function renderExtras() {
  document.querySelectorAll('.extras-body .stepper').forEach(renderStepper);
  document.querySelectorAll('.extras-body .mini-scale').forEach(renderMiniScale);
  const w = document.getElementById('weight-input');
  if (w) w.value = currentRecord.weight == null ? '' : currentRecord.weight;
}

// ---- Tab: Vandaag ----
async function renderVandaag() {
  const streak = await computeStreak();
  streakText = streak >= 2 ? `🔥 ${streak} dagen op rij` : streak === 1 ? '🔥 1 dag' : '';
  const isToday = currentDate === todayStr();
  document.getElementById('header-date').textContent = formatDate(currentDate);
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
  for (let i = 0; i < 3; i++) {
    document.getElementById(`gratitude-${i}`).value = currentRecord.gratitude[i] || '';
  }
  document.getElementById('journal').value = currentRecord.journal || '';
  renderJournalTags();
  renderExercise();
  renderExtras();
  renderDone();
  renderMissedPrompt();
  renderOnThisDay();
}

// ---- Tab: Pijn ----
const REGION_LABELS = {
  hoofd: 'Hoofd', nek: 'Nek', 'schouder-l': 'Schouder links', 'schouder-r': 'Schouder rechts',
  borst: 'Borst', buik: 'Buik', 'arm-l': 'Arm links', 'arm-r': 'Arm rechts',
  'hand-l': 'Hand links', 'hand-r': 'Hand rechts', heup: 'Heupen/bekken',
  'been-l': 'Been links', 'been-r': 'Been rechts', 'knie-l': 'Knie links', 'knie-r': 'Knie rechts',
  'voet-l': 'Voet links', 'voet-r': 'Voet rechts', onderrug: 'Onderrug', bovenrug: 'Bovenrug',
};
const EXTRA_REGIONS = ['onderrug', 'bovenrug'];

function buildBodyMap() {
  for (const shape of document.querySelectorAll('#bodymap .region')) {
    shape.addEventListener('click', () => toggleRegion(shape.dataset.region));
  }
  const chips = document.getElementById('region-chips-extra');
  chips.innerHTML = '';
  for (const id of EXTRA_REGIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'region-chip';
    btn.dataset.region = id;
    btn.textContent = REGION_LABELS[id];
    btn.addEventListener('click', () => toggleRegion(id));
    chips.appendChild(btn);
  }
}

function toggleRegion(id) {
  const locs = currentRecord.painLocations;
  const i = locs.indexOf(id);
  if (i >= 0) locs.splice(i, 1);
  else locs.push(id);
  renderBodyMap();
  saveNow();
}

function renderBodyMap() {
  const locs = currentRecord.painLocations || [];
  for (const shape of document.querySelectorAll('#bodymap .region')) {
    shape.classList.toggle('sel', locs.includes(shape.dataset.region));
  }
  for (const chip of document.querySelectorAll('#region-chips-extra .region-chip')) {
    chip.classList.toggle('sel', locs.includes(chip.dataset.region));
  }
  const text = document.getElementById('pain-locations-text');
  text.textContent = locs.length
    ? 'Geselecteerd: ' + locs.map((id) => REGION_LABELS[id] || id).join(', ')
    : 'Nog geen plekken geselecteerd.';
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
  document.getElementById('pain-note').value = currentRecord.painNote || '';
  renderBodyMap();
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
    wrap.innerHTML = '<p class="empty-note">Nog geen pijnscores ingevuld.</p>';
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
      ? '<p class="empty-note">Niets gevonden.</p>'
      : '<p class="empty-note">Nog geen dagen ingevuld. Begin bij "Vandaag"!</p>';
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

async function renderInzichten() {
  const all = await dbGetAllDays();
  const byDate = new Map(all.map((r) => [r.date, r]));
  const today = todayStr();
  weekStats(byDate, today);
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
    { label: 'Ochtend', color: '#f0a04b', points: pick('morningScore') },
    { label: 'Avond', color: '#4f7cac', points: pick('eveningScore') },
  ], { dates, yMin: 0, yMax: 10 });

  drawLineChart(document.getElementById('chart-pain'), [
    { label: 'Pijn', color: '#d9534f', points: pickPain() },
  ], { dates, yMin: 0, yMax: 10 });

  drawLineChart(document.getElementById('chart-exercise'), [
    { label: 'Sport', color: '#6fae6f', points: pick('exerciseMinutes') },
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
    name === 'vandaag' || name === 'pijn' ? formatDate(currentDate) : '';

  // begin bovenaan bij elke tabwissel
  window.scrollTo({ top: 0, behavior: 'auto' });

  if (name === 'vandaag') renderVandaag();
  if (name === 'pijn') renderPijn();
  if (name === 'geschiedenis') renderGeschiedenis();
  if (name === 'inzichten') renderInzichten();
}

// ---- Herinneringen (meldingen) ----
function getReminders() {
  try {
    return JSON.parse(localStorage.getItem('dagboek-reminders')) || { enabled: false, morning: '08:00', evening: '21:00' };
  } catch {
    return { enabled: false, morning: '08:00', evening: '21:00' };
  }
}

function saveReminders(r) {
  localStorage.setItem('dagboek-reminders', JSON.stringify(r));
}

let reminderTimers = [];
function scheduleReminders() {
  reminderTimers.forEach(clearTimeout);
  reminderTimers = [];
  const r = getReminders();
  if (!r.enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  for (const t of [r.morning, r.evening]) {
    if (!t) continue;
    const [h, m] = t.split(':').map(Number);
    const fire = new Date();
    fire.setHours(h, m, 0, 0);
    const delay = fire - now;
    if (delay > 0 && delay < 24 * 3600 * 1000) {
      reminderTimers.push(setTimeout(fireReminder, delay));
    }
  }
}

function fireReminder() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const body = hasContent(currentRecord) ? 'Nog iets toe te voegen aan je dag? ✍️' : 'Tijd om je dagboek in te vullen ✍️';
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then((reg) => reg.showNotification('Dagboek', { body, icon: 'icons/icon-192.png', tag: 'dagboek-reminder' }));
  } else {
    new Notification('Dagboek', { body, icon: 'icons/icon-192.png' });
  }
}

function initReminderUI() {
  const r = getReminders();
  const enabled = document.getElementById('reminders-enabled');
  const morning = document.getElementById('reminder-morning');
  const evening = document.getElementById('reminder-evening');
  const status = document.getElementById('reminder-status');
  enabled.checked = r.enabled;
  morning.value = r.morning;
  evening.value = r.evening;

  function refreshStatus() {
    const cur = getReminders();
    if (!cur.enabled) {
      status.textContent = 'Herinneringen staan uit.';
    } else if (!('Notification' in window)) {
      status.textContent = 'Dit apparaat ondersteunt geen meldingen.';
    } else if (Notification.permission === 'denied') {
      status.textContent = 'Meldingen zijn geblokkeerd. Sta ze toe in je browser-/app-instellingen.';
    } else if (Notification.permission === 'granted') {
      status.textContent = `Aan om ${cur.morning} en ${cur.evening}. Werkt het best als je de app dagelijks even opent.`;
    } else {
      status.textContent = 'Tik op de schakelaar om meldingen toe te staan.';
    }
  }

  enabled.addEventListener('change', async () => {
    const cur = getReminders();
    cur.enabled = enabled.checked;
    if (cur.enabled && 'Notification' in window && Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') cur.enabled = false;
      enabled.checked = cur.enabled;
    }
    saveReminders(cur);
    scheduleReminders();
    refreshStatus();
  });
  const onTime = () => {
    const cur = getReminders();
    cur.morning = morning.value || '08:00';
    cur.evening = evening.value || '21:00';
    saveReminders(cur);
    scheduleReminders();
    refreshStatus();
  };
  morning.addEventListener('change', onTime);
  evening.addEventListener('change', onTime);
  refreshStatus();
}

// ---- Pincode (app-slot) ----
async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('dagboek:' + pin));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function refreshPinUI() {
  const has = !!localStorage.getItem('dagboek-pin');
  document.getElementById('pin-status').textContent = has
    ? 'Pincode staat aan. De app vraagt erom bij openen.'
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
    localStorage.setItem('dagboek-pin', await hashPin(pin));
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
  if (k === '⌫') {
    lockEntry = lockEntry.slice(0, -1);
  } else if (k && lockEntry.length < 4) {
    lockEntry += k;
  }
  updateLockDots();
  if (lockEntry.length === 4) {
    const ok = (await hashPin(lockEntry)) === localStorage.getItem('dagboek-pin');
    if (ok) {
      if (lockRemoveMode) {
        localStorage.removeItem('dagboek-pin');
        refreshPinUI();
        showToast('Pincode verwijderd');
      }
      closeLockScreen();
    } else {
      const err = document.getElementById('lock-error');
      err.classList.remove('hidden');
      lockEntry = '';
      updateLockDots();
    }
  }
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
    if (e.target.closest('button:not(:disabled), .region, .swatch')) haptic();
  }, true);

  buildMoodRow();
  buildScoreRow(document.getElementById('morning-scores'), 'morningScore');
  buildScoreRow(document.getElementById('evening-scores'), 'eveningScore');
  buildScoreRow(document.getElementById('pain-morning'), 'painMorning');
  buildScoreRow(document.getElementById('pain-afternoon'), 'painAfternoon');
  buildScoreRow(document.getElementById('pain-evening'), 'painEvening');
  buildExercisePresets();
  document.querySelectorAll('.extras-body .mini-scale').forEach(buildMiniScale);
  document.querySelectorAll('.extras-body .stepper').forEach(buildStepper);
  document.getElementById('weight-input').addEventListener('input', (e) => {
    const v = e.target.value === '' ? null : Math.max(0, parseFloat(e.target.value) || 0);
    currentRecord.weight = v;
    scheduleSave();
  });
  buildBodyMap();
  buildKeypad();

  for (const btn of document.querySelectorAll('.done-btn')) {
    btn.addEventListener('click', () => toggleDone(btn.dataset.done));
  }

  for (let i = 0; i < 3; i++) {
    document.getElementById(`gratitude-${i}`).addEventListener('input', (e) => {
      currentRecord.gratitude[i] = e.target.value;
      scheduleSave();
    });
  }
  document.getElementById('journal').addEventListener('input', (e) => {
    currentRecord.journal = e.target.value;
    renderJournalTags();
    scheduleSave();
  });
  document.getElementById('pain-note').addEventListener('input', (e) => {
    currentRecord.painNote = e.target.value;
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

  // weergave: thema + accentkleur
  const savedTheme = localStorage.getItem('dagboek-thema') || 'auto';
  for (const b of document.querySelectorAll('#theme-segment button')) {
    b.classList.toggle('active', b.dataset.theme === savedTheme);
  }
  document.getElementById('theme-segment').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const choice = btn.dataset.theme;
    if (choice === 'auto') {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem('dagboek-thema');
    } else {
      document.documentElement.dataset.theme = choice === 'licht' ? 'light' : 'dark';
      localStorage.setItem('dagboek-thema', choice);
    }
    for (const b of document.querySelectorAll('#theme-segment button')) {
      b.classList.toggle('active', b === btn);
    }
  });

  const savedAccent = localStorage.getItem('dagboek-accent') || 'blauw';
  for (const b of document.querySelectorAll('.swatch')) {
    b.classList.toggle('active', b.dataset.accent === savedAccent);
  }
  document.getElementById('accent-swatches').addEventListener('click', (e) => {
    const btn = e.target.closest('.swatch');
    if (!btn) return;
    document.documentElement.dataset.accent = btn.dataset.accent;
    localStorage.setItem('dagboek-accent', btn.dataset.accent);
    for (const b of document.querySelectorAll('.swatch')) {
      b.classList.toggle('active', b === btn);
    }
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
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const status = document.getElementById('backup-status');
    try {
      const count = await importBackup(file);
      await loadCurrent();
      status.textContent = `${count} dag(en) geïmporteerd.`;
    } catch (err) {
      status.textContent = `Import mislukt: ${err.message}`;
    }
    e.target.value = '';
  });

  // instellingen
  initReminderUI();
  initPinUI();
  initGoalUI();

  // update-banner knop
  document.getElementById('btn-update').addEventListener('click', () => {
    if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  });

  // bij terugkeren: nieuwe dag? + herinneringen herplannen
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      scheduleReminders();
      if (currentDate < todayStr() && document.getElementById('not-today-banner').classList.contains('hidden')) {
        currentDate = todayStr();
        await loadCurrent();
        switchTab(activeTab);
      }
    }
  });

  await loadCurrent();
  switchTab('vandaag');

  // pincode: vergrendel bij openen
  if (localStorage.getItem('dagboek-pin')) openLockScreen(false);
  else document.documentElement.classList.remove('locked');

  scheduleReminders();

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
