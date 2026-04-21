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
  const canvas = document.getElementById('canvas');
  const downloadBtn = document.getElementById('downloadBtn');
  const exportJpgBtn = document.getElementById('exportJpgBtn');
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

  // Fixed letter-spacing: -1%
  const TITLE_LS_PERCENT = -1;

  // Line-height linked to font size. Rule: at FS=97 → LH=89 (ratio ≈ 0.918).
  // Use the same ratio for all sizes, clamped to readable range [1.0, 1.4].
  function titleLineHeight(fs) {
    const ratio = 89 / 97; // ≈ 0.9175
    const rawLh = fs * ratio;
    const minLh = fs * 0.88;
    const maxLh = fs * 1.05;
    return Math.round(Math.max(minLh, Math.min(maxLh, rawLh)));
  }

  let titlePos = { x: 100, y: 100 };

  let IMG_SRC = null;
  let IMG_NATURAL = { w: 0, h: 0 };
  let FIT = fitSelect.value;
  let SCALE = +scaleInput.value;
  let seed = Date.now();

  let s1 = null, s2 = null, pat = null, imgPos = null;
  let currentSq = 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function rng() { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; }
  function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }

  const diag = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const offsetPatterns = [
    { dx: 1, dy: 1, text1: 'top-right', text2: 'bottom-left' },
    { dx: -1, dy: 1, text1: 'top-left', text2: 'bottom-right' },
    { dx: 1, dy: -1, text1: 'bottom-right', text2: 'top-left' },
    { dx: -1, dy: -1, text1: 'bottom-left', text2: 'top-right' },
  ];
  function textPosForDelta(dx, dy) {
    const sx = Math.sign(dx) || 1, sy = Math.sign(dy) || 1;
    return offsetPatterns.find(p => p.dx === sx && p.dy === sy) || offsetPatterns[0];
  }

  function computeImageSize(natW, natH, fit, scalePct) {
    const scale = scalePct / 100;
    let drawW, drawH;
    if (fit === 'fill') { drawW = W * scale; drawH = H * scale; }
    else if (fit === 'cover') { const r = Math.max(W / natW, H / natH) * scale; drawW = natW * r; drawH = natH * r; }
    else { const r = Math.min(W / natW, H / natH) * scale; drawW = natW * r; drawH = natH * r; }
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
    const dx = chosenPat.dx * offsetDist, dy = chosenPat.dy * offsetDist;
    const s1xMin = Math.max(0, -dx), s1xMax = Math.min(W - sq, W - sq - dx);
    const s1yMin = Math.max(0, -dy), s1yMax = Math.min(H - sq, H - sq - dy);
    const s1x = Math.round(s1xMin + rng() * Math.max(0, s1xMax - s1xMin));
    const s1y = Math.round(s1yMin + rng() * Math.max(0, s1yMax - s1yMin));
    s1 = { x: s1x, y: s1y };
    s2 = { x: Math.round(s1x + dx), y: Math.round(s1y + dy) };
    pat = chosenPat;
  }

  let lastFilled = [];

  function generate() {
    const sq = currentSquareSize();
    currentSq = sq;
    if (!s1 || !s2) randomizeSpecials();
    s1.x = clamp(s1.x, 0, W - sq); s1.y = clamp(s1.y, 0, H - sq);
    s2.x = clamp(s2.x, 0, W - sq); s2.y = clamp(s2.y, 0, H - sq);
    pat = textPosForDelta(s2.x - s1.x, s2.y - s1.y);

    const s2Rect = { x: s2.x, y: s2.y, w: sq, h: sq };
    const overlapsS2Cell = (c, r) => {
      const x = s1.x + c * sq, y = s1.y + r * sq;
      return !(x + sq <= s2Rect.x || x >= s2Rect.x + s2Rect.w || y + sq <= s2Rect.y || y >= s2Rect.y + s2Rect.h);
    };

    const occupied = new Set();
    const key = (c, r) => `${c},${r}`;
    occupied.add(key(0, 0));
    const filled = [];

    // s2's approximate grid position for seeding chain from s2 corner
    const s2GC = Math.round((s2.x - s1.x) / sq);
    const s2GR = Math.round((s2.y - s1.y) / sq);

    // Choose randomly: grow from s1 corner or s2 corner
    const useS2Seed = rng() > 0.5;
    const seedC = useS2Seed ? s2GC : 0;
    const seedR = useS2Seed ? s2GR : 0;

    const firstCandidates = shuffle(diag.map(([dc, dr]) => ({ c: seedC + dc, r: seedR + dr })))
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
      const nc = anchor.c + dir[0], nr = anchor.r + dir[1];
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
    lastFilled = filled;
    render(sq, filled);
  }

  function redraw() {
    const sq = currentSquareSize();
    currentSq = sq;
    if (!s1 || !s2 || lastFilled.length === 0) { generate(); return; }
    s1.x = clamp(s1.x, 0, W - sq); s1.y = clamp(s1.y, 0, H - sq);
    s2.x = clamp(s2.x, 0, W - sq); s2.y = clamp(s2.y, 0, H - sq);
    pat = textPosForDelta(s2.x - s1.x, s2.y - s1.y);
    render(sq, lastFilled);
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

    filled.forEach(({ c, r }) => {
      const el = document.createElementNS(svgNS, 'rect');
      el.setAttribute('x', s1.x + c * sq);
      el.setAttribute('y', s1.y + r * sq);
      el.setAttribute('width', sq);
      el.setAttribute('height', sq);
      el.setAttribute('fill', '#0098B6');
      root.appendChild(el);
    });

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

    const specialDefs = [
      { sp: s1, lines: TEXT1.split('\n'), textPos: pat.text1, role: 's1', isFirst: true },
      { sp: s2, lines: TEXT2.split('\n'), textPos: pat.text2, role: 's2', isFirst: false }
    ];
    specialDefs.forEach(({ sp, lines, textPos, role, isFirst }) => {
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

      // Random button INSIDE square 1 (lives with it, gets omitted on export)
      if (isFirst) {
        const btnSize = Math.max(28, Math.min(48, sq * 0.22));
        const bx = sp.x + sq / 2;
        const by = sp.y + sq / 2;
        const btnG = document.createElementNS(svgNS, 'g');
        btnG.classList.add('random-btn');
        btnG.dataset.export = 'skip';
        btnG.setAttribute('transform', `translate(${bx}, ${by})`);
        const bg = document.createElementNS(svgNS, 'circle');
        bg.setAttribute('cx', 0);
        bg.setAttribute('cy', 0);
        bg.setAttribute('r', btnSize / 2);
        bg.setAttribute('fill', 'rgba(0, 0, 0, 0.35)');
        btnG.appendChild(bg);
        // Shuffle/random arrows icon
        const iconSize = btnSize * 0.42;
        const icon = document.createElementNS(svgNS, 'path');
        // Two arrows looping — scaled to iconSize
        const s = iconSize / 16;
        icon.setAttribute('d', `M ${-7*s} ${-3*s} L ${5*s} ${-3*s} M ${2*s} ${-6*s} L ${5*s} ${-3*s} L ${2*s} ${0*s} M ${7*s} ${3*s} L ${-5*s} ${3*s} M ${-2*s} ${0*s} L ${-5*s} ${3*s} L ${-2*s} ${6*s}`);
        icon.setAttribute('stroke', 'white');
        icon.setAttribute('stroke-width', 1.4);
        icon.setAttribute('stroke-linecap', 'round');
        icon.setAttribute('stroke-linejoin', 'round');
        icon.setAttribute('fill', 'none');
        icon.setAttribute('pointer-events', 'none');
        btnG.appendChild(icon);
        btnG.style.cursor = 'pointer';
        root.appendChild(btnG);
      }
    });

    // Title
    if (TITLE_TEXT.trim()) {
      const lines = TITLE_TEXT.split('\n');
      const g = document.createElementNS(svgNS, 'g');
      // Title is NOT draggable
      g.dataset.role = 'title';
      const lsPx = TITLE_FS * (TITLE_LS_PERCENT / 100);
      const lh = titleLineHeight(TITLE_FS);
      lines.forEach((line, i) => {
        const t = document.createElementNS(svgNS, 'text');
        t.setAttribute('x', titlePos.x);
        t.setAttribute('y', titlePos.y + TITLE_FS * 0.82 + i * lh);
        t.setAttribute('text-anchor', 'start');
        t.setAttribute('fill', 'white');
        t.setAttribute('font-size', TITLE_FS);
        t.setAttribute('font-family', 'Inter, sans-serif');
        t.setAttribute('font-weight', '600');
        t.setAttribute('letter-spacing', lsPx);
        t.setAttribute('pointer-events', 'none');
        t.textContent = line;
        g.appendChild(t);
      });
      root.appendChild(g);
    }

    svg.appendChild(root);
    const oldSvg = canvas.firstChild;
    if (oldSvg) canvas.replaceChild(svg, oldSvg);
    else canvas.appendChild(svg);
  }

  // Drag
  let drag = null, rafScheduled = false, pendingEvent = null;
  function getSvgPointFromEvent(evt) {
    const svg = canvas.querySelector('svg'); if (!svg) return null;
    const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
    const ctm = svg.getScreenCTM(); if (!ctm) return null;
    const res = pt.matrixTransform(ctm.inverse());
    return { x: res.x, y: res.y };
  }
  function processPendingMove() {
    rafScheduled = false;
    if (!drag || !pendingEvent) return;
    const e = pendingEvent; pendingEvent = null;
    const pt = getSvgPointFromEvent(e); if (!pt) return;
    const sq = currentSq;
    if (drag.role === 's1') { s1.x = clamp(pt.x - drag.offsetX, 0, W - sq); s1.y = clamp(pt.y - drag.offsetY, 0, H - sq); drag.moved = true; redraw(); }
    else if (drag.role === 's2') { s2.x = clamp(pt.x - drag.offsetX, 0, W - sq); s2.y = clamp(pt.y - drag.offsetY, 0, H - sq); drag.moved = true; redraw(); }
    else if (drag.role === 'image') { imgPos = { x: pt.x - drag.offsetX, y: pt.y - drag.offsetY }; drag.moved = true; redraw(); }
    else if (drag.role === 'title') { titlePos = { x: pt.x - drag.offsetX, y: pt.y - drag.offsetY }; drag.moved = true; redraw(); }
  }
  canvas.addEventListener('pointerdown', (e) => {
    // Random button has priority
    const randomTarget = e.target.closest('.random-btn');
    if (randomTarget) {
      e.preventDefault();
      e.stopPropagation();
      seed = Date.now() + Math.floor(Math.random() * 999999);
      generate();
      return;
    }
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

  // Collapsible panels
  document.querySelectorAll('.panel').forEach(panel => {
    const header = panel.querySelector('.panel-header');
    header.addEventListener('click', () => {
      panel.classList.toggle('open');
    });
  });
  // Open first panel by default
  const firstPanel = document.querySelector('.panel');
  if (firstPanel) firstPanel.classList.add('open');

  // Inline edit for .val.editable values
  document.querySelectorAll('.val.editable').forEach(val => {
    val.addEventListener('click', () => {
      const targetId = val.dataset.target;
      const target = document.getElementById(targetId);
      if (!target) return;
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'val-input';
      input.value = target.value;
      input.min = target.min;
      input.max = target.max;
      input.step = target.step || 1;
      val.replaceWith(input);
      input.focus();
      input.select();
      const finish = () => {
        let v = parseFloat(input.value);
        if (isNaN(v)) v = parseFloat(target.value);
        v = Math.max(+target.min, Math.min(+target.max, v));
        target.value = v;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        input.replaceWith(val);
      };
      input.addEventListener('blur', finish);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        else if (e.key === 'Escape') { input.value = target.value; input.blur(); }
      });
    });
  });

  const handleNumberInput = (input, min, max, setter) => {
    const apply = () => {
      let v = parseInt(input.value, 10);
      if (isNaN(v)) v = min;
      v = clamp(v, min, max);
      input.value = v; setter(v);
      s1 = null; s2 = null;
      imgPos = null;
      generate();
    };
    input.addEventListener('change', apply);
    input.addEventListener('blur', apply);
  };
  handleNumberInput(wIn, 300, 1920, (v) => { W = v; });
  handleNumberInput(hIn, 300, 1080, (v) => { H = v; });

  sqIn.addEventListener('input', () => { SQ_USER = +sqIn.value; sqVal.textContent = SQ_USER + ' px'; generate(); });
  cIn.addEventListener('input', () => { COUNT = +cIn.value; cVal.textContent = COUNT; generate(); });
  fsIn.addEventListener('input', () => { FS = +fsIn.value; fsVal.textContent = FS + ' px'; redraw(); });
  text1In.addEventListener('input', () => { TEXT1 = text1In.value; redraw(); });
  text2In.addEventListener('input', () => { TEXT2 = text2In.value; redraw(); });

  titleIn.addEventListener('input', () => { TITLE_TEXT = titleIn.value; redraw(); });
  titleFsIn.addEventListener('input', () => { TITLE_FS = +titleFsIn.value; titleFsVal.textContent = TITLE_FS + ' px'; redraw(); });

  fitSelect.addEventListener('change', () => { FIT = fitSelect.value; imgPos = null; redraw(); });
  scaleInput.addEventListener('input', () => { SCALE = +scaleInput.value; scaleVal.textContent = SCALE + ' %'; redraw(); });

  imgFile.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    fileName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => {
      IMG_SRC = ev.target.result;
      const tmp = new Image();
      tmp.onload = () => { IMG_NATURAL = { w: tmp.naturalWidth, h: tmp.naturalHeight }; imgPos = null; redraw(); };
      tmp.src = IMG_SRC;
    };
    reader.readAsDataURL(file);
  });
  clearImgBtn.addEventListener('click', () => {
    IMG_SRC = null; IMG_NATURAL = { w: 0, h: 0 };
    imgFile.value = ''; fileName.textContent = 'Выбрать изображение…';
    imgPos = null; redraw();
  });

  function buildCleanSvgString() {
    const svg = canvas.querySelector('svg');
    if (!svg) return null;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    // Remove random button and any data-export="skip" elements
    clone.querySelectorAll('[data-export="skip"]').forEach(el => el.remove());
    clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
    clone.querySelectorAll('.draggable, .dragging, .random-btn').forEach(el => {
      el.classList.remove('draggable', 'dragging', 'random-btn');
    });
    clone.querySelectorAll('[data-role], [data-export]').forEach(el => {
      el.removeAttribute('data-role');
      el.removeAttribute('data-export');
    });
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
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  }

  downloadBtn.addEventListener('click', () => {
    const svgStr = buildCleanSvgString();
    if (!svgStr) return;
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layout-${W}x${H}-${Date.now()}.svg`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  exportJpgBtn.addEventListener('click', async () => {
    const svgStr = buildCleanSvgString();
    if (!svgStr) return;
    // Inline Inter font fetch would be complex; rely on system Inter or fallback.
    // Strip @import from inline style (canvas loader won't wait for it anyway)
    const cleanStr = svgStr.replace(/@import[^;]+;/g, '');
    const svgBlob = new Blob([cleanStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      const cnv = document.createElement('canvas');
      cnv.width = W;
      cnv.height = H;
      const ctx = cnv.getContext('2d');
      ctx.fillStyle = '#A4BECA';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      cnv.toBlob((blob) => {
        if (!blob) return;
        const jpgUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = jpgUrl;
        a.download = `layout-${W}x${H}-${Date.now()}.jpg`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(jpgUrl);
      }, 'image/jpeg', 1.0);
    } catch (err) {
      console.error('JPG export failed:', err);
      alert('Не удалось экспортировать в JPG.');
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  fsVal.textContent = FS + ' px';
  cVal.textContent = COUNT;
  scaleVal.textContent = SCALE + ' %';
  sqVal.textContent = SQ_USER + ' px';
  titleFsVal.textContent = TITLE_FS + ' px';
  generate();
})();
