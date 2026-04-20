(function () {
  const wIn = document.getElementById('wInput');
  const hIn = document.getElementById('hInput');
  const cIn = document.getElementById('cInput');
  const fsIn = document.getElementById('fsInput');
  const wVal = document.getElementById('wVal');
  const hVal = document.getElementById('hVal');
  const cVal = document.getElementById('cVal');
  const fsVal = document.getElementById('fsVal');
  const text1In = document.getElementById('text1Input');
  const text2In = document.getElementById('text2Input');
  const canvas = document.getElementById('canvas');
  const btn = document.getElementById('randomBtn');
  const downloadBtn = document.getElementById('downloadBtn');

  let W = +wIn.value, H = +hIn.value, COUNT = +cIn.value, FS = +fsIn.value;
  let TEXT1 = text1In.value, TEXT2 = text2In.value;
  let seed = Date.now();

  function rng() {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }

  const diag = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

  function generate() {
    const sq = Math.floor(H / 3);

    const overlapRatio = 0.4 + rng() * 0.2;
    const offsetDist = sq * (1 - overlapRatio);

    const offsetPatterns = [
      { dx: 1, dy: 1, text1: 'top-right', text2: 'bottom-left' },
      { dx: -1, dy: 1, text1: 'top-left', text2: 'bottom-right' },
      { dx: 1, dy: -1, text1: 'bottom-right', text2: 'top-left' },
      { dx: -1, dy: -1, text1: 'bottom-left', text2: 'top-right' },
    ];
    const pat = pick(offsetPatterns);
    const dx = pat.dx * offsetDist;
    const dy = pat.dy * offsetDist;

    const s1xMin = Math.max(0, -dx);
    const s1xMax = Math.min(W - sq, W - sq - dx);
    const s1yMin = Math.max(0, -dy);
    const s1yMax = Math.min(H - sq, H - sq - dy);

    let s1x = s1xMin + rng() * Math.max(0, s1xMax - s1xMin);
    let s1y = s1yMin + rng() * Math.max(0, s1yMax - s1yMin);
    s1x = Math.round(s1x); s1y = Math.round(s1y);
    let s2x = Math.round(s1x + dx);
    let s2y = Math.round(s1y + dy);

    const s2Rect = { x: s2x, y: s2y, w: sq, h: sq };
    const overlapsS2 = (c, r) => {
      const x = s1x + c * sq;
      const y = s1y + r * sq;
      return !(x + sq <= s2Rect.x || x >= s2Rect.x + s2Rect.w ||
               y + sq <= s2Rect.y || y >= s2Rect.y + s2Rect.h);
    };

    const occupied = new Set();
    const key = (c, r) => `${c},${r}`;
    occupied.add(key(0, 0));

    const endC = Math.round(dx / sq);
    const endR = Math.round(dy / sq);
    const endCell = (endC === 0 && endR === 0)
      ? { c: Math.sign(dx) || 1, r: Math.sign(dy) || 1 }
      : { c: endC, r: endR };

    const filled = [];

    const walkToward = (from, target, remaining) => {
      const path = [];
      let cur = { ...from };
      while (remaining > 0 && (cur.c !== target.c || cur.r !== target.r)) {
        const opts = shuffle(diag.map(([a, b]) => ({ c: cur.c + a, r: cur.r + b })));
        opts.sort((a, b) => {
          const da = Math.abs(a.c - target.c) + Math.abs(a.r - target.r);
          const db = Math.abs(b.c - target.c) + Math.abs(b.r - target.r);
          return da - db;
        });
        let chosen = null;
        for (const opt of opts) {
          if (!occupied.has(key(opt.c, opt.r)) && !overlapsS2(opt.c, opt.r)) {
            chosen = opt; break;
          }
        }
        if (!chosen) break;
        occupied.add(key(chosen.c, chosen.r));
        path.push(chosen);
        cur = chosen;
        remaining--;
        if (chosen.c === target.c && chosen.r === target.r) break;
      }
      return { path, cur, remaining };
    };

    let budget = COUNT;
    const { path: path1, cur: afterWalk, remaining } = walkToward({ c: 0, r: 0 }, endCell, budget);
    filled.push(...path1);
    budget = remaining;
    let current = afterWalk;

    while (budget > 0) {
      const opts = shuffle(diag.map(([a, b]) => ({ c: current.c + a, r: current.r + b })))
        .filter(p => !occupied.has(key(p.c, p.r)) && !overlapsS2(p.c, p.r));
      const inside = opts.filter(p => {
        const x = s1x + p.c * sq;
        const y = s1y + p.r * sq;
        return x + sq > 0 && x < W && y + sq > 0 && y < H;
      });
      const ordered = inside.length ? inside : opts;
      if (!ordered.length) {
        if (filled.length > 1) {
          current = filled[Math.floor(rng() * filled.length)];
          continue;
        }
        break;
      }
      const chosen = ordered[0];
      occupied.add(key(chosen.c, chosen.r));
      filled.push(chosen);
      current = chosen;
      budget--;
    }

    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    canvas.innerHTML = '';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.display = 'block';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPath.setAttribute('id', 'vp');
    const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    clipRect.setAttribute('x', 0); clipRect.setAttribute('y', 0);
    clipRect.setAttribute('width', W); clipRect.setAttribute('height', H);
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);
    svg.appendChild(defs);

    const root = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    root.setAttribute('clip-path', 'url(#vp)');

    // Background rect — so exported SVG has the canvas color baked in
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', 0);
    bgRect.setAttribute('y', 0);
    bgRect.setAttribute('width', W);
    bgRect.setAttribute('height', H);
    bgRect.setAttribute('fill', '#A4BECA');
    root.appendChild(bgRect);

    const makeFilledRect = (col, row) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      el.setAttribute('x', s1x + col * sq);
      el.setAttribute('y', s1y + row * sq);
      el.setAttribute('width', sq);
      el.setAttribute('height', sq);
      el.setAttribute('fill', '#0098B6');
      return el;
    };

    const makeOutlinedRect = (x, y) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      el.setAttribute('x', x);
      el.setAttribute('y', y);
      el.setAttribute('width', sq);
      el.setAttribute('height', sq);
      el.setAttribute('fill', 'transparent');
      el.setAttribute('stroke', 'white');
      el.setAttribute('stroke-width', 1);
      return el;
    };

    const makeLabel = (x, y, lines, position) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const fs = FS;
      const lineH = fs * 1.45;
      const margin = Math.max(8, sq * 0.06);

      let tx, ty, anchor;
      const totalH = lines.length * lineH;

      switch (position) {
        case 'top-left':
          tx = x + margin; ty = y + margin + fs * 0.9; anchor = 'start'; break;
        case 'top-right':
          tx = x + sq - margin; ty = y + margin + fs * 0.9; anchor = 'end'; break;
        case 'bottom-left':
          tx = x + margin; ty = y + sq - totalH - margin + fs * 0.9; anchor = 'start'; break;
        case 'bottom-right':
          tx = x + sq - margin; ty = y + sq - totalH - margin + fs * 0.9; anchor = 'end'; break;
        default:
          tx = x + sq / 2; ty = y + (sq - totalH) / 2 + fs * 0.9; anchor = 'middle';
      }

      lines.forEach((line, i) => {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', tx);
        t.setAttribute('y', ty + i * lineH);
        t.setAttribute('text-anchor', anchor);
        t.setAttribute('fill', 'white');
        t.setAttribute('font-size', fs);
        t.setAttribute('font-family', 'Inter, sans-serif');
        t.setAttribute('font-weight', '400');
        t.textContent = line;
        g.appendChild(t);
      });
      return g;
    };

    const allEls = [];
    const filledStartDelay = 320;

    filled.forEach(({ c, r }, i) => {
      const delay = filledStartDelay + i * 70;
      const rect = makeFilledRect(c, r);
      rect.style.opacity = 0;
      rect.style.transition = `opacity 0.25s ease ${delay}ms`;
      root.appendChild(rect);
      allEls.push({ el: rect, delay });
    });

    const lines1 = TEXT1.split('\n');
    const lines2 = TEXT2.split('\n');

    const specialDefs = [
      { x: s1x, y: s1y, lines: lines1.length ? lines1 : [''], textPos: pat.text1 },
      { x: s2x, y: s2y, lines: lines2.length ? lines2 : [''], textPos: pat.text2 }
    ];

    specialDefs.forEach(({ x, y, lines, textPos }, i) => {
      const delay = i * 120;
      const rect = makeOutlinedRect(x, y);
      rect.style.opacity = 0;
      rect.style.transition = `opacity 0.3s ease ${delay}ms`;
      root.appendChild(rect);
      allEls.push({ el: rect, delay });

      const txt = makeLabel(x, y, lines, textPos);
      txt.style.opacity = 0;
      txt.style.transition = `opacity 0.3s ease ${delay + 80}ms`;
      root.appendChild(txt);
      allEls.push({ el: txt, delay: delay + 80 });
    });

    svg.appendChild(root);
    canvas.appendChild(svg);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      allEls.forEach(({ el }) => { el.style.opacity = 1; });
    }));
  }

  wIn.addEventListener('input', () => { W = +wIn.value; wVal.textContent = W; generate(); });
  hIn.addEventListener('input', () => { H = +hIn.value; hVal.textContent = H; generate(); });
  cIn.addEventListener('input', () => { COUNT = +cIn.value; cVal.textContent = COUNT; generate(); });

  let lastSeed = seed;
  const rerender = () => { seed = lastSeed; generate(); };
  fsIn.addEventListener('input', () => { FS = +fsIn.value; fsVal.textContent = FS; rerender(); });
  text1In.addEventListener('input', () => { TEXT1 = text1In.value; rerender(); });
  text2In.addEventListener('input', () => { TEXT2 = text2In.value; rerender(); });

  btn.addEventListener('click', () => {
    seed = Date.now() + Math.floor(Math.random() * 999999);
    lastSeed = seed;
    generate();
  });

  downloadBtn.addEventListener('click', () => {
    const svg = canvas.querySelector('svg');
    if (!svg) return;

    // Clone so we can add namespace + clean up animation transitions
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    // Strip any inline opacity/transition (from animation) so static SVG is fully visible
    clone.querySelectorAll('[style]').forEach(el => {
      el.removeAttribute('style');
    });

    // Embed Inter font so text renders correctly when opened outside browser
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap'); text { font-family: 'Inter', sans-serif; }`;
    clone.insertBefore(style, clone.firstChild);

    const serializer = new XMLSerializer();
    const svgStr = '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(clone);

    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `layout-${W}x${H}-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  lastSeed = seed;
  generate();
})();
