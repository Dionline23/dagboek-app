// Export: alle dagen als JSON-bestand downloaden.
// Import: JSON-bestand inlezen en mergen op datum (bestand wint).
async function exportBackup() {
  const days = await dbGetAllDays();
  days.sort((a, b) => a.date.localeCompare(b.date));
  const blob = new Blob([JSON.stringify({ app: 'dagboek', version: 1, days }, null, 2)], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dagboek-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function csvEscape(s) {
  s = String(s == null ? '' : s);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// CSV-export voor Excel/Sheets (kolommen per onderdeel)
async function exportCsv() {
  const days = await dbGetAllDays();
  days.sort((a, b) => a.date.localeCompare(b.date));
  const cols = ['datum', 'stemming', 'ochtend', 'avond', 'pijn', 'slaap_uren', 'slaap_kwaliteit',
    'energie', 'water', 'gewicht', 'stappen', 'sport_min', 'dankbaarheid', 'journal'];
  const lines = [cols.join(';')];
  for (const d of days) {
    const pain = painRepresentative(d);
    const row = [d.date, d.mood ?? '', d.morningScore ?? '', d.eveningScore ?? '',
      pain == null ? '' : Math.round(pain * 10) / 10, d.sleepHours ?? '', d.sleepQuality ?? '',
      d.energy ?? '', d.water ?? '', d.weight ?? '', d.steps ?? '', d.exerciseMinutes ?? '',
      (d.gratitude || []).filter(Boolean).join(' | '), (d.journal || '').replace(/\n/g, ' ')];
    lines.push(row.map(csvEscape).join(';'));
  }
  downloadBlob('﻿' + lines.join('\r\n'), `dagboek-export-${todayStr()}.csv`, 'text/csv;charset=utf-8');
}

// Leesbare tekst-export; deelt via het Android-deelmenu indien beschikbaar
async function exportText() {
  const days = await dbGetAllDays();
  days.sort((a, b) => b.date.localeCompare(a.date));
  let txt = 'Mijn Dagboek\n\n';
  for (const d of days) {
    if (!hasContent(d)) continue;
    txt += '— ' + formatDate(d.date) + ' —\n';
    if (d.mood != null) txt += `Stemming: ${d.mood}/5\n`;
    if (d.morningScore != null) txt += `Ochtend: ${d.morningScore}/10\n`;
    if (d.eveningScore != null) txt += `Avond: ${d.eveningScore}/10\n`;
    const pain = painRepresentative(d);
    if (pain != null) txt += `Pijn: ${Math.round(pain * 10) / 10}/10\n`;
    const grat = (d.gratitude || []).filter(Boolean);
    if (grat.length) txt += 'Dankbaar voor: ' + grat.join('; ') + '\n';
    if (d.journal) txt += d.journal + '\n';
    txt += '\n';
  }
  const filename = `dagboek-${todayStr()}.txt`;
  const file = new File([txt], filename, { type: 'text/plain' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Mijn Dagboek' });
      return;
    } catch (e) { /* geannuleerd → val terug op download */ }
  }
  downloadBlob(txt, filename, 'text/plain;charset=utf-8');
}

async function importBackup(file) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Dit is geen geldig JSON-bestand.');
  }
  const days = Array.isArray(data) ? data : data.days;
  if (!Array.isArray(days)) throw new Error('Geen dagboek-back-up gevonden in dit bestand.');
  let count = 0;
  for (const day of days) {
    if (day && typeof day.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
      await dbPutDay(day);
      count++;
    }
  }
  return count;
}
