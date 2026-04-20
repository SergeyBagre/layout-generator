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

  let W = +wIn.value, H = +hIn.value, COUNT = +cIn.value, FS = +fsIn.value;
  let TEXT1 = text1In.value, TEXT2 = text2In.value;
  let IMG_SRC = null;
  let IMG_NATURAL = { w: 0, h: 0 };
  let FIT = fitSelect.value;
  let SCALE = +scaleInput.value;
  let seed = Date.now();

  // Manual overrides (set when user drags)
  let s1 = null;      // { x, y } in pixels
  let s2 = null;      // { x, y } in pixels
  let pat = null;     // the offset pattern used for text alignment
  let imgOffset = { x: 0, y: 0 };  // pixel offset applied on top of auto-align

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
    const ptn = offsetPatterns.find(p => p.dx === sx && p.dy === sy);
    return ptn || offsetPatterns[0];
  }

  function computeImageRect(regionX, regionY, regionW, regionH, natW, natH, fit, scalePct, offset) {
    const scale = scalePct / 100;
    let drawW, drawH;
    if (fit === 'fill') {
      drawW = regionW * scale; drawH = regionH * scale;
    } else if (fit === 'contain') {
      const r = Math.min(regionW / natW, regionH / natH) * scale;
      drawW = natW * r; drawH = natH * r;
    } else {
      const r = Math.max(regionW / natW, regionH / natH) * scale;
      drawW = natW * r; drawH = natH * r;
    }
    // Default centering + user offset
    const x = regionX + (regionW - drawW) / 2 + offset.x;
    const y = regionY + (regionH - drawH) / 2 + offset.y;
    return { x, y, w: drawW, h: drawH };
  }

  function randomizeLayout() {
    const portrait = H > W;
    const sq = portrait ? Math.floor(H / 5) : Math.floor(H / 3);

    const overlapRatio = 0.4 + rng() * 0.2;
    const offsetDist = sq * (1 - overlapRatio);
    const chosenPat = pick(offsetPatterns);
    const dx = chosenPat.dx * offsetDist;
    const dy = chosenPat.dy * offsetDist;

    const hasImg = !!IMG_SRC;
    const boundXMax = hasImg && !portrait ? Math.floor(W / 2) : W;
    const boundYMax = hasImg && portrait ? Math.floor(H / 2) : H;

    const s1xMin = Math.max(0, -dx);
    const s1xMax = Math.min(boundXMax - sq, boundXMax - sq - dx);
    const s1yMin = Math.max(0, -dy);
    const s1yMax = Math.min(boundYMax - sq, boundYMax - sq - dy);

    const s1x = Math.round(s1xMin + rng() * Math.max(0, s1xMax - s1xMin));
    const s1y = Math.round(s1yMin + rng() * Math.max(0, s1yMax - s1yMin));
    const s2x = Math.round(s1x + dx);
    const s2y = Math.round(s1y + dy);

    s1 = { x: s1x, y: s1y };
    s2 = { x: s2x, y: s2y };
    pat = chosenPat;
  }

  function generate() {
    const portrait = H > W;
    const sq = portrait ? Math.floor(H / 5) : Math.floor(H / 3);

    // If no layout yet, randomize once
    if (!s1 || !s2) randomizeLayout();

    // Clamp s1 and s2 to canvas
    s1.x = clamp(s1.x, 0, W - sq);
    s1.y = clamp(s1.y, 0, H - sq);
    s2.x = clamp(s2.x, 0, W - sq);
    s2.y = clamp(s2.y, 0, H - sq);

    // Update text positions based on current offset direction
    pat = textPosForDelta(s2.x - s1.x, s2.y - s1.y);

    // Filled squares: anchored to s1, grid-aligned in units of sq
    // Chain starts at s1 corner, walks toward s2 corner, continues beyond
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
  }

  function render(sq, filled) {
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    canvas.innerHTML = '';

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

    const hasImg = !!IMG_SRC;
    const portrait = H > W;
    let imgRegionX, imgRegionY, imgRegionW, imgRegionH;
    if (hasImg) {
      if (!portrait) {
        imgRegionX = Math.floor(W / 2); imgRegionY = 0;
        imgRegionW = W - imgRegionX; imgRegionH = H;
      } else {
        imgRegionX = 0; imgRegionY = Math.floor(H / 2);
        imgRegionW = W; imgRegionH = H - imgRegionY;
      }
      const halfClip = document.createElementNS(svgNS, 'clipPath');
      halfClip.setAttribute('id', 'imgHalf');
      const halfRect = document.createElementNS(svgNS, 'rect');
      halfRect.setAttribute('x', imgRegionX); halfRect.setAttribute('y', imgRegionY);
      halfRect.setAttribute('width', imgRegionW); halfRect.setAttribute('height', imgRegionH);
      halfClip.appendChild(halfRect);
      defs.appendChild(halfClip);
    }

    svg.appendChild(defs);

    const root = document.createElementNS(svgNS, 'g');
    root.setAttribute('clip-path', 'url(#vp)');

    const bgRect = document.createElementNS(svgNS, 'rect');
    bgRect.setAttribute('x', 0); bgRect.setAttribute('y', 0);
    bgRect.setAttribute('width', W); bgRect.setAttribute('height', H);
    bgRect.setAttribute('fill', '#A4BECA');
    root.appendChild(bgRect);

    // LAYER 1: Filled squares (below image)
    filled.forEach(({ c, r }) => {
      const el = document.createElementNS(svgNS, 'rect');
      el.setAttribute('x', s1.x + c * sq);
      el.setAttribute('y', s1.y + r * sq);
      el.setAttribute('width', sq);
      el.setAttribute('height', sq);
      el.setAttribute('fill', '#0098B6');
      root.appendChild(el);
    });

    // LAYER 2: Image (above filled squares)
    let imgEl = null;
    if (hasImg && IMG_NATURAL.w > 0 && IMG_NATURAL.h > 0) {
      const rect = computeImageRect(imgRegionX, imgRegionY, imgRegionW, imgRegionH, IMG_NATURAL.w, IMG_NATURAL.h, FIT, SCALE, imgOffset);
      const imgGroup = document.createElementNS(svgNS, 'g');
      imgGroup.setAttribute('clip-path', 'url(#imgHalf)');
      imgEl = document.createElementNS(svgNS, 'image');
      imgEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', IMG_SRC);
      imgEl.setAttribute('href', IMG_SRC);
      imgEl.setAttribute('x', rect.x);
      imgEl.setAttribute('y', rect.y);
      imgEl.setAttribute('width', rect.w);
      imgEl.setAttribute('height', rect.h);
      imgEl.setAttribute('preserveAspectRatio', 'none');
      imgEl.classList.add('draggable');
      imgEl.dataset.role = 'image';
      imgEl.style.cursor = 'grab';
      imgGroup.appendChild(imgEl);
      root.appendChild(imgGroup);
    }

    // LAYER 3: Outlined squares (above image) — draggable
    const specialDefs = [
      { sp: s1, lines: TEXT1.split('\n'), textPos: pat.text1, role: 's1' },
      { sp: s2, lines: TEXT2.split('\n'), textPos: pat.text2, role: 's2' }
    ];

    specialDefs.forEach(({ sp, lines, textPos, role }) => {
      const g = document.createElementNS(svgNS, 'g');
      g.classList.add('draggable');
      g.dataset.role = role;
      g.style.cursor = 'grab';

      // Outlined rect
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', sp.x);
      rect.setAttribute('y', sp.y);
      rect.setAttribute('width', sq);
      rect.setAttribute('height', sq);
      rect.setAttribute('fill', 'transparent');
      rect.setAttribute('stroke', 'white');
      rect.setAttribute('stroke-width', 1);
      g.appendChild(rect);

      // Invisible wider hit area for easier grabbing
      const hit = document.createElementNS(svgNS, 'rect');
      hit.setAttribute('x', sp.x);
      hit.setAttribute('y', sp.y);
      hit.setAttribute('width', sq);
      hit.setAttribute('height', sq);
      hit.setAttribute('fill', 'transparent');
      hit.setAttribute('pointer-events', 'all');
      g.appendChild(hit);

      // Text
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
    canvas.appendChild(svg);

    attachDragHandlers(svg, sq, imgRegionX, imgRegionY, imgRegionW, imgRegionH);
  }

  function attachDragHandlers(svg, sq, imgRegionX, imgRegionY, imgRegionW, imgRegionH) {
    const getSvgPoint = (evt) => {
      const pt = svg.createSVGPoint();
      pt.x = evt.clientX; pt.y = evt.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      const inv = ctm.inverse();
      const res = pt.matrixTransform(inv);
      return { x: res.x, y: res.y };
    };

    let dragState = null;

    const onPointerDown = (e) => {
      const target = e.target.closest('.draggable');
      if (!target) return;
      e.preventDefault();
      target.setPointerCapture(e.pointerId);
      target.classList.add('dragging');
      const pt = getSvgPoint(e);
      const role = target.dataset.role;

      if (role === 's1') {
        dragState = { role, offsetX: pt.x - s1.x, offsetY: pt.y - s1.y, target };
      } else if (role === 's2') {
        dragState = { role, offsetX: pt.x - s2.x, offsetY: pt.y - s2.y, target };
      } else if (role === 'image') {
        dragState = { role, startPt: pt, startOffset: { x: imgOffset.x, y: imgOffset.y }, target };
      }
    };

    const onPointerMove = (e) => {
      if (!dragState) return;
      e.preventDefault();
      const pt = getSvgPoint(e);

      if (dragState.role === 's1') {
        s1.x = clamp(pt.x - dragState.offsetX, 0, W - sq);
        s1.y = clamp(pt.y - dragState.offsetY, 0, H - sq);
        generate();
      } else if (dragState.role === 's2') {
        s2.x = clamp(pt.x - dragState.offsetX, 0, W - sq);
        s2.y = clamp(pt.y - dragState.offsetY, 0, H - sq);
        generate();
      } else if (dragState.role === 'image') {
        imgOffset.x = dragState.startOffset.x + (pt.x - dragState.startPt.x);
        imgOffset.y = dragState.startOffset.y + (pt.y - dragState.startPt.y);
        generate();
      }
    };

    const onPointerUp = (e) => {
      if (dragState && dragState.target) {
        try { dragState.target.releasePointerCapture(e.pointerId); } catch (_) {}
        dragState.target.classList.remove('dragging');
      }
      dragState = null;
    };

    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', onPointerUp);
  }

  const handleNumberInput = (input, min, max, setter) => {
    const apply = () => {
      let v = parseInt(input.value, 10);
      if (isNaN(v)) v = min;
      v = clamp(v, min, max);
      input.value = v;
      setter(v);
      s1 = null; s2 = null; // re-randomize on canvas size change
      imgOffset = { x: 0, y: 0 };
      generate();
    };
    input.addEventListener('change', apply);
    input.addEventListener('blur', apply);
  };

  handleNumberInput(wIn, 400, 1920, (v) => { W = v; });
  handleNumberInput(hIn, 200, 1920, (v) => { H = v; });

  cIn.addEventListener('input', () => {
    COUNT = +cIn.value;
    cVal.textContent = COUNT;
    generate();
  });

  fsIn.addEventListener('input', () => {
    FS = +fsIn.value;
    fsVal.textContent = FS + ' px';
    generate();
  });
  text1In.addEventListener('input', () => { TEXT1 = text1In.value; generate(); });
  text2In.addEventListener('input', () => { TEXT2 = text2In.value; generate(); });

  fitSelect.addEventListener('change', () => {
    FIT = fitSelect.value;
    imgOffset = { x: 0, y: 0 };
    generate();
  });
  scaleInput.addEventListener('input', () => {
    SCALE = +scaleInput.value;
    scaleVal.textContent = SCALE + ' %';
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
        imgOffset = { x: 0, y: 0 };
        s1 = null; s2 = null;
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
    imgOffset = { x: 0, y: 0 };
    s1 = null; s2 = null;
    generate();
  });

  btn.addEventListener('click', () => {
    seed = Date.now() + Math.floor(Math.random() * 999999);
    s1 = null; s2 = null;
    imgOffset = { x: 0, y: 0 };
    generate();
  });

  downloadBtn.addEventListener('click', () => {
    const svg = canvas.querySelector('svg');
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    // Remove interactive classes/attributes from export
    clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
    clone.querySelectorAll('.draggable, .dragging').forEach(el => {
      el.classList.remove('draggable', 'dragging');
    });
    clone.querySelectorAll('[data-role]').forEach(el => el.removeAttribute('data-role'));
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
