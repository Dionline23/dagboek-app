// Simpele canvas-lijngrafieken, zonder externe library.
// series: [{ label, color, points: [{date, value}] }]
// opts: { yMin, yMax, dates: [alle datums op de x-as, oplopend] }
function drawLineChart(canvas, series, opts) {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 320;
  const cssHeight = canvas.clientHeight || 180;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const style = getComputedStyle(document.documentElement);
  const gridColor = style.getPropertyValue('--chart-grid').trim() || '#ccc';
  const textColor = style.getPropertyValue('--chart-text').trim() || '#888';

  const pad = { top: 10, right: 10, bottom: 22, left: 30 };
  const plotW = cssWidth - pad.left - pad.right;
  const plotH = cssHeight - pad.top - pad.bottom;

  const dates = opts.dates;
  let yMin = opts.yMin;
  let yMax = opts.yMax;
  if (yMax == null) {
    yMax = 0;
    for (const s of series) for (const p of s.points) if (p.value > yMax) yMax = p.value;
    yMax = Math.max(yMax, 1);
  }
  if (yMin == null) yMin = 0;

  const xFor = (i) => pad.left + (dates.length <= 1 ? plotW / 2 : (i / (dates.length - 1)) * plotW);
  const yFor = (v) => pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // horizontale gridlijnen + y-labels
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = textColor;
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const v = yMin + ((yMax - yMin) / ySteps) * i;
    const y = yFor(v);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(cssWidth - pad.right, y);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.round(v)), pad.left - 5, y);
  }

  // x-labels: eerste, midden, laatste datum (dd-mm)
  ctx.textBaseline = 'top';
  const labelIdx = dates.length <= 2 ? dates.map((_, i) => i)
    : [0, Math.floor((dates.length - 1) / 2), dates.length - 1];
  for (const i of labelIdx) {
    const [, m, d] = dates[i].split('-');
    // eerste label links uitlijnen, laatste rechts, zodat ze binnen het canvas blijven
    ctx.textAlign = i === 0 ? 'left' : i === dates.length - 1 ? 'right' : 'center';
    ctx.fillText(`${d}-${m}`, xFor(i), pad.top + plotH + 6);
  }

  // lijnen + punten per serie
  const idxByDate = new Map(dates.map((d, i) => [d, i]));
  const fillArea = series.length === 1; // vlak onder de lijn alleen bij één serie
  for (const s of series) {
    const raw = s.points.filter((p) => p.value != null && idxByDate.has(p.date));
    const pts = raw.map((p) => ({ x: xFor(idxByDate.get(p.date)), y: yFor(p.value), value: p.value }));

    // zacht kleurverloop onder de lijn
    if (fillArea && pts.length > 1) {
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
      grad.addColorStop(0, hexToRgba(s.color, 0.28));
      grad.addColorStop(1, hexToRgba(s.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pad.top + plotH);
      pts.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(pts[pts.length - 1].x, pad.top + plotH);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    if (pts.length > 1) {
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // waardelabel bij het laatste punt
    if (pts.length) {
      const last = pts[pts.length - 1];
      ctx.beginPath();
      ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
      ctx.fill();
      const txt = String(Math.round(last.value * 10) / 10).replace('.', ',');
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      const tx = Math.min(last.x, cssWidth - pad.right);
      const ty = Math.max(pad.top + 6, last.y - 9);
      ctx.fillStyle = s.color;
      ctx.fillText(txt, tx, ty);
    }
  }
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
