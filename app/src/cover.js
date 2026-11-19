// Vice Cover Studio — the cover rendering engine.
// Draws a GTA 6-style multi-panel cover onto a canvas: photos in panels,
// a warm sunset or neon grade, palm silhouettes, and bold caption lettering.
// Pure canvas, no network, no libraries.

export const LAYOUTS = {
  trio: {
    label: 'Sunset Trio',
    panels: [
      { x: 0, y: 0, w: 0.58, h: 1 },
      { x: 0.58, y: 0, w: 0.42, h: 0.5 },
      { x: 0.58, y: 0.5, w: 0.42, h: 0.5 },
    ],
  },
  grid: {
    label: 'Vice Grid',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  duo: {
    label: 'Split Duo',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  full: {
    label: 'Full Bleed',
    panels: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
};

export const GRADES = ['sunset', 'neon', 'noir', 'natural'];

export const EXPORT_SIZES = {
  '1080x1080': { w: 1080, h: 1080 },
  '1080x1350': { w: 1080, h: 1350 },
  '1920x1080': { w: 1920, h: 1080 },
};

export function createState() {
  return {
    layout: 'trio',
    caption: 'VICE CITY NIGHTS',
    subCaption: 'A STORY IN EVERY PANEL',
    captionSize: 110,
    panels: [
      { photo: null, zoom: 1.15, panX: 0, panY: 0, grade: 'sunset' },
      { photo: null, zoom: 1.15, panX: 0, panY: 0, grade: 'sunset' },
      { photo: null, zoom: 1.15, panX: 0, panY: 0, grade: 'neon' },
      { photo: null, zoom: 1.15, panX: 0, panY: 0, grade: 'sunset' },
    ],
  };
}

// Small deterministic PRNG so the grain looks the same on every render.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load image: ' + src));
    img.src = src;
  });
}

function panelRect(def, width, height) {
  return {
    x: def.x * width,
    y: def.y * height,
    w: def.w * width,
    h: def.h * height,
  };
}

// Draw one photo into a panel, cover-fit, with the panel's zoom and pan.
function drawPanelPhoto(ctx, img, rect, panel) {
  const gap = Math.max(2, Math.round(rect.w * 0.006));
  const inner = {
    x: rect.x + gap,
    y: rect.y + gap,
    w: rect.w - gap * 2,
    h: rect.h - gap * 2,
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.x, inner.y, inner.w, inner.h);
  ctx.clip();
  if (img) {
    const base = Math.max(inner.w / img.width, inner.h / img.height);
    const scale = base * panel.zoom;
    const dw = img.width * scale;
    const dh = img.height * scale;
    // Clamp the pan so the photo always covers the panel.
    const maxX = Math.max(0, (dw - inner.w) / 2);
    const maxY = Math.max(0, (dh - inner.h) / 2);
    const px = Math.max(-maxX, Math.min(maxX, panel.panX * inner.w));
    const py = Math.max(-maxY, Math.min(maxY, panel.panY * inner.h));
    const dx = inner.x + (inner.w - dw) / 2 + px;
    const dy = inner.y + (inner.h - dh) / 2 + py;
    if (panel.grade === 'noir') {
      ctx.filter = 'grayscale(1) contrast(1.18) brightness(1.04)';
    }
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';
    applyGrade(ctx, inner, panel.grade);
  } else {
    fillPlaceholder(ctx, inner, panel.grade);
  }
  // Thin inner frame line, poster style.
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = Math.max(1, Math.round(rect.w * 0.002));
  ctx.strokeRect(inner.x + 0.5, inner.y + 0.5, inner.w - 1, inner.h - 1);
  ctx.restore();
}

// Colour grade as a translucent overlay on top of the photo.
function applyGrade(ctx, rect, grade) {
  if (grade === 'natural' || grade === 'noir') return;
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  if (grade === 'sunset') {
    g.addColorStop(0, 'rgba(255,122,24,0.30)');
    g.addColorStop(0.5, 'rgba(255,46,136,0.22)');
    g.addColorStop(1, 'rgba(124,58,237,0.30)');
  } else if (grade === 'neon') {
    g.addColorStop(0, 'rgba(34,211,238,0.26)');
    g.addColorStop(0.55, 'rgba(255,46,136,0.24)');
    g.addColorStop(1, 'rgba(124,58,237,0.34)');
  }
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  // A warm floor glow so the bottom of every panel feels lit by the sunset.
  const floor = ctx.createLinearGradient(rect.x, rect.y + rect.h * 0.55, rect.x, rect.y + rect.h);
  floor.addColorStop(0, 'rgba(255,122,24,0)');
  floor.addColorStop(1, grade === 'neon' ? 'rgba(255,46,136,0.16)' : 'rgba(255,122,24,0.18)');
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = floor;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

// A sunset-gradient placeholder for panels with no photo yet.
function fillPlaceholder(ctx, rect, grade) {
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  if (grade === 'neon') {
    g.addColorStop(0, '#0e7490');
    g.addColorStop(0.5, '#7c3aed');
    g.addColorStop(1, '#ff2e88');
  } else if (grade === 'noir') {
    g.addColorStop(0, '#3a3a44');
    g.addColorStop(1, '#0c0c12');
  } else {
    g.addColorStop(0, '#ff7a18');
    g.addColorStop(0.5, '#ff2e88');
    g.addColorStop(1, '#7c3aed');
  }
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  // Diagonal sun rays, very faint, so an empty panel still reads as a sunset.
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) {
    const x0 = rect.x + (i * rect.w) / 5;
    ctx.beginPath();
    ctx.moveTo(x0, rect.y + rect.h);
    ctx.lineTo(x0 + rect.w * 0.08, rect.y);
    ctx.lineTo(x0 + rect.w * 0.16, rect.y);
    ctx.lineTo(x0 + rect.w * 0.08, rect.y + rect.h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// One palm silhouette: a curved trunk and a crown of drooping fronds.
function drawPalm(ctx, x, y, size, lean, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.scale(size, size);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  // Trunk: a gently curving stem.
  ctx.lineWidth = 0.055;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(0.06, -0.5, 0.02, -1);
  ctx.stroke();
  // Crown fronds: long drooping blades fanning out from the top.
  const fronds = 8;
  for (let i = 0; i < fronds; i++) {
    const a = -Math.PI * 0.08 - (i / (fronds - 1)) * Math.PI * 0.84;
    const len = 0.62 + 0.16 * Math.sin(i * 1.7);
    const tipX = 0.02 + Math.cos(a) * len;
    const tipY = -1 + Math.sin(a) * len * 0.9 + 0.28;
    const midX = 0.02 + Math.cos(a) * len * 0.55;
    const midY = -1 + Math.sin(a) * len * 0.55 - 0.14;
    ctx.beginPath();
    ctx.moveTo(0.02, -1);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.quadraticCurveTo(midX + 0.05, midY + 0.1, 0.02, -1);
    ctx.closePath();
    ctx.fill();
  }
  // A few coconuts under the crown.
  ctx.beginPath();
  ctx.arc(-0.03, -0.94, 0.045, 0, Math.PI * 2);
  ctx.arc(0.07, -0.93, 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Palm clusters along the top edge, the signature skyline of the art.
function drawPalms(ctx, width, height) {
  const color = 'rgba(16,6,32,0.92)';
  const s = width / 1080;
  drawPalm(ctx, width * 0.06, height * 0.02, 150 * s, -0.12, color);
  drawPalm(ctx, width * 0.16, height * 0.015, 110 * s, 0.1, color);
  drawPalm(ctx, width * 0.94, height * 0.02, 150 * s, 0.12, color);
  drawPalm(ctx, width * 0.84, height * 0.015, 105 * s, -0.08, color);
}

// Split the caption into lines that fit the cover width.
function wrapCaption(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// The big bold caption with outline, shadow and a slight tilt.
function drawCaption(ctx, width, height, state) {
  const pad = width * 0.045;
  const size = (state.captionSize / 1080) * width;
  const maxWidth = width - pad * 2;
  ctx.save();
  ctx.font = `${size}px Anton, "Arial Black", Impact, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  const lines = wrapCaption(ctx, state.caption, maxWidth);
  const lineHeight = size * 0.94;
  const blockH = lines.length * lineHeight;
  const subSize = Math.max(18, size * 0.2);
  const totalH = blockH + subSize * 1.9;
  // Tilt the whole caption block a touch, poster style.
  ctx.translate(pad, height - pad - totalH + blockH);
  ctx.rotate(-0.028);
  ctx.shadowColor = 'rgba(255,46,136,0.65)';
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.03;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#160829';
  ctx.lineWidth = Math.max(4, size * 0.075);
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, i) => {
    const y = i * lineHeight;
    ctx.strokeText(line, 0, y);
    ctx.fillText(line, 0, y);
  });
  // Sub caption in gold, letterspaced, under the main line.
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = size * 0.05;
  ctx.shadowOffsetY = size * 0.015;
  ctx.font = `700 ${subSize}px "Segoe UI", system-ui, Arial, sans-serif`;
  ctx.fillStyle = '#ffc93c';
  ctx.strokeStyle = '#160829';
  ctx.lineWidth = Math.max(2, subSize * 0.12);
  const sub = state.subCaption.toUpperCase();
  const spaced = sub.split('').join('\u2009');
  ctx.strokeText(spaced, 2, blockH + subSize * 0.9);
  ctx.fillText(spaced, 2, blockH + subSize * 0.9);
  ctx.restore();
}

// A faint film grain so the export feels printed, not flat.
function drawGrain(ctx, width, height) {
  const rnd = mulberry32(20261119);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#ffffff';
  const step = Math.max(3, Math.round(width / 360));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (rnd() > 0.5) ctx.fillRect(x, y, 1.4, 1.4);
    }
  }
  ctx.restore();
}

// Draw the whole cover onto ctx at the given size.
export function renderCover(ctx, width, height, state) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#160829';
  ctx.fillRect(0, 0, width, height);
  const layout = LAYOUTS[state.layout] || LAYOUTS.trio;
  layout.panels.forEach((def, i) => {
    const rect = panelRect(def, width, height);
    drawPanelPhoto(ctx, state.panels[i] ? state.panels[i].photo : null, rect, state.panels[i] || { zoom: 1, panX: 0, panY: 0, grade: 'sunset' });
  });
  // A unifying sunset wash over the whole collage.
  const wash = ctx.createLinearGradient(0, 0, 0, height);
  wash.addColorStop(0, 'rgba(255,122,24,0.10)');
  wash.addColorStop(0.5, 'rgba(255,46,136,0.06)');
  wash.addColorStop(1, 'rgba(124,58,237,0.12)');
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
  drawPalms(ctx, width, height);
  drawCaption(ctx, width, height, state);
  drawGrain(ctx, width, height);
  // Thin white poster frame.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(2, Math.round(width * 0.003));
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
  ctx.restore();
}

// Render the cover at export size and hand back a PNG blob.
export function exportCover(state, sizeKey) {
  const size = EXPORT_SIZES[sizeKey] || EXPORT_SIZES['1080x1080'];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  renderCover(ctx, size.w, size.h, state);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('could not encode the cover PNG'));
    }, 'image/png');
  });
}
