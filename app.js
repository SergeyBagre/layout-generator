(function () {
  const wIn = document.getElementById('wInput');
  const hIn = document.getElementById('hInput');
  const cIn = document.getElementById('cInput');
  const fsIn = document.getElementById('fsInput');
  const cVal = document.getElementById('cVal');
  const fsVal = document.getElementById('fsVal');
  const text1In = document.getElementById('text1Input');
  const text2In = document.getElementById('text2Input');
  const canvas = document.getElementById('canvas');
  const btn = document.getElementById('randomBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const imgFile = document.getElementById('imgFile');
  const fileName = document.getElementById('fileName');
  const clearImgBtn = document.getElementById('clearImgBtn');
  const fitSelect = document.getElementById('fitSelect');
  const scaleInput = document.getElementById('scaleInput');
  const scaleVal = document.getElementById('scaleVal');
  const footerSize = document.getElementById('footerSize');
  const footerCount = document.getElementById('footerCount');
  const footerOrient = document.getElementById('footerOrient');

  let W = +wIn.value, H = +hIn.value, COUNT = +cIn.value, FS = +fsIn.value;
  let TEXT1 = text1In.value, TEXT2 = text2In.value;
  let IMG_SRC = null;
  let IMG_NATURAL = { w: 0, h: 0 };
  let FIT = fitSelect.value;
  let SCALE = +scaleInput.value;
  let seed = Date.now();

  let s1 = null;
  let s2 = null;
  let pat = null;

  // Image position stored as top-left pixel coordinate, can be anywhere
  let imgPos = null;

  let currentSq = 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

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

  const offsetPatterns = [
    { dx: 1, dy: 1, text1: 'top-right', text2: 'bottom-left' },
    { dx: -1, dy: 1, text1: 'top-left', text2: 'bottom-right' },
    { dx: 1, dy: -1, text1: 'bottom-right', text2: 'top-left' },
    { dx: -1, dy: -1, text1: 'bottom-left', text2: 'top-right' },
  ];

  function textPosForDelta(dx, dy) {
    const sx = Math.sign(dx) || 1;
    const sy = Math.sign(dy) || 1;
    return offsetPatterns.find(p => p.dx === sx && p.dy === sy) || offsetPatterns[0];
  }

  function computeImageSize(natW, natH, fit, scalePct) {
    const scale = scalePct / 100;
    const refW = W, refH = H;
    let drawW, drawH;
    if (fit === 'fill') {
      drawW = refW * scale; drawH = refH * scale;
    } else if (fit === 'cover') {
      const r = Math.max(refW / natW, refH / natH) * scale;
      drawW = natW * r; drawH = natH * r;
    } else {
      // contain
      const r = Math.min(refW / natW, refH / natH) * scale;
      drawW = natW * r; drawH = natH * r;
    }
    return { w: drawW, h: drawH };
  }

  function randomizeSpecials() {
    const portrait = H > W;
    const sq = portrait ? Math.floor(H / 5) : Math.floor(H / 3);
    const overlapRatio = 0.4 + rng() * 0.2;
    const offsetDist = sq * (1 - overlapRatio);
    const chosenPat = pick(offsetPatterns);
    const dx = chosenPat.dx * offsetDist;
    const dy = chosenPat.dy * offsetDist;

    const s1xMin = Math.max(0, -dx);
    const s1xMax = Math.min(W - sq, W - sq - dx);
    const s1yMin = Math.max(0, -dy);
    const s1yMax = Math.min(H - sq, H - sq - dy);

    const s1x = Math.round(s1xMin + rng() * Math.max(0, s1xMax - s1xMin));
    const s1y = Math.round(s1yMin + rng() * Math.max(0, s1yMax - s1yMin));
    s1 = { x: s1x, y: s1y };
    s2 = { x: Math.round(s1x + dx), y: Math.round(s1y + dy) };
    pat = chosenPat;
  }

  function generate() {
    const portrait = H > W;
    const sq = portrait ? Math.floor(H / 5) : Math.floor(H / 3);
    currentSq = sq;

    if (!s1 || !s2) randomizeSpecials();

    s1.x = clamp(s1.x, 0, W - sq);
    s1.y = clamp(s1.y, 0, H - sq);
    s2.x = clamp(s2.x, 0, W - sq);
    s2.y = clamp(s2.y, 0, H - sq);

    pat = textPosForDelta(s2.x - s1.x, s2.y - s1.y);

    const s2Rect = { x: s2.x, y: s2.y, w: sq, h: sq };
    const overlapsS2 = (c, r) => {
      const x = s1.x + c * sq;
      const y = s1.y + r * sq;
      return !(x + sq <= s2Rect.x || x >= s2Rect.x + s2Rect.w ||
               y + sq <= s2Rect.y || y >= s2Rect.y + s2Rect.h);
    };

    const occupied = new Set();
    const key = (c, r) => `${c},${r}`;
    occupied.add(key(0, 0));

    const deltaX = s2.x - s1.x;
    const deltaY = s2.y - s1.y;
    const endC = Math.round(deltaX / sq);
    const endR = Math.round(deltaY / sq);
    const endCell = (endC === 0 && endR === 0)
      ? { c: Math.sign(deltaX) || 1, r: Math.sign(deltaY) || 1 }
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
        const x = s1.x + p.c * sq;
        const y = s1.y + p.r * sq;
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

    render(sq, filled);
    updateFooter();
  }

  function updateFooter() {
    if (footerSize) footerSize.textContent = W + ' × ' + H;
    if (footerCount) footerCount.textContent = COUNT;
    if (footerOrient) footerOrient.textContent = H > W ? 'Portrait' : (H === W ? 'Square' : 'Landscape');
  }

  function render(sq, filled) {
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const defs = document.createElementNS(svgNS, 'defs');
    const vpClip = document.createElementNS(svgNS, 'clipPath');
    vpClip.setAttribute('id', 'vp');
    const vpRect = document.createElementNS(svgNS, 'rect');
    vpRect.setAttribute('x', 0); vpRect.setAttribute('y', 0);
    vpRect.setAttribute('width', W); vpRect.setAttribute('height', H);
    vpClip.appendChild(vpRect);
    defs.appendChild(vpClip);
    svg.appendChild(defs);

    const root = document.createElementNS(svgNS, 'g');
    root.setAttribute('clip-path', 'url(#vp)');

    const bgRect = document.createElementNS(svgNS, 'rect');
    bgRect.setAttribute('x', 0); bgRect.setAttribute('y', 0);
    bgRect.setAttribute('width', W); bgRect.setAttribute('height', H);
    bgRect.setAttribute('fill', '#A4BECA');
    root.appendChild(bgRect);

    // Layer 1: Filled squares
    filled.forEach(({ c, r }) => {
      const el = document.createElementNS(svgNS, 'rect');
      el.setAttribute('x', s1.x + c * sq);
      el.setAttribute('y', s1.y + r * sq);
      el.setAttribute('width', sq);
      el.setAttribute('height', sq);
      el.setAttribute('fill', '#0098B6');
      root.appendChild(el);
    });

    // Layer 2: Image (above filled, can be anywhere on canvas, clipped by canvas viewport only)
    if (IMG_SRC && IMG_NATURAL.w > 0 && IMG_NATURAL.h > 0) {
      const size = computeImageSize(IMG_NATURAL.w, IMG_NATURAL.h, FIT, SCALE);
      // Default position: center of canvas if not yet set
      if (!imgPos) {
        imgPos = { x: (W - size.w) / 2, y: (H - size.h) / 2 };
      }
      const imgEl = document.createElementNS(svgNS, 'image');
      imgEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', IMG_SRC);
      imgEl.setAttribute('href', IMG_SRC);
      imgEl.setAttribute('x', imgPos.x);
      imgEl.setAttribute('y', imgPos.y);
      imgEl.setAttribute('width', size.w);
      imgEl.setAttribute('height', size.h);
      imgEl.setAttribute('preserveAspectRatio', 'none');
      imgEl.classList.add('draggable');
      imgEl.dataset.role = 'image';
      imgEl.dataset.sizeW = size.w;
      imgEl.dataset.sizeH = size.h;
      root.appendChild(imgEl);
    }

    // Layer 3: Outlined squares (above image)
    const specialDefs = [
      { sp: s1, lines: TEXT1.split('\n'), textPos: pat.text1, role: 's1' },
      { sp: s2, lines: TEXT2.split('\n'), textPos: pat.text2, role: 's2' }
    ];
    specialDefs.forEach(({ sp, lines, textPos, role }) => {
      const g = document.createElementNS(svgNS, 'g');
      g.classList.add('draggable');
      g.dataset.role = role;

      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', sp.x); rect.setAttribute('y', sp.y);
      rect.setAttribute('width', sq); rect.setAttribute('height', sq);
      rect.setAttribute('fill', 'transparent');
      rect.setAttribute('stroke', 'white');
      rect.setAttribute('stroke-width', 1);
      g.appendChild(rect);

      const hit = document.createElementNS(svgNS, 'rect');
      hit.setAttribute('x', sp.x); hit.setAttribute('y', sp.y);
      hit.setAttribute('width', sq); hit.setAttribute('height', sq);
      hit.setAttribute('fill', 'transparent');
      hit.setAttribute('pointer-events', 'all');
      g.appendChild(hit);

      const fs = FS;
      const lineH = fs * 1.45;
      const margin = Math.max(8, sq * 0.06);
      let tx, ty, anchor;
      const totalH = lines.length * lineH;
      switch (textPos) {
        case 'top-left': tx = sp.x + margin; ty = sp.y + margin + fs * 0.9; anchor = 'start'; break;
        case 'top-right': tx = sp.x + sq - margin; ty = sp.y + margin + fs * 0.9; anchor = 'end'; break;
        case 'bottom-left': tx = sp.x + margin; ty = sp.y + sq - totalH - margin + fs * 0.9; anchor = 'start'; break;
        case 'bottom-right': tx = sp.x + sq - margin; ty = sp.y + sq - totalH - margin + fs * 0.9; anchor = 'end'; break;
        default: tx = sp.x + sq / 2; ty = sp.y + (sq - totalH) / 2 + fs * 0.9; anchor = 'middle';
      }
      lines.forEach((line, i) => {
        const t = document.createElementNS(svgNS, 'text');
        t.setAttribute('x', tx);
        t.setAttribute('y', ty + i * lineH);
        t.setAttribute('text-anchor', anchor);
        t.setAttribute('fill', 'white');
        t.setAttribute('font-size', fs);
        t.setAttribute('font-family', 'Inter, sans-serif');
        t.setAttribute('font-weight', '400');
        t.setAttribute('pointer-events', 'none');
        t.textContent = line;
        g.appendChild(t);
      });
      root.appendChild(g);
    });

    svg.appendChild(root);
    const oldSvg = canvas.firstChild;
    if (oldSvg) canvas.replaceChild(svg, oldSvg);
    else canvas.appendChild(svg);
  }

  // Drag state persists outside render
  let drag = null;
  let rafScheduled = false;
  let pendingEvent = null;

  function getSvgPointFromEvent(evt) {
    const svg = canvas.querySelector('svg');
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const res = pt.matrixTransform(ctm.inverse());
    return { x: res.x, y: res.y };
  }

  function processPendingMove() {
    rafScheduled = false;
    if (!drag || !pendingEvent) return;
    const e = pendingEvent;
    pendingEvent = null;
    const pt = getSvgPointFromEvent(e);
    if (!pt) return;
    const sq = currentSq;
    if (drag.role === 's1') {
      s1.x = clamp(pt.x - drag.offsetX, 0, W - sq);
      s1.y = clamp(pt.y - drag.offsetY, 0, H - sq);
      generate();
    } else if (drag.role === 's2') {
      s2.x = clamp(pt.x - drag.offsetX, 0, W - sq);
      s2.y = clamp(pt.y - drag.offsetY, 0, H - sq);
      generate();
    } else if (drag.role === 'image') {
      imgPos = {
        x: pt.x - drag.offsetX,
        y: pt.y - drag.offsetY
      };
      generate();
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    const target = e.target.closest('.draggable');
    if (!target) return;
    e.preventDefault();
    const pt = getSvgPointFromEvent(e);
    if (!pt) return;
    const role = target.dataset.role;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    if (role === 's1') {
      drag = { role, pointerId: e.pointerId, offsetX: pt.x - s1.x, offsetY: pt.y - s1.y };
    } else if (role === 's2') {
      drag = { role, pointerId: e.pointerId, offsetX: pt.x - s2.x, offsetY: pt.y - s2.y };
    } else if (role === 'image') {
      drag = { role, pointerId: e.pointerId, offsetX: pt.x - imgPos.x, offsetY: pt.y - imgPos.y };
    }
    canvas.classList.add('dragging');
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    pendingEvent = e;
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(processPendingMove);
    }
  });

  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    drag = null;
    pendingEvent = null;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // Input handlers
  const handleNumberInput = (input, min, max, setter) => {
    const apply = () => {
      let v = parseInt(input.value, 10);
      if (isNaN(v)) v = min;
      v = clamp(v, min, max);
      input.value = v;
      setter(v);
      s1 = null; s2 = null;
      imgPos = null;
      generate();
    };
    input.addEventListener('change', apply);
    input.addEventListener('blur', apply);
  };
  handleNumberInput(wIn, 400, 1920, (v) => { W = v; });
  handleNumberInput(hIn, 200, 1920, (v) => { H = v; });

  cIn.addEventListener('input', () => { COUNT = +cIn.value; cVal.textContent = COUNT; generate(); });
  fsIn.addEventListener('input', () => { FS = +fsIn.value; fsVal.textContent = FS + ' px'; generate(); });
  text1In.addEventListener('input', () => { TEXT1 = text1In.value; generate(); });
  text2In.addEventListener('input', () => { TEXT2 = text2In.value; generate(); });

  fitSelect.addEventListener('change', () => {
    FIT = fitSelect.value;
    imgPos = null; // recenter when fit changes
    generate();
  });
  scaleInput.addEventListener('input', () => {
    SCALE = +scaleInput.value;
    scaleVal.textContent = SCALE + ' %';
    // Preserve user-dragged position; user can drag again if scale pushes it off
    generate();
  });

  imgFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    fileName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => {
      IMG_SRC = ev.target.result;
      const tmp = new Image();
      tmp.onload = () => {
        IMG_NATURAL = { w: tmp.naturalWidth, h: tmp.naturalHeight };
        imgPos = null;
        generate();
      };
      tmp.src = IMG_SRC;
    };
    reader.readAsDataURL(file);
  });

  clearImgBtn.addEventListener('click', () => {
    IMG_SRC = null;
    IMG_NATURAL = { w: 0, h: 0 };
    imgFile.value = '';
    fileName.textContent = 'Choose image…';
    imgPos = null;
    generate();
  });

  // RANDOM: keep s1, s2, image where user placed them. Only reshuffle the filled chain.
  btn.addEventListener('click', () => {
    seed = Date.now() + Math.floor(Math.random() * 999999);
    generate();
  });

  downloadBtn.addEventListener('click', () => {
    const svg = canvas.querySelector('svg');
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
    clone.querySelectorAll('.draggable, .dragging').forEach(el => {
      el.classList.remove('draggable', 'dragging');
    });
    clone.querySelectorAll('[data-role], [data-size-w], [data-size-h]').forEach(el => {
      el.removeAttribute('data-role');
      el.removeAttribute('data-size-w');
      el.removeAttribute('data-size-h');
    });
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
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  fsVal.textContent = FS + ' px';
  cVal.textContent = COUNT;
  scaleVal.textContent = SCALE + ' %';
  generate();
})();
