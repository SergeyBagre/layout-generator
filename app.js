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
  const alignSelect = document.getElementById('alignSelect');
  const scaleInput = document.getElementById('scaleInput');
  const scaleVal = document.getElementById('scaleVal');

  let W = +wIn.value, H = +hIn.value, COUNT = +cIn.value, FS = +fsIn.value;
  let TEXT1 = text1In.value, TEXT2 = text2In.value;
  let IMG_SRC = null;
  let IMG_NATURAL = { w: 0, h: 0 };
  let FIT = fitSelect.value;
  let ALIGN = alignSelect.value;
  let SCALE = +scaleInput.value;
  let seed = Date.now();

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

  function computeImageRect(halfX, halfY, halfW, halfH, natW, natH, fit, align, scalePct) {
    const scale = scalePct / 100;
    let drawW, drawH;
    if (fit === 'fill') {
      drawW = halfW * scale; drawH = halfH * scale;
    } else if (fit === 'contain') {
      const r = Math.min(halfW / natW, halfH / natH) * scale;
      drawW = natW * r; drawH = natH * r;
    } else {
      const r = Math.max(halfW / natW, halfH / natH) * scale;
      drawW = natW * r; drawH = natH * r;
    }
    let ax = 0.5, ay = 0.5;
    if (align.includes('left')) ax = 0;
    else if (align.includes('right')) ax = 1;
    if (align.includes('top')) ay = 0;
    else if (align.includes('bottom')) ay = 1;
    const x = halfX + (halfW - drawW) * ax;
    const y = halfY + (halfH - drawH) * ay;
    return { x, y, w: drawW, h: drawH };
  }

  function generate() {
    const portrait = H > W;
    const sq = portrait ? Math.floor(H / 5) : Math.floor(H / 3);

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

    const hasImg = !!IMG_SRC;
    const imgOnRight = !portrait;
    const imgOnBottom = portrait;

    const boundXMax = hasImg && imgOnRight ? Math.floor(W / 2) : W;
    const boundYMax = hasImg && imgOnBottom ? Math.floor(H / 2) : H;

    const s1xMin = Math.max(0, -dx);
    const s1xMax = Math.min(boundXMax - sq, boundXMax - sq - dx);
    const s1yMin = Math.max(0, -dy);
    const s1yMax = Math.min(boundYMax - sq, boundYMax - sq - dy);

    let s1x = Math.round(s1xMin + rng() * Math.max(0, s1xMax - s1xMin));
    let s1y = Math.round(s1yMin + rng() * Math.max(0, s1yMax - s1yMin));
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

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.display = 'block';
    svg.style.maxWidth = '100%';
    svg.style.height = 'auto';

    const defs = document.createElementNS(svgNS, 'defs');

    const vpClip = document.createElementNS(svgNS, 'clipPath');
    vpClip.setAttribute('id', 'vp');
    const vpRect = document.createElementNS(svgNS, 'rect');
    vpRect.setAttribute('x', 0); vpRect.setAttribute('y', 0);
    vpRect.setAttribute('width', W); vpRect.setAttribute('height', H);
    vpClip.appendChild(vpRect);
    defs.appendChild(vpClip);

    let imgClipX, imgClipY, imgClipW, imgClipH;
    if (hasImg) {
      if (imgOnRight) {
        imgClipX = Math.floor(W / 2); imgClipY = 0;
        imgClipW = W - imgClipX; imgClipH = H;
      } else {
        imgClipX = 0; imgClipY = Math.floor(H / 2);
        imgClipW = W; imgClipH = H - imgClipY;
      }
      const halfClip = document.createElementNS(svgNS, 'clipPath');
      halfClip.setAttribute('id', 'imgHalf');
      const halfRect = document.createElementNS(svgNS, 'rect');
      halfRect.setAttribute('x', imgClipX);
      halfRect.setAttribute('y', imgClipY);
      halfRect.setAttribute('width', imgClipW);
      halfRect.setAttribute('height', imgClipH);
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

    if (hasImg && IMG_NATURAL.w > 0 && IMG_NATURAL.h > 0) {
      const rect = computeImageRect(imgClipX, imgClipY, imgClipW, imgClipH, IMG_NATURAL.w, IMG_NATURAL.h, FIT, ALIGN, SCALE);
      const imgGroup = document.createElementNS(svgNS, 'g');
      imgGroup.setAttribute('clip-path', 'url(#imgHalf)');
      const imgEl = document.createElementNS(svgNS, 'image');
      imgEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', IMG_SRC);
      imgEl.setAttribute('href', IMG_SRC);
      imgEl.setAttribute('x', rect.x);
      imgEl.setAttribute('y', rect.y);
      imgEl.setAttribute('width', rect.w);
      imgEl.setAttribute('height', rect.h);
      imgEl.setAttribute('preserveAspectRatio', 'none');
      imgGroup.appendChild(imgEl);
      root.appendChild(imgGroup);
    }

    const makeFilledRect = (col, row) => {
      const el = document.createElementNS(svgNS, 'rect');
      el.setAttribute('x', s1x + col * sq);
      el.setAttribute('y', s1y + row * sq);
      el.setAttribute('width', sq);
      el.setAttribute('height', sq);
      el.setAttribute('fill', '#0098B6');
      return el;
    };

    const makeOutlinedRect = (x, y) => {
      const el = document.createElementNS(svgNS, 'rect');
      el.setAttribute('x', x); el.setAttribute('y', y);
      el.setAttribute('width', sq); el.setAttribute('height', sq);
      el.setAttribute('fill', 'transparent');
      el.setAttribute('stroke', 'white');
      el.setAttribute('stroke-width', 1);
      return el;
    };

    const makeLabel = (x, y, lines, position) => {
      const g = document.createElementNS(svgNS, 'g');
      const fs = FS;
      const lineH = fs * 1.45;
      const margin = Math.max(8, sq * 0.06);
      let tx, ty, anchor;
      const totalH = lines.length * lineH;
      switch (position) {
        case 'top-left': tx = x + margin; ty = y + margin + fs * 0.9; anchor = 'start'; break;
        case 'top-right': tx = x + sq - margin; ty = y + margin + fs * 0.9; anchor = 'end'; break;
        case 'bottom-left': tx = x + margin; ty = y + sq - totalH - margin + fs * 0.9; anchor = 'start'; break;
        case 'bottom-right': tx = x + sq - margin; ty = y + sq - totalH - margin + fs * 0.9; anchor = 'end'; break;
        default: tx = x + sq / 2; ty = y + (sq - totalH) / 2 + fs * 0.9; anchor = 'middle';
      }
      lines.forEach((line, i) => {
        const t = document.createElementNS(svgNS, 'text');
        t.setAttribute('x', tx); t.setAttribute('y', ty + i * lineH);
        t.setAttribute('text-anchor', anchor); t.setAttribute('fill', 'white');
        t.setAttribute('font-size', fs); t.setAttribute('font-family', 'Inter, sans-serif');
        t.setAttribute('font-weight', '400'); t.textContent = line;
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
      allEls.push({ el: rect });
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
      allEls.push({ el: rect });
      const txt = makeLabel(x, y, lines, textPos);
      txt.style.opacity = 0;
      txt.style.transition = `opacity 0.3s ease ${delay + 80}ms`;
      root.appendChild(txt);
      allEls.push({ el: txt });
    });

    svg.appendChild(root);
    canvas.appendChild(svg);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      allEls.forEach(({ el }) => { el.style.opacity = 1; });
    }));
  }

  const handleNumberInput = (input, min, max, setter) => {
    const apply = () => {
      let v = parseInt(input.value, 10);
      if (isNaN(v)) v = min;
      v = clamp(v, min, max);
      input.value = v;
      setter(v);
      generate();
    };
    input.addEventListener('change', apply);
    input.addEventListener('blur', apply);
  };

  handleNumberInput(wIn, 400, 1920, (v) => { W = v; });
  handleNumberInput(hIn, 200, 1920, (v) => { H = v; });

  cIn.addEventListener('input', () => { COUNT = +cIn.value; cVal.textContent = COUNT; generate(); });

  let lastSeed = seed;
  const rerender = () => { seed = lastSeed; generate(); };
  fsIn.addEventListener('input', () => { FS = +fsIn.value; fsVal.textContent = FS + ' px'; rerender(); });
  text1In.addEventListener('input', () => { TEXT1 = text1In.value; rerender(); });
  text2In.addEventListener('input', () => { TEXT2 = text2In.value; rerender(); });

  fitSelect.addEventListener('change', () => { FIT = fitSelect.value; rerender(); });
  alignSelect.addEventListener('change', () => { ALIGN = alignSelect.value; rerender(); });
  scaleInput.addEventListener('input', () => { SCALE = +scaleInput.value; scaleVal.textContent = SCALE + ' %'; rerender(); });

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
    generate();
  });

  btn.addEventListener('click', () => {
    seed = Date.now() + Math.floor(Math.random() * 999999);
    lastSeed = seed;
    generate();
  });

  downloadBtn.addEventListener('click', () => {
    const svg = canvas.querySelector('svg');
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
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
  lastSeed = seed;
  generate();
})();
