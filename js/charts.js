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
  for (const s of series) {
    const pts = s.points
      .filter((p) => p.value != null && idxByDate.has(p.date))
      .map((p) => ({ x: xFor(idxByDate.get(p.date)), y: yFor(p.value) }));
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = 2;
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
  }
}
