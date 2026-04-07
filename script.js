/* =============================================================
   PORTFOLIO — Supabase-backed editable portfolio
   - Projects & site settings stored in Supabase DB
   - Images stored in Supabase Storage
   - Password stored in localStorage (simple, not security-critical)
============================================================= */

const SUPABASE_URL = CONFIG.supabaseUrl;
const SUPABASE_KEY = CONFIG.supabaseKey;
const BUCKET       = CONFIG.bucket;

// ── Supabase helpers ─────────────────────────────────────────
const headers = {
  'apikey':        SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type':  'application/json',
};

async function dbSelect() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/projects?order=sort_order.asc`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function dbInsert(row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function dbUpdate(id, row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function dbDelete(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${id}`, {
    method: 'DELETE', headers,
  });
  if (!res.ok) throw new Error(await res.text());
}

async function uploadImage(file, path) {
  const uploadHeaders = {
    'apikey':        SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type':  file.type,
    'Cache-Control': '3600',
  };
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: uploadHeaders,
    body: file,
  });
  if (!res.ok) throw new Error(await res.text());
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function deleteImage(path) {
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'DELETE', headers,
  });
}

// ── Site settings (localStorage) ─────────────────────────────
function getSettings() {
  try {
    const s = localStorage.getItem('portfolio_settings');
    return s ? JSON.parse(s) : {
      password: CONFIG.adminPassword,
      title:    CONFIG.siteTitle,
      subtitle: CONFIG.siteSubtitle,
    };
  } catch { return { password: CONFIG.adminPassword, title: CONFIG.siteTitle, subtitle: CONFIG.siteSubtitle }; }
}

function saveSettings(s) {
  localStorage.setItem('portfolio_settings', JSON.stringify(s));
}

let settings = getSettings();

// ── State ─────────────────────────────────────────────────────
let projects = [];

// ── Init ─────────────────────────────────────────────────────
async function init() {
  applySettings();
  try {
    projects = await dbSelect();
  } catch (e) {
    console.error('Could not load projects:', e);
    projects = [];
  }
  renderPortfolio();
}

// ── Apply settings to header ──────────────────────────────────
function applySettings() {
  document.getElementById('display-title').textContent    = settings.title;
  document.getElementById('display-subtitle').textContent = settings.subtitle;
  document.title = settings.title;
}

// ── Render portfolio ──────────────────────────────────────────
function renderPortfolio() {
  document.getElementById('loading-screen')?.remove();

  const nav  = document.getElementById('project-nav');
  const main = document.getElementById('projects-container');
  nav.innerHTML  = '';
  main.innerHTML = '';

  if (!projects.length) {
    main.innerHTML = `<div class="empty-state">No projects yet — click ⚙ to add one</div>`;
    return;
  }

  projects.forEach((proj, i) => {
    // Tab
    const tab = document.createElement('button');
    tab.className = 'tab' + (i === 0 ? ' active' : '');
    tab.textContent = proj.name || 'Untitled';
    tab.dataset.id = proj.id;
    tab.addEventListener('click', () => switchProject(proj.id));
    nav.appendChild(tab);

    // Section
    const section = document.createElement('section');
    section.className = 'project' + (i === 0 ? ' active' : '');
    section.id = 'proj-' + proj.id;

    section.innerHTML = `
      <div class="project-info">
        <h2>${esc(proj.name || 'Untitled')}</h2>
        <p>${esc(proj.description || '')}</p>
      </div>
      <div class="slider-wrapper">
        <div class="slider-container" id="slider-${proj.id}">
          ${proj.before_url
            ? `<img class="img-before" src="${proj.before_url}" alt="Before" />`
            : `<div class="img-placeholder">Upload a BEFORE image in the editor</div>`}
          ${proj.after_url
            ? `<img class="img-after" src="${proj.after_url}" alt="After" />`
            : ''}
          <div class="slider-handle">
            <div class="handle-line"></div>
            <div class="handle-circle">&#8596;</div>
          </div>
          <span class="label label-before">BEFORE</span>
          <span class="label label-after">AFTER</span>
        </div>
      </div>`;

    main.appendChild(section);
    initSlider(document.getElementById('slider-' + proj.id));
  });
}

function switchProject(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.id == id));
  document.querySelectorAll('.project').forEach(p => p.classList.toggle('active', p.id === 'proj-' + id));
  const sc = document.getElementById('slider-' + id);
  if (sc) setSliderPos(sc, 50);
}

// ── Slider ────────────────────────────────────────────────────
function setSliderPos(container, pct) {
  pct = Math.max(0, Math.min(100, pct));
  const after  = container.querySelector('.img-after');
  const handle = container.querySelector('.slider-handle');
  if (after)  after.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
  if (handle) handle.style.left = pct + '%';
}

function initSlider(container) {
  if (!container) return;
  let dragging = false;
  setSliderPos(container, 50);
  const pct = x => ((x - container.getBoundingClientRect().left) / container.offsetWidth) * 100;
  container.addEventListener('mousedown',  e => { dragging = true; setSliderPos(container, pct(e.clientX)); });
  window.addEventListener('mousemove',     e => { if (dragging) setSliderPos(container, pct(e.clientX)); });
  window.addEventListener('mouseup',       ()  => { dragging = false; });
  container.addEventListener('touchstart', e => { dragging = true; setSliderPos(container, pct(e.touches[0].clientX)); }, { passive: true });
  window.addEventListener('touchmove',     e => { if (dragging) setSliderPos(container, pct(e.touches[0].clientX)); }, { passive: true });
  window.addEventListener('touchend',      ()  => { dragging = false; });
}

// ── Login ─────────────────────────────────────────────────────
let editorUnlocked = false;

document.getElementById('gear-btn').addEventListener('click', () => {
  if (editorUnlocked) { openEditor(); return; }
  document.getElementById('login-modal').classList.add('open');
  setTimeout(() => document.getElementById('password-input').focus(), 50);
});

document.getElementById('login-cancel').addEventListener('click', closeLogin);
document.getElementById('login-submit').addEventListener('click', tryLogin);
document.getElementById('password-input').addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });

function tryLogin() {
  const val = document.getElementById('password-input').value;
  if (val === settings.password) {
    editorUnlocked = true;
    closeLogin();
    openEditor();
  } else {
    document.getElementById('login-error').textContent = 'Incorrect password.';
    document.getElementById('password-input').value = '';
    document.getElementById('password-input').focus();
  }
}

function closeLogin() {
  document.getElementById('login-modal').classList.remove('open');
  document.getElementById('login-error').textContent = '';
  document.getElementById('password-input').value = '';
}

// ── Editor ────────────────────────────────────────────────────
function openEditor() {
  populateEditor();
  document.getElementById('editor-panel').classList.add('open');
}

document.getElementById('editor-close').addEventListener('click', () => {
  document.getElementById('editor-panel').classList.remove('open');
});

// Pending image files chosen but not yet uploaded
let pendingImages = {}; // key: `${projId}-before` or `${projId}-after`

function populateEditor() {
  document.getElementById('edit-title').value    = settings.title;
  document.getElementById('edit-subtitle').value = settings.subtitle;
  document.getElementById('edit-password').value = '';
  pendingImages = {};
  renderProjectCards();
}

function renderProjectCards() {
  const list = document.getElementById('projects-editor-list');
  list.innerHTML = '';

  projects.forEach((proj, idx) => {
    const card = document.createElement('div');
    card.className = 'project-editor-card';

    card.innerHTML = `
      <div class="project-editor-card-header">
        <span>Project ${idx + 1}</span>
        <button class="btn-remove" data-id="${proj.id}">Remove</button>
      </div>
      <label>Tab Name
        <input type="text" class="proj-name" data-id="${proj.id}" value="${esc(proj.name)}" placeholder="e.g. City Streets" />
      </label>
      <label>Description
        <textarea class="proj-desc" data-id="${proj.id}" placeholder="Short description.">${esc(proj.description)}</textarea>
      </label>
      <div class="image-upload-row">
        <div class="image-upload-box">
          <span>Before</span>
          <div class="upload-btn ${proj.before_url ? 'has-image' : ''}" data-target="before" data-id="${proj.id}">
            ${pendingImages[proj.id+'-before'] ? '📁 ' + pendingImages[proj.id+'-before'].name.slice(0,14) : proj.before_url ? '✔ Image set' : 'Click to upload'}
          </div>
          <input type="file" class="file-input" accept="image/*" data-target="before" data-id="${proj.id}" />
        </div>
        <div class="image-upload-box">
          <span>After</span>
          <div class="upload-btn ${proj.after_url ? 'has-image' : ''}" data-target="after" data-id="${proj.id}">
            ${pendingImages[proj.id+'-after'] ? '📁 ' + pendingImages[proj.id+'-after'].name.slice(0,14) : proj.after_url ? '✔ Image set' : 'Click to upload'}
          </div>
          <input type="file" class="file-input" accept="image/*" data-target="after" data-id="${proj.id}" />
        </div>
      </div>`;

    list.appendChild(card);
  });

  // Remove
  list.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!confirm('Remove this project?')) return;
      const proj = projects.find(p => p.id == id);
      if (proj) {
        // Delete images from storage
        if (proj.before_url) await deleteImage(imagePathFromUrl(proj.before_url));
        if (proj.after_url)  await deleteImage(imagePathFromUrl(proj.after_url));
        await dbDelete(id);
        projects = projects.filter(p => p.id != id);
      }
      renderProjectCards();
      renderPortfolio();
    });
  });

  // Name/desc sync to local array
  list.querySelectorAll('.proj-name').forEach(inp => {
    inp.addEventListener('input', () => {
      const proj = projects.find(p => p.id == inp.dataset.id);
      if (proj) proj.name = inp.value;
    });
  });
  list.querySelectorAll('.proj-desc').forEach(ta => {
    ta.addEventListener('input', () => {
      const proj = projects.find(p => p.id == ta.dataset.id);
      if (proj) proj.description = ta.value;
    });
  });

  // Upload button → file input
  list.querySelectorAll('.upload-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.nextElementSibling.click());
  });

  // File chosen → store in pending
  list.querySelectorAll('.file-input').forEach(input => {
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const key = input.dataset.id + '-' + input.dataset.target;
      pendingImages[key] = file;
      const uploadBtn = input.previousElementSibling;
      uploadBtn.textContent = '📁 ' + file.name.slice(0, 16);
      uploadBtn.classList.add('has-image');
    });
  });
}

// Add new project (saves immediately to DB to get an ID)
document.getElementById('add-project-btn').addEventListener('click', async () => {
  setStatus('Creating project…', 'neutral');
  try {
    const rows = await dbInsert({
      name: 'New Project',
      description: '',
      before_url: null,
      after_url: null,
      sort_order: projects.length,
    });
    projects.push(rows[0]);
    renderProjectCards();
    renderPortfolio();
    setStatus('Project added — upload images and save!', 'ok');
    document.getElementById('projects-editor-list').lastElementChild?.scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    setStatus('Error: ' + e.message, 'error');
  }
});

// Save all
document.getElementById('save-btn').addEventListener('click', async () => {
  setStatus('Saving…', 'neutral');

  // Update settings
  settings.title    = document.getElementById('edit-title').value.trim() || settings.title;
  settings.subtitle = document.getElementById('edit-subtitle').value.trim();
  const newPw = document.getElementById('edit-password').value.trim();
  if (newPw) settings.password = newPw;
  saveSettings(settings);
  applySettings();

  // Upload pending images & update projects
  try {
    for (const proj of projects) {
      let updates = { name: proj.name, description: proj.description, sort_order: projects.indexOf(proj) };

      for (const target of ['before', 'after']) {
        const key  = proj.id + '-' + target;
        const file = pendingImages[key];
        if (file) {
          const path = `${proj.id}/${target}-${Date.now()}.${file.name.split('.').pop()}`;
          const url  = await uploadImage(file, path);
          updates[target + '_url'] = url;
          proj[target + '_url']    = url;
        }
      }

      await dbUpdate(proj.id, updates);
    }

    pendingImages = {};
    renderPortfolio();
    renderProjectCards();
    setStatus('✔ All changes saved!', 'ok');
  } catch (e) {
    setStatus('Error saving: ' + e.message, 'error');
  }
});

// ── Helpers ───────────────────────────────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function imagePathFromUrl(url) {
  // Extract path after /object/public/portfolio/
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx !== -1 ? url.slice(idx + marker.length) : '';
}

function setStatus(msg, type) {
  const el = document.getElementById('save-status');
  el.textContent = msg;
  el.style.color = type === 'error' ? '#c0504d' : type === 'ok' ? '#7abf8e' : '#aaa';
}

// ── Go! ───────────────────────────────────────────────────────
init();
