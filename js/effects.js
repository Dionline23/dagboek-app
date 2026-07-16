// Feestelijke effecten — lichtgewicht, zonder externe libraries (strikte CSP).
// Confetti in de pastelkleuren van de boekkaft; slaat over bij 'minder beweging'.

const CONFETTI_COLORS = ['#86d9c0', '#f3e79a', '#f4abc4', '#9cc1f0', '#c5b1ea'];

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let confettiRunning = false;

// Korte confetti-burst over het hele scherm (~1,6 s), daarna ruimt hij zichzelf op.
export function confettiBurst() {
  if (reducedMotion() || confettiRunning) return;
  confettiRunning = true;

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // deeltjes: vanaf twee "kanonnen" linksonder en rechtsonder omhoog
  const parts = [];
  const N = 90;
  for (let i = 0; i < N; i++) {
    const fromLeft = i % 2 === 0;
    parts.push({
      x: fromLeft ? w * 0.12 : w * 0.88,
      y: h * 0.78,
      vx: (fromLeft ? 1 : -1) * (1.5 + Math.random() * 3.5),
      vy: -(7 + Math.random() * 6),
      size: 5 + Math.random() * 5,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      shape: i % 3, // 0 = rechthoek, 1 = cirkel, 2 = streepje
    });
  }

  const start = performance.now();
  const DURATION = 1600;

  function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, w, h);
    const fade = t > DURATION - 400 ? Math.max(0, (DURATION - t) / 400) : 1;
    for (const p of parts) {
      p.vy += 0.22;              // zwaartekracht
      p.vx *= 0.99;              // luchtweerstand
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 1) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 2) {
        ctx.fillRect(-p.size / 2, -p.size / 6, p.size, p.size / 3);
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      }
      ctx.restore();
    }
    if (t < DURATION) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
      confettiRunning = false;
    }
  }
  requestAnimationFrame(frame);
}
