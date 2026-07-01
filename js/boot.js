// Thema + lock-scherm meteen toepassen (voorkomt flits van verkeerde kleuren/inhoud).
// Los bestand i.p.v. inline script zodat een strikte Content-Security-Policy kan gelden.
(function () {
  try {
    var t = localStorage.getItem('dagboek-theme') || 'auto';
    document.documentElement.dataset.theme = t;
    if (localStorage.getItem('dagboek-pin')) document.documentElement.classList.add('locked');
  } catch (e) {
    document.documentElement.dataset.theme = 'auto';
  }
})();
