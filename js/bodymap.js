// Lichaamskaarten (voor/achter) uit data opgebouwd, zodat het silhouet niet
// meer 2× (en de regio's niet meer als losse HTML) gedupliceerd staan (C5).

export const REGION_LABELS = {
  // voorkant
  hoofd: 'Hoofd', nek: 'Nek', 'schouder-l': 'Schouder links', 'schouder-r': 'Schouder rechts',
  borst: 'Borst', buik: 'Buik', 'arm-l': 'Arm links', 'arm-r': 'Arm rechts',
  'hand-l': 'Hand links', 'hand-r': 'Hand rechts', heup: 'Heupen/bekken',
  'been-l': 'Been links', 'been-r': 'Been rechts', 'knie-l': 'Knie links', 'knie-r': 'Knie rechts',
  'voet-l': 'Voet links', 'voet-r': 'Voet rechts',
  // achterkant
  achterhoofd: 'Achterhoofd', 'nek-achter': 'Nek (achter)',
  'schouder-l-achter': 'Schouder links (achter)', 'schouder-r-achter': 'Schouder rechts (achter)',
  bovenrug: 'Bovenrug', onderrug: 'Onderrug',
  'arm-l-achter': 'Arm links (achter)', 'arm-r-achter': 'Arm rechts (achter)',
  'bil-l': 'Bil links', 'bil-r': 'Bil rechts',
  'dij-l-achter': 'Bovenbeen links (achter)', 'dij-r-achter': 'Bovenbeen rechts (achter)',
  'kuit-l': 'Kuit links', 'kuit-r': 'Kuit rechts', 'hiel-l': 'Hiel links', 'hiel-r': 'Hiel rechts',
};

// Decoratief silhouet — één keer gedefinieerd, gedeeld door voor- en achterkant.
const SILHOUETTE = [
  'M100,8 C116,8 122,20 122,32 C122,46 115,56 108,60 C112,62 118,65 122,68 C132,68 142,70 148,73 C152,76 150,84 144,86 C138,89 128,90 128,90 C130,98 130,112 128,114 C128,132 128,150 128,162 C130,170 128,184 126,190 L74,190 C72,184 70,170 72,162 C72,150 72,132 72,114 C70,112 70,98 72,90 C72,90 62,89 56,86 C50,84 48,76 52,73 C58,70 68,68 78,68 C82,65 88,62 92,60 C85,56 78,46 78,32 C78,20 84,8 100,8 Z',
  'M47,74 C55,72 63,72 63,74 C63,95 62,120 60,140 C58,148 56,162 55,162 C50,162 48,148 48,140 C46,120 46,95 47,74 Z',
  'M137,74 C145,72 153,72 153,74 C154,95 154,120 152,140 C152,148 150,162 145,162 C140,162 138,148 140,140 C138,120 137,95 137,74 Z',
  'M76,190 C80,187 97,187 98,190 C99,220 98,250 97,275 C96,288 91,308 87,314 C83,318 79,308 78,298 C76,285 74,255 74,220 C73,208 75,194 76,190 Z',
  'M102,190 C103,187 120,187 124,190 C125,194 127,208 126,220 C126,255 124,285 122,298 C121,308 117,318 113,314 C109,308 104,288 103,275 C102,250 101,220 102,190 Z',
];

const FRONT_REGIONS = [
  { id: 'hoofd', ellipse: { cx: 100, cy: 34, rx: 22, ry: 26 } },
  { id: 'nek', d: 'M93,58 Q100,56 107,58 L107,72 Q100,74 93,72 Z' },
  { id: 'schouder-l', d: 'M84,70 Q69,68 54,72 Q51,79 54,86 Q69,88 82,86 Q85,78 84,70 Z' },
  { id: 'schouder-r', d: 'M116,70 Q131,68 146,72 Q149,79 146,86 Q131,88 118,86 Q115,78 116,70 Z' },
  { id: 'borst', d: 'M73,72 Q100,69 127,72 Q130,92 126,113 Q100,116 74,113 Q70,92 73,72 Z' },
  { id: 'buik', d: 'M74,113 Q100,116 126,113 Q128,137 125,161 Q100,164 75,161 Q72,137 74,113 Z' },
  { id: 'arm-l', d: 'M47,75 Q55,73 63,75 Q62,107 60,138 Q53,141 47,138 Q46,107 47,75 Z' },
  { id: 'arm-r', d: 'M137,75 Q145,73 153,75 Q154,107 152,138 Q145,141 139,138 Q138,107 137,75 Z' },
  { id: 'hand-l', ellipse: { cx: 55, cy: 150, rx: 9, ry: 11 } },
  { id: 'hand-r', ellipse: { cx: 145, cy: 150, rx: 9, ry: 11 } },
  { id: 'heup', d: 'M72,161 Q100,158 128,161 Q130,175 127,188 Q100,192 73,188 Q70,175 72,161 Z' },
  { id: 'been-l', d: 'M76,188 Q87,186 98,188 Q99,239 97,290 Q87,294 77,290 Q75,239 76,188 Z' },
  { id: 'been-r', d: 'M102,188 Q113,186 124,188 Q125,239 123,290 Q113,294 103,290 Q101,239 102,188 Z' },
  { id: 'knie-l', ellipse: { cx: 87, cy: 240, rx: 12, ry: 12 } },
  { id: 'knie-r', ellipse: { cx: 113, cy: 240, rx: 12, ry: 12 } },
  { id: 'voet-l', ellipse: { cx: 86, cy: 305, rx: 11, ry: 9 } },
  { id: 'voet-r', ellipse: { cx: 114, cy: 305, rx: 11, ry: 9 } },
];

const BACK_REGIONS = [
  { id: 'achterhoofd', ellipse: { cx: 100, cy: 34, rx: 22, ry: 26 } },
  { id: 'nek-achter', d: 'M93,58 Q100,56 107,58 L107,72 Q100,74 93,72 Z' },
  { id: 'schouder-l-achter', d: 'M84,70 Q69,68 54,72 Q51,79 54,86 Q69,88 82,86 Q85,78 84,70 Z' },
  { id: 'schouder-r-achter', d: 'M116,70 Q131,68 146,72 Q149,79 146,86 Q131,88 118,86 Q115,78 116,70 Z' },
  { id: 'bovenrug', d: 'M73,72 Q100,69 127,72 Q130,92 126,113 Q100,116 74,113 Q70,92 73,72 Z' },
  { id: 'onderrug', d: 'M74,113 Q100,116 126,113 Q128,137 125,161 Q100,164 75,161 Q72,137 74,113 Z' },
  { id: 'arm-l-achter', d: 'M47,75 Q55,73 63,75 Q62,107 60,138 Q53,141 47,138 Q46,107 47,75 Z' },
  { id: 'arm-r-achter', d: 'M137,75 Q145,73 153,75 Q154,107 152,138 Q145,141 139,138 Q138,107 137,75 Z' },
  { id: 'bil-l', d: 'M73,161 Q87,158 101,161 Q103,175 100,190 Q87,194 74,190 Q71,175 73,161 Z' },
  { id: 'bil-r', d: 'M99,161 Q113,158 127,161 Q129,175 126,190 Q113,194 100,190 Q98,175 99,161 Z' },
  { id: 'dij-l-achter', d: 'M76,190 Q87,188 98,190 Q99,216 97,242 Q87,246 77,242 Q75,216 76,190 Z' },
  { id: 'dij-r-achter', d: 'M102,190 Q113,188 124,190 Q125,216 123,242 Q113,246 103,242 Q101,216 102,190 Z' },
  { id: 'kuit-l', d: 'M77,242 Q87,240 97,242 Q98,264 96,286 Q87,290 77,286 Q75,264 77,242 Z' },
  { id: 'kuit-r', d: 'M103,242 Q113,240 123,242 Q124,264 122,286 Q113,290 103,286 Q101,264 103,242 Z' },
  { id: 'hiel-l', ellipse: { cx: 86, cy: 305, rx: 11, ry: 9 } },
  { id: 'hiel-r', ellipse: { cx: 114, cy: 305, rx: 11, ry: 9 } },
];

function regionsSvg(regions) {
  const sil = SILHOUETTE.map((d) => `<path class="body-silhouette" d="${d}"></path>`).join('');
  const reg = regions.map((r) => r.ellipse
    ? `<ellipse class="region" data-region="${r.id}" cx="${r.ellipse.cx}" cy="${r.ellipse.cy}" rx="${r.ellipse.rx}" ry="${r.ellipse.ry}"></ellipse>`
    : `<path class="region" data-region="${r.id}" d="${r.d}"></path>`
  ).join('');
  return sil + reg;
}

// Vult de (lege) <svg>-containers in de HTML met silhouet + klikbare regio's.
export function buildBodyMaps() {
  const fill = (id, label, regions) => {
    const svg = document.getElementById(id);
    if (!svg) return;
    svg.setAttribute('viewBox', '0 0 200 380');
    svg.setAttribute('aria-label', label);
    svg.innerHTML = regionsSvg(regions);
  };
  fill('bodymap-front', 'Lichaamskaart voorkant', FRONT_REGIONS);
  fill('bodymap-back', 'Lichaamskaart achterkant', BACK_REGIONS);
}
