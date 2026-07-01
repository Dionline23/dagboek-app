// Tab: Pijn — pijnscore per dagdeel, lichaamskaart, pijn per plek en
// het overzicht van de afgelopen 14 dagen.
import {
  currentRecord, currentDate, saveNow, scheduleSave, updateScoreRow, emptyState,
} from './core.js';
import { todayStr, addDays, formatDate, painRepresentative } from './logic.js';
import { dbGetDay } from './db.js';
import { renderDone } from './today.js';
import { REGION_LABELS, PAIN_TYPES, buildBodyMaps } from './bodymap.js';

// ---- Lichaamskaart ----
export function initBodyMap() {
  buildBodyMaps(); // vult de SVG-containers uit data (js/bodymap.js)
  for (const shape of document.querySelectorAll('#tab-pijn .bodymap .region')) {
    shape.addEventListener('click', () => toggleRegion(shape.dataset.region));
    // toetsenbord: Enter/Spatie schakelt de plek aan/uit
    shape.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        toggleRegion(shape.dataset.region);
      }
    });
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
    const sel = locs.includes(shape.dataset.region);
    shape.classList.toggle('sel', sel);
    shape.setAttribute('aria-pressed', sel ? 'true' : 'false');
  }
  const text = document.getElementById('pain-locations-text');
  text.textContent = locs.length
    ? 'Geselecteerd: ' + locs.map((id) => REGION_LABELS[id] || id).join(', ')
    : 'Nog geen plekken geselecteerd.';
}

// ---- Pijn per plek: soort + intensiteit (PAIN_TYPES staat in js/bodymap.js) ----
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

export async function renderPijn() {
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
