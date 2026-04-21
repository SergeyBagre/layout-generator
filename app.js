(function () {
  const wIn = document.getElementById('wInput');
  const hIn = document.getElementById('hInput');
  const cIn = document.getElementById('cInput');
  const fsIn = document.getElementById('fsInput');
  const sqIn = document.getElementById('sqInput');
  const cVal = document.getElementById('cVal');
  const fsVal = document.getElementById('fsVal');
  const sqVal = document.getElementById('sqVal');
  const text1In = document.getElementById('text1Input');
  const text2In = document.getElementById('text2Input');
  const titleIn = document.getElementById('titleInput');
  const titleFsIn = document.getElementById('titleFsInput');
  const titleFsVal = document.getElementById('titleFsVal');
  const titleLhIn = document.getElementById('titleLhInput');
  const titleLhVal = document.getElementById('titleLhVal');
  const titleLsIn = document.getElementById('titleLsInput');
  const titleLsVal = document.getElementById('titleLsVal');
  const titleLsAuto = document.getElementById('titleLsAuto');
  const canvas = document.getElementById('canvas');
  const btn = document.getElementById('randomBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const imgFile = document.getElementById('imgFile');
  const fileName = document.getElementById('fileName');
  const clearImgBtn = document.getElementById('clearImgBtn');
  const fitSelect = document.getElementById('fitSelect');
  const scaleInput = document.getElementById('scaleInput');
  const scaleVal = document.getElementById('scaleVal');

  let W = +wIn.value, H = +hIn.value, COUNT = +cIn.value, FS = +fsIn.value;
  let SQ_USER = +sqIn.value;
  let TEXT1 = text1In.value, TEXT2 = text2In.value;
  let TITLE_TEXT = titleIn.value;
  let TITLE_FS = +titleFsIn.value;
  let TITLE_LH = +titleLhIn.value;
  let TITLE_LS = +titleLsIn.value; // percent
  let TITLE_LS_AUTO = titleLsAuto.checked;

  // Title position in pixels — user can drag; default 100, 100
  let titlePos = { x: 100, y: 100 };

  let IMG_SRC = null;
  let IMG_NATURAL = { w: 0, h: 0 };
  let FIT = fitSelect.value;
  let SCALE = +scaleInput.value;
  let seed = Date.now();

  let s1 = null;
  let s2 = null;
  let pat = null;
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
    let drawW, drawH;
    if (fit === 'fill') {
      drawW = W * scale; drawH = H * scale;
    } else if (fit === 'cover') {
      const r = Math.max(W / natW, H / natH) * scale;
      drawW = natW * r; drawH = natH * r;
    } else {
      const r = Math.min(W / natW, H / natH) * scale;
      drawW = natW * r; drawH = natH * r;
    }
    return { w: drawW, h: drawH };
  }

  function currentSquareSize() {
    const maxSq = Math.floor(Math.min(W, H) * 0.8);
    return Math.min(SQ_USER, maxSq);
  }

  function randomizeSpecials() {
    const sq = currentSquareSize();
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
    const sq = currentSquareSize();
    currentSq = sq;

    if (!s1 || !s2) randomizeSpecials();

    s1.x = clamp(s1.x, 0, W - sq);
    s1.y = clamp(s1.y, 0, H - sq);
    s2.x = clamp(s2.x, 0, W - sq);
    s2.y = clamp(s2.y, 0, H - sq);

    pat = textPosForDelta(s2.x - s1.x, s2.y - s1.y);

    const s2Rect = { x: s2.x, y: s2.y, w: sq, h: sq };
    const overlapsS2Cell = (c, r) => {
      const x = s1.x + c * sq;
      const y = s1.y + r * sq;
      return !(x + sq <= s2Rect.x || x >= s2Rect.x + s2Rect.w ||
               y + sq <= s2Rect.y || y >= s2Rect.y + s2Rect.h);
    };

    const occupied = new Set();
    const key = (c, r) => `${c},${r}`;
    occupied.add(key(0, 0));

    const filled = [];

    const firstCandidates = shuffle(diag.map(([dc, dr]) => ({ c: dc, r: dr })))
      .filter(p => !occupied.has(key(p.c, p.r)) && !overlapsS2Cell(p.c, p.r));

    if (firstCandidates.length > 0) {
      const first = firstCandidates[0];
      occupied.add(key(first.c, first.r));
      filled.push(first);
    }

    let attempts = 0;
    const maxAttempts = COUNT * 50;
    while (filled.length < COUNT && attempts < maxAttempts) {
      attempts++;
      const anchor = filled[Math.floor(rng() * filled.length)];
      const dir = pick(diag);
      const nc = anchor.c + dir[0];
      const nr = anchor.r + dir[1];
      if (occupied.has(key(nc, nr))) continue;
      if (overlapsS2Cell(nc, nr)) continue;
      occupied.add(key(nc, nr));
      filled.push({ c: nc, r: nr });
    }

    if (filled.length < COUNT) {
      const queue = filled.slice();
      while (filled.length < COUNT && queue.length > 0) {
        const anchor = queue.shift();
        const candidates = shuffle(diag.map(([dc, dr]) => ({ c: anchor.c + dc, r: anchor.r + dr })))
          .filter(p => !occupied.has(key(p.c, p.r)) && !overlapsS2Cell(p.c, p.r));
        for (const cand of candidates) {
          if (filled.length >= COUNT) break;
          occupied.add(key(cand.c, cand.r));
          filled.push(cand);
          queue.push(cand);
        }
      }
    }

    render(sq, filled);
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

    // Layer 1: filled squares
    filled.forEach(({ c, r }) => {
      const el = document.createElementNS(svgNS, 'rect');
      el.setAttribute('x', s1.x + c * sq);
      el.setAttribute('y', s1.y + r * sq);
      el.setAttribute('width', sq);
      el.setAttribute('height', sq);
      el.setAttribute('fill', '#0098B6');
      root.appendChild(el);
    });

    // Layer 2: image
    if (IMG_SRC && IMG_NATURAL.w > 0 && IMG_NATURAL.h > 0) {
      const size = computeImageSize(IMG_NATURAL.w, IMG_NATURAL.h, FIT, SCALE);
      if (!imgPos) imgPos = { x: (W - size.w) / 2, y: (H - size.h) / 2 };
      const imgEl = document.createElementNS(svgNS, 'image');
      imgEl.setAttribute('href', IMG_SRC);
      imgEl.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', IMG_SRC);
      imgEl.setAttribute('x', imgPos.x); imgEl.setAttribute('y', imgPos.y);
      imgEl.setAttribute('width', size.w); imgEl.setAttribute('height', size.h);
      imgEl.setAttribute('preserveAspectRatio', 'none');
      imgEl.classList.add('draggable');
      imgEl.dataset.role = 'image';
      root.appendChild(imgEl);
    }

    // Layer 3: outlined squares
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

    // Layer 4: TITLE — draggable, Inter Medium
    renderTitle(svgNS, root);

    svg.appendChild(root);
    const oldSvg = canvas.firstChild;
    if (oldSvg) canvas.replaceChild(svg, oldSvg);
    else canvas.appendChild(svg);
  }

  function renderTitle(svgNS, root) {
    if (!TITLE_TEXT.trim()) return;
    const lines = TITLE_TEXT.split('\n');
    const g = document.createElementNS(svgNS, 'g');
    g.classList.add('draggable');
    g.dataset.role = 'title';

    // letter-spacing in em = percent/100
    // SVG uses letter-spacing in user units. Convert: ls_units = TITLE_FS * (percent/100)
    const lsPx = TITLE_FS * (TITLE_LS / 100);

    // Compute bounding box for hit area: we'll create a transparent rect behind
    // Approximate width: widest line * FS * 0.55 (rough avg char width)
    let maxLineLen = 0;
    lines.forEach(ln => { if (ln.length > maxLineLen) maxLineLen = ln.length; });
    const approxW = Math.max(200, maxLineLen * TITLE_FS * 0.55);
    const approxH = lines.length * TITLE_LH;

    // Hit/bg rect (transparent) for dragging by any part of title area
    const hit = document.createElementNS(svgNS, 'rect');
    hit.setAttribute('x', titlePos.x);
    hit.setAttribute('y', titlePos.y - TITLE_FS * 0.9);
    hit.setAttribute('width', approxW);
    hit.setAttribute('height', approxH + TITLE_FS * 0.2);
    hit.setAttribute('fill', 'transparent');
    hit.setAttribute('pointer-events', 'all');
    g.appendChild(hit);

    lines.forEach((line, i) => {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', titlePos.x);
      // First baseline = titlePos.y + (line-height - font-size)/2 + font-size * 0.8 approx
      // Simpler: first baseline = titlePos.y + TITLE_FS * 0.82 (accounts for ascender)
      // Subsequent lines advance by TITLE_LH
      t.setAttribute('y', titlePos.y + TITLE_FS * 0.82 + i * TITLE_LH);
      t.setAttribute('text-anchor', 'start');
      t.setAttribute('fill', 'white');
      t.setAttribute('font-size', TITLE_FS);
      t.setAttribute('font-family', 'Inter, sans-serif');
      t.setAttribute('font-weight', '500');
      t.setAttribute('letter-spacing', lsPx);
      t.setAttribute('pointer-events', 'none');
      t.textContent = line;
      g.appendChild(t);
    });

    root.appendChild(g);
  }

  // ==== Drag ====
  let drag = null, rafScheduled = false, pendingEvent = null;
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
    const e = pendingEvent; pendingEvent = null;
    const pt = getSvgPointFromEvent(e); if (!pt) return;
    const sq = currentSq;
    if (drag.role === 's1') { s1.x = clamp(pt.x - drag.offsetX, 0, W - sq); s1.y = clamp(pt.y - drag.offsetY, 0, H - sq); generate(); }
    else if (drag.role === 's2') { s2.x = clamp(pt.x - drag.offsetX, 0, W - sq); s2.y = clamp(pt.y - drag.offsetY, 0, H - sq); generate(); }
    else if (drag.role === 'image') { imgPos = { x: pt.x - drag.offsetX, y: pt.y - drag.offsetY }; generate(); }
    else if (drag.role === 'title') { titlePos = { x: pt.x - drag.offsetX, y: pt.y - drag.offsetY }; generate(); }
  }
  canvas.addEventListener('pointerdown', (e) => {
    const target = e.target.closest('.draggable');
    if (!target) return;
    e.preventDefault();
    const pt = getSvgPointFromEvent(e); if (!pt) return;
    const role = target.dataset.role;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    if (role === 's1') drag = { role, pointerId: e.pointerId, offsetX: pt.x - s1.x, offsetY: pt.y - s1.y };
    else if (role === 's2') drag = { role, pointerId: e.pointerId, offsetX: pt.x - s2.x, offsetY: pt.y - s2.y };
    else if (role === 'image') drag = { role, pointerId: e.pointerId, offsetX: pt.x - imgPos.x, offsetY: pt.y - imgPos.y };
    else if (role === 'title') drag = { role, pointerId: e.pointerId, offsetX: pt.x - titlePos.x, offsetY: pt.y - titlePos.y };
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    pendingEvent = e;
    if (!rafScheduled) { rafScheduled = true; requestAnimationFrame(processPendingMove); }
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    drag = null; pendingEvent = null;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ==== Inputs ====
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

  sqIn.addEventListener('input', () => { SQ_USER = +sqIn.value; sqVal.textContent = SQ_USER + ' px'; generate(); });
  cIn.addEventListener('input', () => { COUNT = +cIn.value; cVal.textContent = COUNT; generate(); });
  fsIn.addEventListener('input', () => { FS = +fsIn.value; fsVal.textContent = FS + ' px'; generate(); });
  text1In.addEventListener('input', () => { TEXT1 = text1In.value; generate(); });
  text2In.addEventListener('input', () => { TEXT2 = text2In.value; generate(); });

  // Title controls
  titleIn.addEventListener('input', () => { TITLE_TEXT = titleIn.value; generate(); });
  titleFsIn.addEventListener('input', () => {
    TITLE_FS = +titleFsIn.value;
    titleFsVal.textContent = TITLE_FS + ' px';
    // If auto-linked, derive line-height from font size proportionally (default ratio 89/72 ≈ 1.236)
    if (TITLE_LS_AUTO) {
      // keep current line-height, don't auto-change; sync letter-spacing
      syncLetterSpacingFromLineHeight();
    }
    generate();
  });
  titleLhIn.addEventListener('input', () => {
    TITLE_LH = +titleLhIn.value;
    titleLhVal.textContent = TITLE_LH + ' px';
    if (TITLE_LS_AUTO) syncLetterSpacingFromLineHeight();
    generate();
  });
  titleLsIn.addEventListener('input', () => {
    TITLE_LS = +titleLsIn.value;
    titleLsVal.textContent = formatLs(TITLE_LS);
    // Manual edit unlinks from line-height
    if (TITLE_LS_AUTO) {
      TITLE_LS_AUTO = false;
      titleLsAuto.checked = false;
    }
    generate();
  });
  titleLsAuto.addEventListener('change', () => {
    TITLE_LS_AUTO = titleLsAuto.checked;
    if (TITLE_LS_AUTO) {
      syncLetterSpacingFromLineHeight();
      generate();
    }
  });

  function syncLetterSpacingFromLineHeight() {
    // Rule: letter-spacing (in %) scales linearly with line-height relative to a baseline.
    // Baseline: line-height 89 → letter-spacing −1%.
    // When user increases line-height, tracking opens up (less negative, trending toward 0 or positive).
    // Simple proportional mapping: ls% = -1 * (89 / lineHeight)
    // So at LH=89 → -1, at LH=178 → -0.5, at LH=44 → -2, etc.
    const ls = -1 * (89 / Math.max(1, TITLE_LH));
    TITLE_LS = Math.round(ls * 10) / 10;
    titleLsIn.value = TITLE_LS;
    titleLsVal.textContent = formatLs(TITLE_LS);
  }

  function formatLs(v) {
    const sign = v < 0 ? '−' : (v > 0 ? '+' : '');
    return sign + Math.abs(v).toFixed(1).replace(/\.0$/, '') + '%';
  }

  fitSelect.addEventListener('change', () => { FIT = fitSelect.value; imgPos = null; generate(); });
  scaleInput.addEventListener('input', () => { SCALE = +scaleInput.value; scaleVal.textContent = SCALE + ' %'; generate(); });

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
    fileName.textContent = 'Выбрать изображение…';
    imgPos = null;
    generate();
  });

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
    clone.querySelectorAll('.draggable, .dragging').forEach(el => el.classList.remove('draggable', 'dragging'));
    clone.querySelectorAll('[data-role]').forEach(el => el.removeAttribute('data-role'));

    const images = clone.querySelectorAll('image');
    images.forEach((img) => {
      const hrefData = img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
      if (hrefData.startsWith('data:')) {
        img.setAttribute('href', hrefData);
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', hrefData);
      }
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
  sqVal.textContent = SQ_USER + ' px';
  titleFsVal.textContent = TITLE_FS + ' px';
  titleLhVal.textContent = TITLE_LH + ' px';
  titleLsVal.textContent = formatLs(TITLE_LS);

  generate();
})();
