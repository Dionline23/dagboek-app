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
