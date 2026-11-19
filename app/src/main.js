// Vice Cover Studio — the editor: layout, photos, caption and export wiring.
// The cover itself is drawn by src/cover.js; this file only runs the UI.

import {
  LAYOUTS,
  EXPORT_SIZES,
  createState,
  loadImage,
  renderCover,
  exportCover,
} from './cover.js';

const state = createState();
const preview = document.getElementById('preview');
const pctx = preview.getContext('2d');
const controls = document.getElementById('controls');
const shotView = document.getElementById('shotView');
const shotImage = document.getElementById('shotImage');

let selectedPanel = 0;
let dragging = false;
let dragStart = null;
let dragPanelStart = null;
let fontsReady = false;

const SAMPLES = [
  'samples/sunset-beach.jpg',
  'samples/neon-street.jpg',
  'samples/skyline-palms.jpg',
];

function panelCount() {
  return (LAYOUTS[state.layout] || LAYOUTS.trio).panels.length;
}

function currentSize() {
  const picked = document.querySelector('input[name="size"]:checked');
  return EXPORT_SIZES[picked ? picked.value : '1080x1080'];
}

function sizeCanvas() {
  const size = currentSize();
  if (preview.width !== size.w || preview.height !== size.h) {
    preview.width = size.w;
    preview.height = size.h;
  }
}

function render() {
  sizeCanvas();
  renderCover(pctx, preview.width, preview.height, state);
  syncControls();
}

function syncControls() {
  const panel = state.panels[selectedPanel];
  const zoom = document.getElementById('zoomRange');
  if (zoom && panel) zoom.value = String(panel.zoom);
  const grade = document.getElementById('gradeSelect');
  if (grade && panel) grade.value = panel.grade;
  document.querySelectorAll('.layout').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('.panel-btn').forEach((b, i) => {
    b.classList.toggle('active', i === selectedPanel);
  });
}

function buildPanelButtons() {
  const row = document.getElementById('panelRow');
  row.innerHTML = '';
  for (let i = 0; i < panelCount(); i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'panel-btn';
    btn.textContent = 'Panel ' + (i + 1);
    btn.addEventListener('click', () => {
      selectedPanel = i;
      render();
    });
    row.appendChild(btn);
  }
  if (selectedPanel >= panelCount()) selectedPanel = 0;
}

function setLayout(name) {
  if (!LAYOUTS[name]) return;
  state.layout = name;
  buildPanelButtons();
  render();
}

async function setPanelPhoto(index, src) {
  const img = await loadImage(src);
  state.panels[index].photo = img;
  render();
}

async function loadSampleSet() {
  const layout = LAYOUTS[state.layout];
  const jobs = layout.panels.map((_, i) =>
    setPanelPhoto(i, SAMPLES[i % SAMPLES.length]).catch(() => {}),
  );
  await Promise.all(jobs);
  render();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function doExport() {
  const picked = document.querySelector('input[name="size"]:checked');
  const sizeKey = picked ? picked.value : '1080x1080';
  const blob = await exportCover(state, sizeKey);
  downloadBlob(blob, 'vice-cover-' + sizeKey + '.png');
}

// --- pointer: click selects a panel, drag pans its photo -------------------

function panelAt(clientX, clientY) {
  const r = preview.getBoundingClientRect();
  const x = ((clientX - r.left) / r.width) * preview.width;
  const y = ((clientY - r.top) / r.height) * preview.height;
  const layout = LAYOUTS[state.layout];
  for (let i = 0; i < layout.panels.length; i++) {
    const d = layout.panels[i];
    if (
      x >= d.x * preview.width &&
      x < (d.x + d.w) * preview.width &&
      y >= d.y * preview.height &&
      y < (d.y + d.h) * preview.height
    ) {
      return { index: i, x, y };
    }
  }
  return null;
}

preview.addEventListener('pointerdown', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (!hit) return;
  selectedPanel = hit.index;
  dragging = true;
  dragStart = { x: e.clientX, y: e.clientY };
  const p = state.panels[hit.index];
  dragPanelStart = { panX: p.panX, panY: p.panY };
  preview.setPointerCapture(e.pointerId);
  render();
});

preview.addEventListener('pointermove', (e) => {
  if (!dragging || !dragStart) return;
  const r = preview.getBoundingClientRect();
  const layout = LAYOUTS[state.layout];
  const d = layout.panels[selectedPanel];
  const p = state.panels[selectedPanel];
  const dx = (e.clientX - dragStart.x) / r.width;
  const dy = (e.clientY - dragStart.y) / r.height;
  p.panX = dragPanelStart.panX + dx / d.w;
  p.panY = dragPanelStart.panY + dy / d.h;
  render();
});

function endDrag() {
  dragging = false;
  dragStart = null;
  dragPanelStart = null;
}
preview.addEventListener('pointerup', endDrag);
preview.addEventListener('pointercancel', endDrag);

// --- controls ---------------------------------------------------------------

document.querySelectorAll('.layout').forEach((b) => {
  b.addEventListener('click', () => setLayout(b.dataset.layout));
});

document.querySelectorAll('.sample').forEach((b) => {
  b.addEventListener('click', async () => {
    document.querySelectorAll('.sample').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    await setPanelPhoto(selectedPanel, b.dataset.sample).catch(() => {});
  });
});

document.getElementById('zoomRange').addEventListener('input', (e) => {
  state.panels[selectedPanel].zoom = Number(e.target.value);
  render();
});

document.getElementById('gradeSelect').addEventListener('change', (e) => {
  state.panels[selectedPanel].grade = e.target.value;
  render();
});

document.getElementById('resetPanel').addEventListener('click', () => {
  const p = state.panels[selectedPanel];
  p.zoom = 1.15;
  p.panX = 0;
  p.panY = 0;
  p.grade = 'sunset';
  render();
});

document.getElementById('captionInput').addEventListener('input', (e) => {
  state.caption = e.target.value.toUpperCase() || 'UNTITLED';
  render();
});

document.getElementById('subInput').addEventListener('input', (e) => {
  state.subCaption = e.target.value.toUpperCase();
  render();
});

document.getElementById('captionSize').addEventListener('input', (e) => {
  state.captionSize = Number(e.target.value);
  render();
});

document.querySelectorAll('input[name="size"]').forEach((r) => {
  r.addEventListener('change', render);
});

document.getElementById('exportBtn').addEventListener('click', () => {
  doExport().catch((err) => console.error(err));
});

document.getElementById('photoInput').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  for (let i = 0; i < files.length; i++) {
    const idx = Math.min(selectedPanel + i, panelCount() - 1);
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(files[i]);
    });
    await setPanelPhoto(idx, dataUrl).catch(() => {});
  }
  e.target.value = '';
});

// --- screenshot modes (?shot=...) ------------------------------------------
// editor: the editor with the sample set loaded.
// cover:  the 1080x1080 export shown full page.
// tall:   the 1080x1350 export shown full page.
// wide:   the 1920x1080 export shown full page.

async function showShot(sizeKey) {
  controls.style.display = 'none';
  document.querySelector('.hint').style.display = 'none';
  preview.style.display = 'none';
  const blob = await exportCover(state, sizeKey);
  shotImage.src = URL.createObjectURL(blob);
  shotView.hidden = false;
  document.title = 'Vice Cover Studio — ' + sizeKey;
}

async function waitForFonts() {
  try {
    await Promise.race([
      document.fonts.load('110px Anton'),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
    fontsReady = true;
  } catch {
    fontsReady = false;
  }
}

async function init() {
  buildPanelButtons();
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  await waitForFonts();
  await loadSampleSet();
  if (shot === 'cover') await showShot('1080x1080');
  else if (shot === 'tall') await showShot('1080x1350');
  else if (shot === 'wide') await showShot('1920x1080');
  else render();
}

// Automation hook for screenshots: lets a driver render and fetch the PNG.
window.__viceCover = {
  state,
  render,
  exportCover,
  loadSampleSet,
  setLayout,
  get ready() {
    return fontsReady;
  },
};

init().catch((err) => console.error(err));
