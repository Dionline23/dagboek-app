const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');

test('toISODate en todayStr geven YYYY-MM-DD met nul-padding', () => {
  assert.equal(L.toISODate(new Date(2026, 0, 5)), '2026-01-05');
  assert.match(L.todayStr(), /^\d{4}-\d{2}-\d{2}$/);
});

test('addDays rekent correct over maand- en jaargrenzen', () => {
  assert.equal(L.addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(L.addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(L.addDays('2026-03-15', 0), '2026-03-15');
});

test('monthsAgo trekt maanden af', () => {
  assert.equal(L.monthsAgo(2026, 7, 15, 1), '2026-06-15');
  assert.equal(L.monthsAgo(2026, 1, 10, 1), '2025-12-10');
});

test('formatDate met en zonder weekdag', () => {
  // 1 juli 2026 is een woensdag
  assert.equal(L.formatDate('2026-07-01', false), '1 juli 2026');
  assert.equal(L.formatDate('2026-07-01'), 'woensdag 1 juli 2026');
});

test('relativeDayLabel: vandaag/gisteren/morgen', () => {
  const today = L.todayStr();
  assert.equal(L.relativeDayLabel(today), 'Vandaag');
  assert.equal(L.relativeDayLabel(L.addDays(today, -1)), 'Gisteren');
  assert.equal(L.relativeDayLabel(L.addDays(today, -2)), 'Eergisteren');
  assert.equal(L.relativeDayLabel(L.addDays(today, 1)), 'Morgen');
});

test('painRepresentative middelt de ingevulde dagdelen', () => {
  assert.equal(L.painRepresentative({ painMorning: 2, painAfternoon: 4, painEvening: 6 }), 4);
  assert.equal(L.painRepresentative({ painMorning: 3 }), 3);
});

test('painRepresentative valt terug op legacy painScore en anders null', () => {
  assert.equal(L.painRepresentative({ painScore: 7 }), 7);
  assert.equal(L.painRepresentative({}), null);
  assert.equal(L.painRepresentative(null), null);
});

test('hasContent herkent lege vs gevulde dagen', () => {
  assert.equal(L.hasContent({ gratitude: ['', '', ''], habits: {}, painLocations: [], journal: '' }), false);
  assert.equal(L.hasContent({ mood: 3 }), true);
  assert.equal(L.hasContent({ journal: '  hoi  ' }), true);
  assert.equal(L.hasContent({ gratitude: ['', 'dankbaar', ''] }), true);
  assert.equal(L.hasContent({ habits: { a: false, b: true } }), true);
});

test('extractTags: uniek, lowercase, met unicode', () => {
  assert.deepEqual(L.extractTags('Vandaag #Werk en #werk en #café'), ['werk', 'café']);
  assert.deepEqual(L.extractTags(''), []);
  assert.deepEqual(L.extractTags(null), []);
});

test('sanitizeDay strandt HTML/ongeldige waarden en dwingt types af', () => {
  const dirty = {
    date: '2026-06-01',
    eveningScore: '<img src=x onerror=alert(1)>',
    mood: 99,
    morningScore: 8,
    journal: 12345,
    exerciseMinutes: 999999,
    gratitude: 'geen array',
    painLocations: ['nek', 42, 'hoofd'],
    habits: { a: 1, b: 0 },
    evil: 'DROP TABLE',
    painDetails: { nek: { type: 'scherp', intensity: '5' }, x: 'kapot' },
  };
  const c = L.sanitizeDay(dirty);
  assert.equal(c.eveningScore, null);        // HTML → geen getal
  assert.equal(c.mood, null);                // buiten 1..5
  assert.equal(c.morningScore, 8);           // geldig blijft
  assert.equal(c.journal, '12345');          // gecoerced naar string
  assert.equal(c.exerciseMinutes, null);     // boven 1440 → weg
  assert.deepEqual(c.gratitude, []);         // geen array → leeg
  assert.deepEqual(c.painLocations, ['nek', 'hoofd']); // niet-strings gefilterd
  assert.deepEqual(c.habits, { a: true, b: false });   // booleans
  assert.equal('evil' in c, false);          // onbekend veld weg
  assert.deepEqual(c.painDetails.nek, { type: 'scherp', intensity: 5 });
  assert.equal('x' in c.painDetails, false); // ongeldige detail-vorm weg
});
