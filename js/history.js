// Tab: Geschiedenis — kalender-heatmap, zoeken en de lijst met eerdere dagen.
import { openDate, emptyState } from './core.js';
import {
  todayStr, toISODate, MAANDEN, formatDate, hasContent, extractTags, painRepresentative,
} from './logic.js';
import { dbGetAllDays } from './db.js';
import { MOODS } from './today.js';

function matchesSearch(rec, term) {
  if (!term) return true;
  const haystack = [
    rec.journal || '',
    rec.bigEvent || '',
    (rec.gratitude || []).join(' '),
    rec.painNote || '',
    formatDate(rec.date),
  ].join(' ').toLowerCase();
  return haystack.includes(term);
}

// Kalender-heatmap
let calMonth = null; // {y, m} (m = 0-11)
let calRecords = new Map();
let historyTagFilter = null;

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
    const date = toISODate(new Date(y, m, d));
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

export function calPrevMonth() {
  if (!calMonth) renderCalendar();
  calMonth.m--; if (calMonth.m < 0) { calMonth.m = 11; calMonth.y--; }
  renderCalendar();
}

export function calNextMonth() {
  if (!calMonth) renderCalendar();
  calMonth.m++; if (calMonth.m > 11) { calMonth.m = 0; calMonth.y++; }
  renderCalendar();
}

export function setTagFilter(tag) {
  historyTagFilter = tag;
  renderGeschiedenis();
}

export async function renderGeschiedenis() {
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

    if (rec.bigEvent && rec.bigEvent.trim()) badges.push('🌟');

    const summaryParts = [];
    if (rec.bigEvent && rec.bigEvent.trim()) summaryParts.push('🌟 ' + rec.bigEvent.trim());
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
