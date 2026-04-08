/* =============================================================
   PORTFOLIO — Supabase-backed with gallery
============================================================= */

const SUPABASE_URL = CONFIG.supabaseUrl;
const SUPABASE_KEY = CONFIG.supabaseKey;
const BUCKET       = CONFIG.bucket;

const headers = {
  'apikey':        SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type':  'application/json',
};

// ── Supabase DB ───────────────────────────────────────────────
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

// ── Photos DB ────────────────────────────────────────────────
async function photosSelect(projectId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/photos?project_id=eq.${projectId}&order=sort_order.asc`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function photosInsert(row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/photos`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function photosDelete(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/photos?id=eq.${id}`, {
    method: 'DELETE', headers,
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── Storage ───────────────────────────────────────────────────
async function uploadImage(file, path) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': file.type,
      'Cache-Control': '3600',
    },
    body: file,
  });
  if (!res.ok) throw new Error(await res.text());
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function deleteStorageImage(path) {
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'DELETE', headers,
  });
}

// ── Settings ──────────────────────────────────────────────────
function getSettings() {
  try {
    const s = localStorage.getItem('portfolio_settings');
    return s ? JSON.parse(s) : { password: CONFIG.adminPassword, title: CONFIG.siteTitle, subtitle: CONFIG.siteSubtitle };
  } catch { return { password: CONFIG.adminPassword, title: CONFIG.siteTitle, subtitle: CONFIG.siteSubtitle }; }
}
function saveSettings(s) { localStorage.setItem('portfolio_settings', JSON.stringify(s)); }

let settings = getSettings();
let projects = [];
let pendingImages = {};
let pendingPhotos = {}; // projectId -> [File, ...]

// ── Init ──────────────────────────────────────────────────────
async function init() {
  applySettings();
  try { projects = await dbSelect(); } catch (e) { projects = []; }
  renderPortfolio();
  renderSidebar();
}

function applySettings() {
  document.getElementById('display-title').textContent    = settings.title;
  document.getElementById('display-subtitle').textContent = settings.subtitle;
  document.title = settings.title;
}

// ── Sidebar ───────────────────────────────────────────────────
document.getElementById('hamburger-btn').addEventListener('click', openSidebar);
document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

function renderSidebar() {
  const list = document.getElementById('sidebar-list');
  list.innerHTML = '';
  projects.forEach(proj => {
    const item = document.createElement('div');
    item.className = 'sidebar-project';
    item.innerHTML = `
      <div class="sidebar-project-name">
        <span>${esc(proj.name || 'Untitled')}</span>
        <button class="sidebar-photos-btn" data-id="${proj.id}">📁 Photos</button>
      </div>`;
    // Click project name → switch to that project
    item.querySelector('.sidebar-project-name span').addEventListener('click', () => {
      switchProject(proj.id);
      closeSidebar();
    });
    // Click photos button → open gallery
    item.querySelector('.sidebar-photos-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      closeSidebar();
      await openGallery(proj);
    });
    list.appendChild(item);
  });
}

// ── Gallery ───────────────────────────────────────────────────
let galleryPhotos = [];
let galleryIndex  = 0;

async function openGallery(proj) {
  try {
    galleryPhotos = await photosSelect(proj.id);
  } catch (e) {
    galleryPhotos = [];
  }

  if (!galleryPhotos.length) {
    alert('No photos yet for this project. Add some in the ⚙ editor!');
    return;
  }

  document.getElementById('gallery-title').textContent = proj.name + ' — Photos';
  galleryIndex = 0;
  showGalleryPhoto();
  document.getElementById('gallery-overlay').classList.add('open');
}

function showGalleryPhoto() {
  const photo = galleryPhotos[galleryIndex];
  document.getElementById('gallery-img').src = photo.url;
  document.getElementById('gallery-counter').textContent = `${galleryIndex + 1} / ${galleryPhotos.length}`;
}

document.getElementById('gallery-close').addEventListener('click', () => {
  document.getElementById('gallery-overlay').classList.remove('open');
});

document.getElementById('gallery-prev').addEventListener('click', () => {
  galleryIndex = (galleryIndex - 1 + galleryPhotos.length) % galleryPhotos.length;
  showGalleryPhoto();
});

document.getElementById('gallery-next').addEventListener('click', () => {
  galleryIndex = (galleryIndex + 1) % galleryPhotos.length;
  showGalleryPhoto();
});

// Keyboard arrows
document.addEventListener('keydown', e => {
  if (!document.getElementById('gallery-overlay').classList.contains('open')) return;
  if (e.key === 'ArrowLeft')  { galleryIndex = (galleryIndex - 1 + galleryPhotos.length) % galleryPhotos.length; showGalleryPhoto(); }
  if (e.key === 'ArrowRight') { galleryIndex = (galleryIndex + 1) % galleryPhotos.length; showGalleryPhoto(); }
  if (e.key === 'Escape') document.getElementById('gallery-overlay').classList.remove('open');
});

// ── Portfolio render ──────────────────────────────────────────
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
    // Tab + photos button
    const tabWrap = document.createElement('div');
    tabWrap.style.display = 'flex';
    tabWrap.style.alignItems = 'center';

    const tab = document.createElement('button');
    tab.className = 'tab' + (i === 0 ? ' active' : '');
    tab.textContent = proj.name || 'Untitled';
    tab.dataset.id = proj.id;
    tab.addEventListener('click', () => switchProject(proj.id));

    const photosBtn = document.createElement('button');
    photosBtn.className = 'tab-photos-btn';
    photosBtn.textContent = '📁';
    photosBtn.title = 'View photos';
    photosBtn.addEventListener('click', async () => await openGallery(proj));

    tabWrap.appendChild(tab);
    tabWrap.appendChild(photosBtn);
    nav.appendChild(tabWrap);

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
  if (after)  after.style.clipPath = `inset(0 0 0 ${pct}%)`;
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

function populateEditor() {
  document.getElementById('edit-title').value    = settings.title;
  document.getElementById('edit-subtitle').value = settings.subtitle;
  document.getElementById('edit-password').value = '';
  pendingImages = {};
  pendingPhotos = {};
  renderProjectCards();
}

async function renderProjectCards() {
  const list = document.getElementById('projects-editor-list');
  list.innerHTML = '';

  for (const [idx, proj] of projects.entries()) {
    // Load existing photos for this project
    let existingPhotos = [];
    try { existingPhotos = await photosSelect(proj.id); } catch (e) {}

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
            ${proj.before_url ? '✔ Image set' : 'Click to upload'}
          </div>
          <input type="file" class="file-input" accept="image/*" data-target="before" data-id="${proj.id}" />
        </div>
        <div class="image-upload-box">
          <span>After</span>
          <div class="upload-btn ${proj.after_url ? 'has-image' : ''}" data-target="after" data-id="${proj.id}">
            ${proj.after_url ? '✔ Image set' : 'Click to upload'}
          </div>
          <input type="file" class="file-input" accept="image/*" data-target="after" data-id="${proj.id}" />
        </div>
      </div>
      <div class="gallery-editor">
        <div class="gallery-editor-title">📁 Gallery Photos</div>
        <div class="gallery-editor-photos" id="gallery-thumbs-${proj.id}"></div>
        <button class="btn-add-photos" data-id="${proj.id}">+ Add Photos</button>
        <input type="file" class="gallery-file-input" accept="image/*" multiple data-id="${proj.id}" style="display:none" />
      </div>`;

    list.appendChild(card);

    // Render existing photo thumbs
    const thumbsContainer = document.getElementById(`gallery-thumbs-${proj.id}`);
    existingPhotos.forEach(photo => {
      addPhotoThumb(thumbsContainer, photo.url, photo.id, proj.id, true);
    });

    // Render pending photo thumbs
    if (pendingPhotos[proj.id]) {
      pendingPhotos[proj.id].forEach(file => {
        const url = URL.createObjectURL(file);
        addPhotoThumb(thumbsContainer, url, null, proj.id, false);
      });
    }
  }

  // Remove project
  list.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this project?')) return;
      const id = btn.dataset.id;
      const proj = projects.find(p => p.id == id);
      if (proj) {
        if (proj.before_url) await deleteStorageImage(imagePathFromUrl(proj.before_url));
        if (proj.after_url)  await deleteStorageImage(imagePathFromUrl(proj.after_url));
        await dbDelete(id);
        projects = projects.filter(p => p.id != id);
      }
      renderProjectCards();
      renderPortfolio();
      renderSidebar();
    });
  });

  // Name/desc
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

  // Before/after upload
  list.querySelectorAll('.upload-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.nextElementSibling.click());
  });
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

  // Gallery add photos
  list.querySelectorAll('.btn-add-photos').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.nextElementSibling.click();
    });
  });
  list.querySelectorAll('.gallery-file-input').forEach(input => {
    input.addEventListener('change', () => {
      const projId = input.dataset.id;
      if (!pendingPhotos[projId]) pendingPhotos[projId] = [];
      const thumbsContainer = document.getElementById(`gallery-thumbs-${projId}`);
      Array.from(input.files).forEach(file => {
        pendingPhotos[projId].push(file);
        const url = URL.createObjectURL(file);
        addPhotoThumb(thumbsContainer, url, null, projId, false);
      });
      input.value = '';
    });
  });
}

function addPhotoThumb(container, url, dbId, projId, isSaved) {
  const thumb = document.createElement('div');
  thumb.className = 'gallery-thumb';
  thumb.innerHTML = `
    <img src="${url}" alt="photo" />
    <button class="gallery-thumb-remove" title="Remove">✕</button>`;
  thumb.querySelector('.gallery-thumb-remove').addEventListener('click', async () => {
    if (isSaved && dbId) {
      if (!confirm('Delete this photo?')) return;
      await photosDelete(dbId);
    } else {
      // Remove from pending
      const idx = pendingPhotos[projId]?.findIndex(f => URL.createObjectURL(f) === url);
      if (idx !== undefined && idx > -1) pendingPhotos[projId].splice(idx, 1);
    }
    thumb.remove();
  });
  container.appendChild(thumb);
}

// Add project
document.getElementById('add-project-btn').addEventListener('click', async () => {
  setStatus('Creating project…', 'neutral');
  try {
    const rows = await dbInsert({
      name: 'New Project', description: '',
      before_url: null, after_url: null,
      sort_order: projects.length,
    });
    projects.push(rows[0]);
    renderProjectCards();
    renderPortfolio();
    renderSidebar();
    setStatus('Project added!', 'ok');
    document.getElementById('projects-editor-list').lastElementChild?.scrollIntoView({ behavior: 'smooth' });
  } catch (e) { setStatus('Error: ' + e.message, 'error'); }
});

// Save
document.getElementById('save-btn').addEventListener('click', async () => {
  setStatus('Saving…', 'neutral');

  settings.title    = document.getElementById('edit-title').value.trim() || settings.title;
  settings.subtitle = document.getElementById('edit-subtitle').value.trim();
  const newPw = document.getElementById('edit-password').value.trim();
  if (newPw) settings.password = newPw;
  saveSettings(settings);
  applySettings();

  try {
    for (const proj of projects) {
      let updates = { name: proj.name, description: proj.description, sort_order: projects.indexOf(proj) };

      // Before/after images
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

      // Gallery photos
      const photos = pendingPhotos[proj.id] || [];
      for (const [i, file] of photos.entries()) {
        const path = `${proj.id}/gallery-${Date.now()}-${i}.${file.name.split('.').pop()}`;
        const url  = await uploadImage(file, path);
        await photosInsert({ project_id: proj.id, url, sort_order: i });
      }
      pendingPhotos[proj.id] = [];
    }

    pendingImages = {};
    renderPortfolio();
    renderSidebar();
    await renderProjectCards();
    setStatus('✔ All changes saved!', 'ok');
  } catch (e) { setStatus('Error: ' + e.message, 'error'); }
});

// ── Helpers ───────────────────────────────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function imagePathFromUrl(url) {
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx !== -1 ? url.slice(idx + marker.length) : '';
}
function setStatus(msg, type) {
  const el = document.getElementById('save-status');
  el.textContent = msg;
  el.style.color = type === 'error' ? '#c0504d' : type === 'ok' ? '#7abf8e' : '#aaa';
}

init();
