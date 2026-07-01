// Pure, browser-onafhankelijke logica. Gedeeld door de app (via <script>) en
// door de unit-tests (via require in Node). Geen DOM/IndexedDB hier.

// ---- Datum-helpers (lokale tijdzone) ----
function toISODate(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function todayStr() {
  return toISODate(new Date());
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + n));
}

function monthsAgo(y, m, d, n) {
  return toISODate(new Date(y, m - 1 - n, d));
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

// ---- Record-logica ----
// representatieve pijnscore van een dag (gemiddelde van ingevulde dagdelen, anders oude losse score)
function painRepresentative(r) {
  if (!r) return null;
  const parts = [r.painMorning, r.painAfternoon, r.painEvening].filter((v) => v != null);
  if (parts.length) return parts.reduce((s, v) => s + v, 0) / parts.length;
  return r.painScore != null ? r.painScore : null;
}

function hasContent(r) {
  return r.mood != null || r.morningScore != null || r.eveningScore != null ||
    painRepresentative(r) != null || r.exerciseMinutes != null ||
    Object.values(r.habits || {}).some(Boolean) ||
    (r.painLocations || []).length > 0 || (r.journal || '').trim() !== '' ||
    (r.gratitude || []).some((g) => g && g.trim() !== '');
}

// ---- Record-normalisatie ----
// Vult ontbrekende velden met veilige defaults zonder bestaande (vertrouwde)
// data te wijzigen. Gebruikt voor zowel nieuwe als ingeladen dagen, zodat het
// aanvullen van defaults op één plek gebeurt (i.p.v. in emptyRecord én loadCurrent).
function normalizeDay(r) {
  r = r || {};
  const clean = {
    date: r.date,
    mood: r.mood ?? null,
    morningScore: r.morningScore ?? null,
    morningScoreNote: r.morningScoreNote ?? '',
    eveningScore: r.eveningScore ?? null,
    eveningScoreNote: r.eveningScoreNote ?? '',
    gratitude: Array.isArray(r.gratitude) ? r.gratitude : ['', '', ''],
    journal: r.journal ?? '',
    exerciseMinutes: r.exerciseMinutes ?? null,
    habits: (r.habits && typeof r.habits === 'object') ? r.habits : {},
    painMorning: r.painMorning ?? null,
    painMorningNote: r.painMorningNote ?? '',
    painAfternoon: r.painAfternoon ?? null,
    painAfternoonNote: r.painAfternoonNote ?? '',
    painEvening: r.painEvening ?? null,
    painEveningNote: r.painEveningNote ?? '',
    painLocations: Array.isArray(r.painLocations) ? r.painLocations : [],
    painDetails: (r.painDetails && typeof r.painDetails === 'object') ? r.painDetails : {},
    painNote: r.painNote ?? '',
    done: (r.done && typeof r.done === 'object') ? r.done : {},
  };
  if (r.painScore != null) clean.painScore = r.painScore; // legacy losse pijnscore
  return clean;
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

// ---- Import-sanitizer ----
// Maakt een schoon record uit onbetrouwbare import-data: alleen bekende velden,
// juiste types en zinnige grenzen. Voorkomt dat corrupte/gemanipuleerde back-ups
// vreemde waarden (bv. HTML in een cijferveld) de app in krijgen.
function importNum(v, min, max) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (min != null && n < min) return null;
  if (max != null && n > max) return null;
  return n;
}
function importStr(v) {
  return typeof v === 'string' ? v : (v == null ? '' : String(v));
}
function importBoolMap(v) {
  const out = {};
  if (v && typeof v === 'object') for (const k of Object.keys(v)) out[k] = !!v[k];
  return out;
}

function sanitizeDay(day) {
  const clean = {
    date: day.date,
    mood: importNum(day.mood, 1, 5),
    morningScore: importNum(day.morningScore, 0, 10),
    eveningScore: importNum(day.eveningScore, 0, 10),
    morningScoreNote: importStr(day.morningScoreNote),
    eveningScoreNote: importStr(day.eveningScoreNote),
    gratitude: Array.isArray(day.gratitude) ? day.gratitude.map(importStr) : [],
    journal: importStr(day.journal),
    exerciseMinutes: importNum(day.exerciseMinutes, 0, 1440),
    habits: importBoolMap(day.habits),
    painMorning: importNum(day.painMorning, 0, 10),
    painAfternoon: importNum(day.painAfternoon, 0, 10),
    painEvening: importNum(day.painEvening, 0, 10),
    painMorningNote: importStr(day.painMorningNote),
    painAfternoonNote: importStr(day.painAfternoonNote),
    painEveningNote: importStr(day.painEveningNote),
    painLocations: Array.isArray(day.painLocations)
      ? day.painLocations.filter((x) => typeof x === 'string')
      : [],
    painDetails: {},
    painNote: importStr(day.painNote),
    done: importBoolMap(day.done),
  };
  // legacy losse pijnscore
  const legacy = importNum(day.painScore, 0, 10);
  if (legacy != null) clean.painScore = legacy;
  // pijn per plek: alleen bekende vorm { type, intensity }
  if (day.painDetails && typeof day.painDetails === 'object') {
    for (const k of Object.keys(day.painDetails)) {
      const d = day.painDetails[k];
      if (d && typeof d === 'object') {
        clean.painDetails[k] = {
          type: typeof d.type === 'string' ? d.type : null,
          intensity: importNum(d.intensity, 0, 10),
        };
      }
    }
  }
  return clean;
}

// Dual-export: in de browser zijn deze functies globaal (via <script>),
// in Node zijn ze importeerbaar voor de tests.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    toISODate, todayStr, addDays, monthsAgo, formatDate, relativeDayLabel,
    painRepresentative, hasContent, extractTags, normalizeDay,
    importNum, importStr, importBoolMap, sanitizeDay,
  };
}
