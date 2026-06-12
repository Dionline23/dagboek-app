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

// ---- State ----
let currentDate = todayStr();
let currentRecord = null;
let saveTimer = null;

function emptyRecord(date) {
  return {
    date,
    morningScore: null,
    eveningScore: null,
    gratitude: ['', '', ''],
    journal: '',
    exerciseMinutes: null,
    painScore: null,
    painNote: '',
    done: {},
  };
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
  const count = TODAY_DONE_KEYS.filter((k) => done[k]).length;
  const note = document.getElementById('today-progress');
  note.textContent = count === TODAY_DONE_KEYS.length
    ? '🎉 Alles afgerond voor deze dag!'
    : `${count} van ${TODAY_DONE_KEYS.length} afgerond`;
}

async function loadCurrent() {
  currentRecord = (await dbGetDay(currentDate)) || emptyRecord(currentDate);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}

async function saveNow() {
  clearTimeout(saveTimer);
  await dbPutDay(currentRecord);
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
      // nogmaals tikken op de geselecteerde waarde wist de score
      currentRecord[field] = currentRecord[field] === v ? null : v;
      updateScoreRow(container, currentRecord[field]);
      saveNow();
    });
    container.appendChild(btn);
  }
}

function updateScoreRow(container, value) {
  for (const btn of container.children) {
    btn.classList.toggle('selected', Number(btn.dataset.value) === value);
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

// ---- Tab: Vandaag ----
function renderVandaag() {
  const isToday = currentDate === todayStr();
  document.getElementById('header-date').textContent = formatDate(currentDate);
  const banner = document.getElementById('not-today-banner');
  banner.classList.toggle('hidden', isToday);
  if (!isToday) {
    document.getElementById('not-today-text').textContent = `Je bewerkt ${formatDate(currentDate, false)}`;
  }

  updateScoreRow(document.getElementById('morning-scores'), currentRecord.morningScore);
  updateScoreRow(document.getElementById('evening-scores'), currentRecord.eveningScore);
  for (let i = 0; i < 3; i++) {
    document.getElementById(`gratitude-${i}`).value = currentRecord.gratitude[i] || '';
  }
  document.getElementById('journal').value = currentRecord.journal || '';
  renderExercise();
  renderDone();
}

// ---- Tab: Pijn ----
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

  updateScoreRow(document.getElementById('pain-scores'), currentRecord.painScore);
  document.getElementById('pain-note').value = currentRecord.painNote || '';
  renderDone();

  // laatste 14 dagen
  const wrap = document.getElementById('pain-recent');
  wrap.innerHTML = '';
  const today = todayStr();
  let any = false;
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, -i);
    const rec = date === currentDate ? currentRecord : await dbGetDay(date);
    const score = rec ? rec.painScore : null;
    if (score == null) continue;
    any = true;
    const row = document.createElement('div');
    row.className = 'pain-day';
    const label = i === 0 ? 'vandaag' : i === 1 ? 'gisteren' : formatDate(date, false).replace(` ${date.slice(0, 4)}`, '');
    row.innerHTML = `<span class="d"></span><span class="bar"><i style="width:${painColorWidth(score)}"></i></span><span class="v">${score}</span>`;
    row.querySelector('.d').textContent = label;
    wrap.appendChild(row);
  }
  if (!any) {
    wrap.innerHTML = '<p class="empty-note">Nog geen pijnscores ingevuld.</p>';
  }
}

// ---- Tab: Geschiedenis ----
async function renderGeschiedenis() {
  const list = document.getElementById('history-list');
  const days = await dbGetAllDays();
  days.sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = '';
  if (days.length === 0) {
    list.innerHTML = '<p class="empty-note">Nog geen dagen ingevuld. Begin bij "Vandaag"!</p>';
    return;
  }
  for (const rec of days) {
    const item = document.createElement('div');
    item.className = 'history-item';

    const badges = [];
    if (rec.morningScore != null) badges.push(`☀️ ${rec.morningScore}`);
    if (rec.eveningScore != null) badges.push(`🌙 ${rec.eveningScore}`);
    if (rec.painScore != null) badges.push(`🩹 ${rec.painScore}`);
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

    const right = document.createElement('div');
    right.className = 'badges';
    for (const b of badges) {
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
  await saveNow();
  currentDate = date;
  await loadCurrent();
  switchTab('vandaag');
}

// ---- Tab: Inzichten ----
let insightDays = 30;

async function renderInzichten() {
  const all = await dbGetAllDays();
  const byDate = new Map(all.map((r) => [r.date, r]));
  const today = todayStr();
  const dates = [];
  for (let i = insightDays - 1; i >= 0; i--) dates.push(addDays(today, -i));

  const pick = (field) =>
    dates
      .map((d) => ({ date: d, value: byDate.has(d) ? byDate.get(d)[field] : null }))
      .filter((p) => p.value != null);

  drawLineChart(document.getElementById('chart-scores'), [
    { label: 'Ochtend', color: '#f0a04b', points: pick('morningScore') },
    { label: 'Avond', color: '#4f7cac', points: pick('eveningScore') },
  ], { dates, yMin: 0, yMax: 10 });

  drawLineChart(document.getElementById('chart-pain'), [
    { label: 'Pijn', color: '#d9534f', points: pick('painScore') },
  ], { dates, yMin: 0, yMax: 10 });

  drawLineChart(document.getElementById('chart-exercise'), [
    { label: 'Sport', color: '#6fae6f', points: pick('exerciseMinutes') },
  ], { dates, yMin: 0 });
}

// ---- Tabnavigatie ----
const TAB_TITLES = { vandaag: 'Dagboek', pijn: 'Pijn', geschiedenis: 'Geschiedenis', inzichten: 'Inzichten' };
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

  if (name === 'vandaag') renderVandaag();
  if (name === 'pijn') renderPijn();
  if (name === 'geschiedenis') renderGeschiedenis();
  if (name === 'inzichten') renderInzichten();
}

// ---- Init ----
async function init() {
  buildScoreRow(document.getElementById('morning-scores'), 'morningScore');
  buildScoreRow(document.getElementById('evening-scores'), 'eveningScore');
  buildScoreRow(document.getElementById('pain-scores'), 'painScore');
  buildExercisePresets();

  // "Klaar"-knoppen
  for (const btn of document.querySelectorAll('.done-btn')) {
    btn.addEventListener('click', () => toggleDone(btn.dataset.done));
  }

  // tekstvelden -> autosave
  for (let i = 0; i < 3; i++) {
    document.getElementById(`gratitude-${i}`).addEventListener('input', (e) => {
      currentRecord.gratitude[i] = e.target.value;
      scheduleSave();
    });
  }
  document.getElementById('journal').addEventListener('input', (e) => {
    currentRecord.journal = e.target.value;
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

  // banners "naar vandaag"
  const backToToday = async () => {
    await saveNow();
    currentDate = todayStr();
    await loadCurrent();
    switchTab(activeTab);
  };
  document.getElementById('btn-back-to-today').addEventListener('click', backToToday);
  document.getElementById('btn-pain-back-to-today').addEventListener('click', backToToday);

  // geschiedenis: datumkiezer
  const picker = document.getElementById('history-date-picker');
  picker.max = todayStr();
  picker.addEventListener('change', () => {
    if (picker.value) openDate(picker.value);
  });

  // tabbalk
  for (const btn of document.querySelectorAll('.tabbtn')) {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  }

  // inzichten: periode
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
    await saveNow();
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
      renderInzichten();
    } catch (err) {
      status.textContent = `Import mislukt: ${err.message}`;
    }
    e.target.value = '';
  });

  // bij terugkeren naar de app: check of er een nieuwe dag begonnen is
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && currentDate < todayStr() &&
        document.getElementById('not-today-banner').classList.contains('hidden')) {
      currentDate = todayStr();
      await loadCurrent();
      switchTab(activeTab);
    }
  });

  await loadCurrent();
  switchTab('vandaag');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
}

init();
