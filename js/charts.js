// Vloeiende canvas-lijngrafieken met Catmull-Rom splines en touch-tooltips.
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

  const style = getComputedStyle(document.documentElement);
  const gridColor = style.getPropertyValue('--chart-grid').trim() || '#ccc';
  const textColor = style.getPropertyValue('--chart-text').trim() || '#888';
  const cardBg = style.getPropertyValue('--card').trim() || '#fff';

  const pad = { top: 10, right: 10, bottom: 22, left: 30 };
  const plotW = cssWidth - pad.left - pad.right;
  const plotH = cssHeight - pad.top - pad.bottom;

  const dates = opts.dates;
  // Weergavelabels per x-positie (bv. weeknr/maand); anders dd-mm uit de datum.
  const labels = opts.labels || dates.map((d) => {
    const [, m, dd] = d.split('-');
    return `${dd}-${m}`;
  });
  let yMin = opts.yMin != null ? opts.yMin : 0;
  let yMax = opts.yMax;
  if (yMax == null) {
    yMax = 0;
    for (const s of series) for (const p of s.points) if (p.value > yMax) yMax = p.value;
    yMax = Math.max(yMax, 1);
  }

  const xFor = (i) => pad.left + (dates.length <= 1 ? plotW / 2 : (i / (dates.length - 1)) * plotW);
  const yFor = (v) => pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const idxByDate = new Map(dates.map((d, i) => [d, i]));

  // Big Event-markeringen (verticale lijn + tooltiptekst op die datum)
  const eventByDate = new Map(
    (opts.events || []).filter((e) => idxByDate.has(e.date)).map((e) => [e.date, e.text]));
  const EVENT_COLOR = '#b98bd9';

  // Bereken pts per serie
  const allSeriesPts = series.map((s) => {
    const raw = s.points.filter((p) => p.value != null && idxByDate.has(p.date));
    return {
      s,
      pts: raw.map((p) => ({ x: xFor(idxByDate.get(p.date)), y: yFor(p.value), value: p.value, date: p.date })),
    };
  });

  function render(highlightX) {
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Horizontale gridlijnen + y-labels
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

    // X-labels: eerste, midden, laatste datum (dd-mm)
    ctx.textBaseline = 'top';
    const labelIdx = dates.length <= 2 ? dates.map((_, i) => i)
      : [0, Math.floor((dates.length - 1) / 2), dates.length - 1];
    for (const i of labelIdx) {
      ctx.textAlign = i === 0 ? 'left' : i === dates.length - 1 ? 'right' : 'center';
      ctx.fillStyle = textColor;
      ctx.fillText(labels[i], xFor(i), pad.top + plotH + 6);
    }

    // Big Event-markeringen: subtiele verticale lijn + stip bovenaan
    for (const date of eventByDate.keys()) {
      const ex = xFor(idxByDate.get(date));
      ctx.save();
      ctx.strokeStyle = hexToRgba(EVENT_COLOR, 0.55);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(ex, pad.top);
      ctx.lineTo(ex, pad.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = EVENT_COLOR;
      ctx.beginPath();
      ctx.arc(ex, pad.top + 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const fillArea = series.length === 1;

    for (const { s, pts } of allSeriesPts) {
      if (pts.length === 0) continue;

      // Vloeiend kleurverloop onder de lijn
      if (fillArea && pts.length > 1) {
        const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
        grad.addColorStop(0, hexToRgba(s.color, 0.28));
        grad.addColorStop(1, hexToRgba(s.color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pad.top + plotH);
        ctx.lineTo(pts[0].x, pts[0].y);
        drawSmooth(ctx, pts);
        ctx.lineTo(pts[pts.length - 1].x, pad.top + plotH);
        ctx.closePath();
        ctx.fill();
      }

      // Vloeiende lijn
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      if (pts.length > 1) {
        ctx.beginPath();
        drawSmooth(ctx, pts);
        ctx.stroke();
      }

      // Punten
      ctx.fillStyle = s.color;
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Waardelabel bij het laatste punt
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

    // Tooltip / crosshair bij hover of touch
    if (highlightX != null) {
      // Zoek dichtstbijzijnde datum-index
      let nearIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < dates.length; i++) {
        const d = Math.abs(xFor(i) - highlightX);
        if (d < minDist) { minDist = d; nearIdx = i; }
      }
      const hx = xFor(nearIdx);
      const hDate = dates[nearIdx];

      // Verticale lijn
      ctx.save();
      ctx.strokeStyle = hexToRgba(textColor || '#888', 0.35);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(hx, pad.top);
      ctx.lineTo(hx, pad.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Punt highlight + tooltip tekst
      const tooltipLines = [];
      tooltipLines.push({ text: labels[nearIdx], color: textColor });

      const ev = eventByDate.get(hDate);
      if (ev) tooltipLines.push({ text: '🌟 ' + (ev.length > 32 ? ev.slice(0, 31) + '…' : ev), color: EVENT_COLOR });

      for (const { s, pts } of allSeriesPts) {
        const p = pts.find((pt) => pt.date === hDate);
        if (p) {
          // Vergroot punt
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = cardBg;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          const val = String(Math.round(p.value * 10) / 10).replace('.', ',');
          tooltipLines.push({ text: `${s.label}: ${val}`, color: s.color });
        }
      }

      // Tooltip box
      ctx.font = '10px system-ui, sans-serif';
      const lineH = 14;
      const boxPad = 6;
      const boxW = Math.max(...tooltipLines.map((l) => ctx.measureText(l.text).width)) + boxPad * 2;
      const boxH = tooltipLines.length * lineH + boxPad * 2 - 2;
      let bx = hx + 6;
      if (bx + boxW > cssWidth - pad.right) bx = hx - boxW - 6;
      const by = pad.top + 4;

      ctx.fillStyle = hexToRgba(cardBg, 0.92);
      ctx.strokeStyle = hexToRgba(textColor || '#888', 0.18);
      ctx.lineWidth = 1;
      roundRect(ctx, bx, by, boxW, boxH, 5);
      ctx.fill();
      ctx.stroke();

      for (let i = 0; i < tooltipLines.length; i++) {
        ctx.fillStyle = tooltipLines[i].color;
        ctx.font = i === 0 ? 'bold 10px system-ui, sans-serif' : '10px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(tooltipLines[i].text, bx + boxPad, by + boxPad + i * lineH);
      }
    }
  }

  render(null);

  // Bewaar de actuele render + x-mapping op de canvas, zodat opnieuw tekenen
  // (periodewissel, thema, nieuwe data) de listeners van verse data voorziet.
  canvas._render = render;
  canvas._getCanvasX = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return (clientX - rect.left) * (cssWidth / rect.width);
  };

  // Event-listeners éénmalig instellen; ze verwijzen altijd naar de laatste render.
  if (!canvas._interactSetup) {
    canvas._interactSetup = true;

    // Meerdere move-events per frame samenvoegen tot één render (rAF-throttle).
    let rafPending = false;
    let pendingX = null;
    const schedule = (x) => {
      pendingX = x;
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => { rafPending = false; canvas._render(pendingX); });
    };

    canvas.addEventListener('pointermove', (e) => schedule(canvas._getCanvasX(e)));
    canvas.addEventListener('pointerleave', () => schedule(null));
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      schedule(canvas._getCanvasX(e));
    }, { passive: false });
    canvas.addEventListener('touchend', () => schedule(null));
  }
}

// Catmull-Rom spline via kubieke bezier curves
function drawSmooth(ctx, pts) {
  if (pts.length < 2) {
    if (pts.length === 1) ctx.moveTo(pts[0].x, pts[0].y);
    return;
  }
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
      p2.x, p2.y
    );
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  if (h.length < 6) return `rgba(128,128,128,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export { drawLineChart };
