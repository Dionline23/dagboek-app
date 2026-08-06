// Instappunt (ES-module): koppelt alle feature-modules aan de DOM en start op.
import {
  LS, currentDate, activeTab, loadCurrent, saveNow, switchTab, registerTabRenderers,
  openDate, backToToday, clearCurrentDay, advanceToTodayIfNeeded, confirmDialog,
  haptic, buildScoreRow,
} from './core.js';
import { todayStr, addDays } from './logic.js';
import {
  buildMoodRow, buildEmotionChips, buildExercisePresets, buildGratitude,
  initGratitudeStepper, initWritingHelp, initHabitsManager, initJournalInput,
  initExerciseInput, initDoneButtons, initBigEvent, initDictation, renderVandaag,
} from './today.js';
import { initBodyMap, renderPijn } from './pain.js';
import { renderGeschiedenis, setTagFilter, calPrevMonth, calNextMonth } from './history.js';
import { renderInzichten, setInsightMode } from './insights.js';
import {
  initThemeUI, initPinUI, initGoalUI, openLockScreen, isPinSet,
  showUpdateBanner, applyUpdate,
} from './settings.js';
import { exportBackup, exportCsv, exportText, importBackup } from './backup.js';

async function init() {
  // subtiele trilling bij het tikken op bedienbare elementen
  document.addEventListener('click', (e) => {
    if (e.target.closest('button:not(:disabled), .region')) haptic();
  }, true);

  registerTabRenderers({
    vandaag: renderVandaag, pijn: renderPijn,
    geschiedenis: renderGeschiedenis, inzichten: renderInzichten,
  });

  buildMoodRow();
  buildScoreRow(document.getElementById('morning-scores'), 'morningScore');
  buildScoreRow(document.getElementById('evening-scores'), 'eveningScore');
  buildScoreRow(document.getElementById('pain-morning'), 'painMorning');
  buildScoreRow(document.getElementById('pain-afternoon'), 'painAfternoon');
  buildScoreRow(document.getElementById('pain-evening'), 'painEvening');
  buildExercisePresets();

  initGratitudeStepper();
  initBodyMap();

  initWritingHelp();
  initHabitsManager();
  initDoneButtons();

  buildGratitude();
  buildEmotionChips();
  initJournalInput();
  initDictation();
  initBigEvent();
  initExerciseInput();

  document.getElementById('btn-back-to-today').addEventListener('click', backToToday);
  document.getElementById('btn-pain-back-to-today').addEventListener('click', backToToday);

  // dag-navigatie: vorige/volgende dag
  document.getElementById('day-prev').addEventListener('click', () => openDate(addDays(currentDate, -1)));
  document.getElementById('day-next').addEventListener('click', () => {
    if (currentDate < todayStr()) openDate(addDays(currentDate, 1));
  });
  document.getElementById('btn-fill-missed').addEventListener('click', () => {
    const target = document.getElementById('missed-banner').dataset.target;
    if (target) openDate(target);
  });

  let searchDebounce = null;
  document.getElementById('history-search').addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => renderGeschiedenis(), 300);
  });
  document.getElementById('history-filter-clear').addEventListener('click', () => setTagFilter(null));
  document.getElementById('cal-prev').addEventListener('click', () => calPrevMonth());
  document.getElementById('cal-next').addEventListener('click', () => calNextMonth());

  for (const btn of document.querySelectorAll('.tabbtn')) {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  }

  initSwipeNav();

  // header krijgt schaduw zodra de pagina gescrolld is
  const headerEl = document.querySelector('.app-header');
  const onScroll = () => headerEl.classList.toggle('scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.getElementById('period-segment').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    for (const b of document.querySelectorAll('#period-segment button')) {
      b.classList.toggle('active', b === btn);
    }
    setInsightMode(btn.dataset.mode);
  });

  // back-up
  document.getElementById('btn-export').addEventListener('click', async () => {
    await saveNow(true);
    await exportBackup();
    document.getElementById('backup-status').textContent = 'Back-up gedownload.';
  });
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('btn-export-csv').addEventListener('click', async () => {
    await saveNow(true);
    await exportCsv();
    document.getElementById('backup-status').textContent = 'CSV gedownload.';
  });
  document.getElementById('btn-export-txt').addEventListener('click', async () => {
    await saveNow(true);
    await exportText();
  });
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const status = document.getElementById('backup-status');
    const ok = await confirmDialog({
      title: 'Back-up importeren?',
      message: 'Dagen uit het bestand worden samengevoegd; bestaande dagen met dezelfde datum worden overschreven.',
      confirmText: 'Importeren',
    });
    if (!ok) { e.target.value = ''; return; }
    try {
      const count = await importBackup(file);
      await loadCurrent();
      status.textContent = `${count} dag(en) geïmporteerd.`;
    } catch (err) {
      status.textContent = `Import mislukt: ${err.message}`;
    }
    e.target.value = '';
  });

  // Dag leegmaken (met ongedaan-maken)
  document.getElementById('btn-clear-day').addEventListener('click', () => clearCurrentDay());

  // instellingen
  initThemeUI();
  initPinUI();
  initGoalUI();

  // update-banner knop
  document.getElementById('btn-update').addEventListener('click', () => applyUpdate());

  // bij achtergrond: vergrendel; bij terugkeren: eventueel naar vandaag springen
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') {
      if (isPinSet()) openLockScreen(false);
      return;
    }
    if (document.visibilityState === 'visible') {
      await advanceToTodayIfNeeded();
    }
  });

  await loadCurrent();
  switchTab('vandaag');

  // onboarding bij eerste gebruik
  const ob = document.getElementById('onboarding');
  if (!localStorage.getItem(LS.onboarded)) ob.classList.remove('hidden');
  document.getElementById('ob-start').addEventListener('click', () => {
    localStorage.setItem(LS.onboarded, '1');
    ob.classList.add('hidden');
  });

  // pincode: vergrendel bij openen
  if (isPinSet()) openLockScreen(false);
  else document.documentElement.classList.remove('locked');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(nw);
          }
        });
      });
    });
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  }
}

// ---- Swipe-navigatie tussen tabs ----
// De actieve tab volgt de vinger; bij loslaten schuift hij door naar de
// volgende tab of veert terug. Richting wordt één keer vergrendeld zodat
// verticaal scrollen nooit per ongeluk een tabwissel wordt.
function initSwipeNav() {
  const TAB_ORDER = ['vandaag', 'pijn', 'geschiedenis', 'inzichten', 'meer'];
  // plekken waar een sleep iets anders betekent (tekenen, typen, kiezen)
  const NO_SWIPE = 'input, textarea, select, svg, canvas';

  let startX = 0, startY = 0, startT = 0, idx = 0;
  let panel = null;    // de tab die meebeweegt
  let decided = false; // richting al vastgesteld?
  let dragging = false;

  const visibleTab = () => document.querySelector('.tab:not(.hidden)');
  const overlayOpen = () =>
    !document.getElementById('dialog').classList.contains('hidden') ||
    !document.getElementById('onboarding').classList.contains('hidden');

  const reset = () => {
    if (panel) { panel.classList.remove('swiping'); panel.style.transform = ''; }
    panel = null; decided = false; dragging = false;
  };

  document.addEventListener('touchstart', (e) => {
    reset();
    if (e.touches.length !== 1 || overlayOpen()) return;
    if (e.target.closest && e.target.closest(NO_SWIPE)) return;
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY; startT = Date.now();
    idx = TAB_ORDER.indexOf(activeTab);
    panel = visibleTab();
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!panel || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    if (!decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // nog te klein om te weten
      decided = true;
      dragging = Math.abs(dx) > Math.abs(dy) * 1.2;
      if (!dragging) { panel = null; return; } // verticaal: laat scrollen met rust
      panel.classList.add('swiping');
    }
    // aan de uiteinden voelbaar tegenwerken i.p.v. hard blokkeren
    const atEdge = (dx > 0 && idx === 0) || (dx < 0 && idx === TAB_ORDER.length - 1);
    panel.style.transform = `translateX(${atEdge ? dx * 0.25 : dx}px)`;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!panel || !dragging) { reset(); return; }
    const dx = e.changedTouches[0].clientX - startX;
    const speed = Math.abs(dx) / Math.max(Date.now() - startT, 1); // px/ms
    const dir = dx < 0 ? 1 : -1;
    const target = idx + dir;
    const commit = (Math.abs(dx) > window.innerWidth * 0.22 || (speed > 0.35 && Math.abs(dx) > 45))
      && target >= 0 && target < TAB_ORDER.length;

    const old = panel;
    old.classList.remove('swiping');
    old.classList.add('swipe-settle');
    old.style.transform = '';
    setTimeout(() => old.classList.remove('swipe-settle'), 260);
    panel = null; decided = false; dragging = false;

    if (!commit) return;
    switchTab(TAB_ORDER[target]);
    const next = visibleTab();
    if (next) {
      const cls = dir === 1 ? 'swipe-in-right' : 'swipe-in-left';
      next.classList.add(cls);
      next.addEventListener('animationend', () => next.classList.remove(cls), { once: true });
    }
    haptic(8);
  }, { passive: true });

  document.addEventListener('touchcancel', reset, { passive: true });
}

init();
