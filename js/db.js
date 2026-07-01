// IndexedDB-helper: één record per dag, key = "YYYY-MM-DD"
const DB_NAME = 'dagboek';
const DB_VERSION = 2;
const STORE = 'dagen';

let dbPromise = null;

// Migraties draaien op volgorde van versie; elke stap gaat uit van de vorige.
// Voeg voor een schemawijziging een nieuwe `if (oldVersion < N)`-blok toe en
// verhoog DB_VERSION. Zo krijgen bestaande gebruikers de wijziging veilig mee.
function migrateDb(db, tx, oldVersion) {
  if (oldVersion < 1) {
    db.createObjectStore(STORE, { keyPath: 'date' });
  }
  if (oldVersion < 2) {
    // v2: bestaande records normaliseren zodat later toegevoegde velden bestaan.
    const store = tx.objectStore(STORE);
    store.openCursor().onsuccess = (ev) => {
      const cur = ev.target.result;
      if (!cur) return;
      const rec = cur.value;
      let changed = false;
      if (rec.painDetails == null) { rec.painDetails = {}; changed = true; }
      if (rec.done == null) { rec.done = {}; changed = true; }
      if (rec.habits == null) { rec.habits = {}; changed = true; }
      if (changed) cur.update(rec);
      cur.continue();
    };
  }
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      migrateDb(req.result, req.transaction, e.oldVersion);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function dbGetDay(date) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(date);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function dbPutDay(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetAllDays() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
