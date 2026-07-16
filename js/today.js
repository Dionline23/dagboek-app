// Tab: Vandaag — stemming, cijfers, dankbaarheid, journal, schrijfhulp,
// gewoontes, sport, streak, "op deze dag" en de inhaalprompt.
import {
  currentRecord, currentDate, saveNow, scheduleSave, openDate,
  showToast, showUndo, emptyState, updateScoreRow, LS,
} from './core.js';
import {
  todayStr, addDays, monthsAgo, toISODate, relativeDayLabel, formatDate,
  hasContent, extractTags,
} from './logic.js';
import { dbGetDay, dbGetAllDays } from './db.js';
import { confettiBurst } from './effects.js';

// ---- Stemming ----
export const MOODS = [
  { v: 1, e: '😞', l: 'Slecht' },
  { v: 2, e: '😕', l: 'Matig' },
  { v: 3, e: '😐', l: 'Neutraal' },
  { v: 4, e: '🙂', l: 'Goed' },
  { v: 5, e: '😄', l: 'Top' },
];

export function buildMoodRow() {
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

// ---- Emoties (multi-select, onder het journal) ----
export const EMOTIONS = [
  { id: 'blij', e: '😄', l: 'Blij', tone: 'pos' },
  { id: 'geliefd', e: '🥰', l: 'Geliefd', tone: 'pos' },
  { id: 'dankbaar', e: '🙏', l: 'Dankbaar', tone: 'pos' },
  { id: 'trots', e: '💪', l: 'Trots', tone: 'pos' },
  { id: 'energiek', e: '⚡', l: 'Energiek', tone: 'pos' },
  { id: 'rustig', e: '😌', l: 'Rustig', tone: 'pos' },
  { id: 'hoopvol', e: '🌟', l: 'Hoopvol', tone: 'pos' },
  { id: 'vlak', e: '😐', l: 'Vlak', tone: 'neutral' },
  { id: 'moe', e: '😴', l: 'Moe', tone: 'neg' },
  { id: 'gestrest', e: '😰', l: 'Gestrest', tone: 'neg' },
  { id: 'bezorgd', e: '😟', l: 'Bezorgd', tone: 'neg' },
  { id: 'verdrietig', e: '😢', l: 'Verdrietig', tone: 'neg' },
  { id: 'boos', e: '😠', l: 'Boos', tone: 'neg' },
  { id: 'eenzaam', e: '🥺', l: 'Eenzaam', tone: 'neg' },
  { id: 'overweldigd', e: '🌫️', l: 'Overweldigd', tone: 'neg' },
];

export function buildEmotionChips() {
  const wrap = document.getElementById('emotions-list');
  wrap.innerHTML = '';
  for (const em of EMOTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emotion-chip';
    btn.dataset.emotion = em.id;
    btn.dataset.tone = em.tone;
    btn.innerHTML = `<span class="em-emoji">${em.e}</span><span class="em-label">${em.l}</span>`;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      if (!Array.isArray(currentRecord.emotions)) currentRecord.emotions = [];
      const i = currentRecord.emotions.indexOf(em.id);
      if (i >= 0) currentRecord.emotions.splice(i, 1);
      else currentRecord.emotions.push(em.id);
      renderEmotions();
      // bounce-animatie op de aangetikte chip
      btn.classList.remove('bounce');
      void btn.offsetWidth;
      btn.classList.add('bounce');
      saveNow(true);
    });
    wrap.appendChild(btn);
  }
}

function renderEmotions() {
  const sel = currentRecord.emotions || [];
  for (const btn of document.querySelectorAll('#emotions-list .emotion-chip')) {
    const on = sel.includes(btn.dataset.emotion);
    btn.classList.toggle('selected', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

// ---- Journal #tags ----
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
    { label: '1 jaar geleden', date: toISODate(new Date(y - 1, m - 1, d)) },
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

// ---- Streak: aantal dagen op rij ingevuld ----
let streakText = '';

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
  const before = TODAY_DONE_KEYS.filter((k) => currentRecord.done[k]).length;
  currentRecord.done[key] = !currentRecord.done[key];
  const after = TODAY_DONE_KEYS.filter((k) => currentRecord.done[k]).length;
  renderDone();
  saveNow();
  // 🎉 alles afgerond met deze tik → confetti (alleen bij echte voltooiing)
  if (after === TODAY_DONE_KEYS.length && before === TODAY_DONE_KEYS.length - 1) {
    confettiBurst();
  }
}

export function renderDone() {
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

export function initDoneButtons() {
  for (const btn of document.querySelectorAll('.done-btn')) {
    btn.addEventListener('click', () => toggleDone(btn.dataset.done));
  }
}

// ---- Sport-presets ----
const EXERCISE_PRESETS = [0, 15, 30, 45, 60];

export function buildExercisePresets() {
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

export function initExerciseInput() {
  document.getElementById('exercise-minutes').addEventListener('input', (e) => {
    const v = e.target.value === '' ? null : Math.min(1440, Math.max(0, parseInt(e.target.value, 10) || 0));
    currentRecord.exerciseMinutes = v;
    for (const btn of document.getElementById('exercise-presets').children) {
      btn.classList.toggle('selected', Number(btn.dataset.value) === v);
    }
    scheduleSave();
  });
}

// ---- Dankbaarheid (aanpasbaar aantal velden) ----
function getGratitudeCount() {
  return Math.min(5, Math.max(1, parseInt(localStorage.getItem(LS.gratitudeCount) || '3', 10) || 3));
}

export function buildGratitude() {
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

export function initGratitudeStepper() {
  const gratCountVal = document.getElementById('grat-count-val');
  gratCountVal.textContent = getGratitudeCount();
  const changeGratCount = (dir) => {
    const next = Math.min(5, Math.max(1, getGratitudeCount() + dir));
    localStorage.setItem(LS.gratitudeCount, String(next));
    gratCountVal.textContent = next;
    buildGratitude();
    renderGratitude();
  };
  document.getElementById('grat-minus').addEventListener('click', () => changeGratCount(-1));
  document.getElementById('grat-plus').addEventListener('click', () => changeGratCount(1));
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

export function initWritingHelp() {
  promptIndex = dayPromptIndex();
  renderPrompt();
  document.getElementById('btn-prompt-next').addEventListener('click', () => {
    promptIndex = (promptIndex + 1) % WRITING_PROMPTS.length;
    renderPrompt();
  });
  document.getElementById('btn-prompt-insert').addEventListener('click', insertPrompt);
}

export function initJournalInput() {
  document.getElementById('journal').addEventListener('input', (e) => {
    currentRecord.journal = e.target.value;
    renderJournalTags();
    scheduleSave();
  });
}

// ---- Dicteren in het journal (Web Speech API, alleen dit blok) ----
let recognition = null;
let dictating = false;
// journal-tekst op het moment dat de (interim)zin begon, zodat we live kunnen tonen
let dictBase = '';

function setDictationUI(on) {
  dictating = on;
  const btn = document.getElementById('btn-dictate');
  const status = document.getElementById('dictate-status');
  btn.classList.toggle('recording', on);
  btn.setAttribute('aria-label', on ? 'Stop met dicteren' : 'Dicteer je journal');
  btn.title = on ? 'Stop met dicteren' : 'Dicteer je journal';
  status.classList.toggle('hidden', !on);
}

function appendDictation(text, isFinal) {
  const ta = document.getElementById('journal');
  const sep = dictBase && !/\s$/.test(dictBase) ? ' ' : '';
  const merged = dictBase + sep + text.trim();
  ta.value = merged;
  if (isFinal) {
    currentRecord.journal = merged;
    dictBase = merged;
    renderJournalTags();
    scheduleSave();
  }
}

export function initDictation() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = document.getElementById('btn-dictate');
  if (!SR) { btn.classList.add('hidden'); return; }

  btn.addEventListener('click', () => {
    if (dictating) { recognition.stop(); return; }
    recognition = new SR();
    recognition.lang = 'nl-NL';
    recognition.continuous = true;
    recognition.interimResults = true;
    dictBase = document.getElementById('journal').value;

    recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) appendDictation(r[0].transcript, true);
        else interim += r[0].transcript;
      }
      if (interim) appendDictation(interim, false);
    };
    recognition.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        showToast('🎤 Geen microfoontoegang');
      } else if (e.error === 'no-speech') {
        showToast('🎤 Geen spraak gehoord');
      } else if (e.error === 'network') {
        showToast('🎤 Dicteren vereist internet');
      }
    };
    recognition.onend = () => setDictationUI(false);

    try {
      recognition.start();
      setDictationUI(true);
    } catch (err) {
      showToast('🎤 Dicteren kon niet starten');
    }
  });
}

// ---- Big Event (grote gebeurtenis; optioneel, met + en bevestigen) ----
function renderBigEvent() {
  const val = (currentRecord.bigEvent || '').trim();
  document.getElementById('bigevent-form').classList.add('hidden');
  const display = document.getElementById('bigevent-display');
  const addBtn = document.getElementById('bigevent-add');
  if (val) {
    document.getElementById('bigevent-text').textContent = '🌟 ' + val;
    display.classList.remove('hidden');
    addBtn.classList.add('hidden');
  } else {
    display.classList.add('hidden');
    addBtn.classList.remove('hidden');
  }
}

function openBigEventForm() {
  const input = document.getElementById('bigevent');
  input.value = currentRecord.bigEvent || '';
  document.getElementById('bigevent-display').classList.add('hidden');
  document.getElementById('bigevent-add').classList.add('hidden');
  document.getElementById('bigevent-form').classList.remove('hidden');
  input.focus();
}

export function initBigEvent() {
  document.getElementById('bigevent-add').addEventListener('click', openBigEventForm);
  document.getElementById('bigevent-edit').addEventListener('click', openBigEventForm);
  document.getElementById('bigevent-cancel').addEventListener('click', renderBigEvent);
  document.getElementById('bigevent-save').addEventListener('click', () => {
    currentRecord.bigEvent = document.getElementById('bigevent').value.trim();
    saveNow(); // expliciet bevestigen → toon "Opgeslagen ✓"
    renderBigEvent();
  });
  document.getElementById('bigevent-remove').addEventListener('click', () => {
    currentRecord.bigEvent = '';
    saveNow();
    renderBigEvent();
  });
  document.getElementById('bigevent').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('bigevent-save').click(); }
  });
}

// ---- Gewoontes (aanpasbaar) ----
function getHabits() {
  try { return JSON.parse(localStorage.getItem(LS.habits)) || []; } catch { return []; }
}
function saveHabits(arr) { localStorage.setItem(LS.habits, JSON.stringify(arr)); }

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

export function initHabitsManager() {
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
}

// ---- Streak-mijlpalen: één keer vieren per mijlpaal ----
const STREAK_MILESTONES = [7, 30, 100, 365];

function celebrateStreakMilestone(streak) {
  const milestone = STREAK_MILESTONES.filter((m) => streak >= m).pop();
  if (!milestone) return;
  const done = parseInt(localStorage.getItem(LS.streakCelebrated) || '0', 10) || 0;
  if (milestone <= done) return;
  localStorage.setItem(LS.streakCelebrated, String(milestone));
  confettiBurst();
  showToast(`🔥 ${milestone} dagen op rij — geweldig!`);
}

// ---- Render van de hele Vandaag-tab ----
export async function renderVandaag() {
  const streak = await computeStreak();
  streakText = streak >= 2 ? `🔥 ${streak} dagen op rij` : streak === 1 ? '🔥 1 dag' : '';
  celebrateStreakMilestone(streak);
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
  renderEmotions();
  renderBigEvent();
  renderExercise();
  renderHabits();
  renderDone();
  await renderMissedPrompt();
  await renderOnThisDay();
}
