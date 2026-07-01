// Tab: Inzichten — weekgemiddelden, sportdoel, lijngrafieken, lokale
// correlaties, beste/zwaarste dagen en de pijn-heatmap.
import { emptyState, openDate, getGoal } from './core.js';
import {
  todayStr, addDays, painRepresentative, hasContent, formatDate, computeRegionStats,
} from './logic.js';
import { dbGetAllDays } from './db.js';
import { drawLineChart } from './charts.js';
import { REGION_LABELS, PAIN_TYPES } from './bodymap.js';

let insightDays = 30;

export function setInsightPeriod(days) {
  insightDays = days;
  renderInzichten();
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

function typeLabel(id) {
  if (!id) return '–';
  return (PAIN_TYPES.find((t) => t.id === id) || {}).label || id;
}

const num1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

// Toont de cijfers van één lichaamsregio onder de heatmap.
function showRegionStats(id, stats) {
  const panel = document.getElementById('heat-stats');
  if (!panel) return;
  const label = REGION_LABELS[id] || id;
  const s = stats[id];
  panel.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'hs-title';
  title.textContent = '📍 ' + label;
  panel.appendChild(title);
  if (!s) {
    const p = document.createElement('div');
    p.className = 'hs-empty';
    p.textContent = 'Hier heb je nog geen pijn geregistreerd.';
    panel.appendChild(p);
    return;
  }
  const rows = [
    ['Dagen aangetikt', String(s.days)],
    ['Gem. intensiteit', s.avg != null ? num1(s.avg) : '–'],
    ['Hoogste', s.max ? num1(s.max) : '–'],
    ['Meest voorkomend', typeLabel(s.topType)],
    ['Laatst', s.last ? formatDate(s.last, false) : '–'],
  ];
  const grid = document.createElement('div');
  grid.className = 'hs-grid';
  for (const [k, v] of rows) {
    const cell = document.createElement('div');
    cell.className = 'hs-cell';
    const vv = document.createElement('span'); vv.className = 'hs-v'; vv.textContent = v;
    const kk = document.createElement('span'); kk.className = 'hs-k'; kk.textContent = k;
    cell.appendChild(vv);
    cell.appendChild(kk);
    grid.appendChild(cell);
  }
  panel.appendChild(grid);
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

  const stats = computeRegionStats(all);
  const panel = document.getElementById('heat-stats');
  if (panel) panel.innerHTML = '';

  // markeer de gekozen plek (op beide kaarten) en toon de cijfers
  const open = (id) => {
    for (const r of document.querySelectorAll('.heatmap .region')) {
      const on = r.dataset.region === id;
      r.classList.toggle('active', on);
      r.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    showRegionStats(id, stats);
  };

  for (const [srcId, dstId] of [['bodymap-front', 'heat-front'], ['bodymap-back', 'heat-back']]) {
    const src = document.getElementById(srcId);
    const dst = document.getElementById(dstId);
    if (!src || !dst) continue;
    const clone = src.cloneNode(true); // event-listeners worden niet meegekopieerd
    clone.removeAttribute('id');
    clone.classList.add('heatmap');
    for (const sh of clone.querySelectorAll('.region')) {
      const id = sh.dataset.region;
      sh.classList.remove('sel');
      sh.setAttribute('aria-pressed', 'false');
      const label = REGION_LABELS[id] || id;
      sh.setAttribute('aria-label', stats[id]
        ? `${label}: ${stats[id].days} dagen — statistiek bekijken`
        : `${label}: geen pijn geregistreerd`);
      const h = heat[id] || 0;
      sh.style.fill = (h > 0 && max > 0) ? heatColor(h / max) : 'var(--surface-2)';
      sh.style.stroke = 'var(--border)';
      sh.addEventListener('click', () => open(id));
      sh.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); open(id); }
      });
    }
    dst.replaceChildren(clone);
  }
}

export async function renderInzichten() {
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

  // Big Event-markeringen binnen de zichtbare periode
  const events = dates
    .filter((d) => byDate.has(d) && (byDate.get(d).bigEvent || '').trim())
    .map((d) => ({ date: d, text: byDate.get(d).bigEvent.trim() }));

  drawLineChart(document.getElementById('chart-scores'), [
    { label: 'Ochtend', color: '#f0c24b', points: pick('morningScore') },
    { label: 'Avond', color: '#6aa0e6', points: pick('eveningScore') },
  ], { dates, yMin: 0, yMax: 10, events });

  drawLineChart(document.getElementById('chart-pain'), [
    { label: 'Pijn', color: '#ef8aa8', points: pickPain() },
  ], { dates, yMin: 0, yMax: 10, events });

  drawLineChart(document.getElementById('chart-exercise'), [
    { label: 'Sport', color: '#5cc2a3', points: pick('exerciseMinutes') },
  ], { dates, yMin: 0, events });
}
