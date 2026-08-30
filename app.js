/**
 * DocVault – Supabase only (no GoFile)
 * Max 50 MB per file · Permanent storage
 */

const SUPABASE_URL = 'https://ydexxymhtuoanntzjfgz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkZXh4eW1odHVvYW5udHpqZmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwNjU3OTAsImV4cCI6MjEwMzY0MTc5MH0.9mqb5QbrIDa-7vDBUW2QJwVOi-fF5uen765tmV8BJqY';
const ADMIN_PASSWORD = 'admin123';
const MAX_BYTES = 50 * 1024 * 1024;
const BUCKET = 'documents';

let supabase = null;
let isAdmin = sessionStorage.getItem('docvault_admin') === '1';
let historyCache = [];

if (SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const $ = id => document.getElementById(id);
const dropZone = $('dropZone');
const fileInput = $('fileInput');
const folderInput = $('folderInput');
const browseBtn = $('browseBtn');
const filesSection = $('filesSection');
const filesList = $('filesList');
const clearBtn = $('clearBtn');
const themeToggle = $('themeToggle');
const usePassword = $('usePassword');
const filePassword = $('filePassword');
const passwordRow = $('passwordRow');
const zipMultiple = $('zipMultiple');
const folderMode = $('folderMode');
const expirySelect = $('expirySelect');
const previewModal = $('previewModal');
const previewBody = $('previewBody');
const modalClose = $('modalClose');
const modalBackdrop = $('modalBackdrop');
const historyList = $('historyList');
const historyEmpty = $('historyEmpty');
const refreshHistoryBtn = $('refreshHistoryBtn');
const searchInput = $('searchInput');
const copyAllBtn = $('copyAllBtn');
const adminOnlyArea = $('adminOnlyArea');
const adminLoginBtn = $('adminLoginBtn');
const adminLogoutBtn = $('adminLogoutBtn');
const adminStatus = $('adminStatus');
const loginBox = $('loginBox');
const adminPasswordInput = $('adminPasswordInput');
const adminLoginSubmit = $('adminLoginSubmit');
const loginError = $('loginError');

function initTheme() {
  const saved = localStorage.getItem('docvault-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}
themeToggle.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('docvault-theme', next);
});
initTheme();

function updateAdminUI() {
  if (isAdmin) {
    adminOnlyArea.hidden = false;
    adminLoginBtn.hidden = true;
    adminLogoutBtn.hidden = false;
    loginBox.hidden = true;
    adminStatus.textContent = 'Admin mode — you can upload';
    adminStatus.classList.add('admin-on');
  } else {
    adminOnlyArea.hidden = true;
    adminLoginBtn.hidden = false;
    adminLogoutBtn.hidden = true;
    loginBox.hidden = true;
    adminStatus.textContent = 'Public view — download only';
    adminStatus.classList.remove('admin-on');
  }
}
adminLoginBtn.addEventListener('click', () => {
  loginBox.hidden = !loginBox.hidden;
  loginError.hidden = true;
  adminPasswordInput.value = '';
  if (!loginBox.hidden) adminPasswordInput.focus();
});
adminLoginSubmit.addEventListener('click', tryLogin);
adminPasswordInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
function tryLogin() {
  if (adminPasswordInput.value === ADMIN_PASSWORD) {
    isAdmin = true;
    sessionStorage.setItem('docvault_admin', '1');
    updateAdminUI();
  } else loginError.hidden = false;
}
adminLogoutBtn.addEventListener('click', () => {
  isAdmin = false;
  sessionStorage.removeItem('docvault_admin');
  updateAdminUI();
});
updateAdminUI();

if (usePassword) {
  usePassword.addEventListener('change', () => {
    passwordRow.hidden = !usePassword.checked;
    if (usePassword.checked) filePassword.focus();
  });
}

if (dropZone) {
  ['dragenter','dragover','dragleave','drop'].forEach(ev => {
    dropZone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); });
  });
  dropZone.addEventListener('dragenter', () => dropZone.classList.add('dragover'));
  dropZone.addEventListener('dragover', () => dropZone.classList.add('dragover'));
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    if (!isAdmin) return;
    dropZone.classList.remove('dragover');
    const files = [...e.dataTransfer.files];
    if (files.length) processIncomingFiles(files);
  });
  dropZone.addEventListener('click', e => {
    if (!isAdmin) return;
    if (e.target.closest('.options-bar') || e.target.closest('.password-row')) return;
    if (folderMode.checked) folderInput.click(); else fileInput.click();
  });
}
if (browseBtn) {
  browseBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (!isAdmin) return;
    if (folderMode.checked) folderInput.click(); else fileInput.click();
  });
}
if (fileInput) fileInput.addEventListener('change', () => {
  if (!isAdmin) return;
  const files = [...fileInput.files];
  if (files.length) processIncomingFiles(files);
  fileInput.value = '';
});
if (folderInput) folderInput.addEventListener('change', () => {
  if (!isAdmin) return;
  const files = [...folderInput.files];
  if (files.length) processIncomingFiles(files);
  folderInput.value = '';
});
if (clearBtn) clearBtn.addEventListener('click', () => {
  filesList.innerHTML = '';
  filesSection.hidden = true;
});
modalClose.addEventListener('click', closePreview);
modalBackdrop.addEventListener('click', closePreview);
refreshHistoryBtn.addEventListener('click', loadHistory);
searchInput.addEventListener('input', () => renderHistory(historyCache));
copyAllBtn.addEventListener('click', () => {
  const links = historyCache.map(r => r.download_url).filter(Boolean);
  if (!links.length) return;
  navigator.clipboard.writeText(links.join('\n')).then(() => {
    copyAllBtn.textContent = 'Copied!';
    setTimeout(() => { copyAllBtn.textContent = 'Copy all'; }, 1500);
  });
});

function formatBytes(bytes) {
  if (bytes == null) return '';
  if (bytes === 0) return '0 B';
  const k = 1024, s = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + s[i];
}
function getFileIcon(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map = { pdf:'📕', doc:'📘', docx:'📘', xls:'📗', xlsx:'📗', ppt:'📙', pptx:'📙',
    txt:'📄', md:'📄', zip:'🗜️', rar:'🗜️', '7z':'🗜️',
    jpg:'🖼️', jpeg:'🖼️', png:'🖼️', gif:'🖼️', webp:'🖼️',
    mp4:'🎬', mov:'🎬', avi:'🎬', mkv:'🎬', mp3:'🎵', wav:'🎵' };
  return map[ext] || '📁';
}
function typeBadge(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return '<span class="badge badge-pdf">PDF</span>';
  if (['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext)) return '<span class="badge badge-img">IMG</span>';
  if (['doc','docx','txt','md','rtf'].includes(ext)) return '<span class="badge badge-doc">DOC</span>';
  if (['zip','rar','7z','tar','gz'].includes(ext)) return '<span class="badge badge-zip">ZIP</span>';
  if (['mp4','mov','avi','mkv','webm'].includes(ext)) return '<span class="badge badge-vid">VID</span>';
  if (['mp3','wav','flac','ogg'].includes(ext)) return '<span class="badge badge-audio">AUD</span>';
  return `<span class="badge badge-other">${(ext || 'FILE').slice(0,4).toUpperCase()}</span>`;
}
function isImage(n) { return /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(n); }
function isPdf(n) { return /\.pdf$/i.test(n); }
function timeAgo(iso) {
  if (!iso) return '';
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return Math.floor(sec/60) + 'm ago';
  if (sec < 86400) return Math.floor(sec/3600) + 'h ago';
  return Math.floor(sec/86400) + 'd ago';
}

async function saveToHistory(row) {
  if (!supabase) return;
  const { error } = await supabase.from('uploads').insert(row);
  if (error) console.warn('history', error.message);
  else loadHistory();
}

async function loadHistory() {
  if (!supabase) {
    historyEmpty.hidden = false;
    historyEmpty.textContent = 'Supabase not configured.';
    return;
  }
  try {
    const { data, error } = await supabase.from('uploads').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    historyCache = data || [];
    renderHistory(historyCache);
  } catch (e) {
    console.error(e);
    historyEmpty.hidden = false;
    historyEmpty.textContent = 'Could not load history. Create the uploads table in Supabase.';
  }
}

function renderHistory(rows) {
  const q = (searchInput.value || '').trim().toLowerCase();
  const filtered = q ? rows.filter(r => (r.file_name || '').toLowerCase().includes(q)) : rows;
  historyList.innerHTML = '';
  if (!filtered.length) {
    historyEmpty.hidden = false;
    historyEmpty.textContent = q ? 'No matching files.' : 'No files yet.';
    return;
  }
  historyEmpty.hidden = true;
  filtered.forEach(row => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <div class="file-header">
        <div class="file-icon">${getFileIcon(row.file_name)}</div>
        <div class="file-info">
          <div class="file-name" title="${row.file_name}">${row.file_name}</div>
          <div class="file-meta">${typeBadge(row.file_name)} <span class="badge badge-perm">Permanent</span> ${formatBytes(row.file_size)} · ${timeAgo(row.created_at)}</div>
        </div>
        <span class="file-status status-success">Ready</span>
      </div>
      <div class="file-actions">
        <input class="file-link" readonly value="${row.download_url || ''}" />
        <button class="btn-sm btn-copy">Copy</button>
        <button class="btn-sm secondary btn-qr">QR</button>
      </div>
      <div class="qr-box" hidden></div>
      ${row.password ? `<div class="password-note">🔒 ${row.password}</div>` : ''}
    `;
    historyList.appendChild(item);
    const link = row.download_url || '';
    item.querySelector('.btn-copy').addEventListener('click', ev => {
      navigator.clipboard.writeText(link).then(() => {
        ev.target.textContent = 'Copied!';
        ev.target.classList.add('copied');
        setTimeout(() => { ev.target.textContent = 'Copy'; ev.target.classList.remove('copied'); }, 1500);
      });
    });
    const qrBox = item.querySelector('.qr-box');
    item.querySelector('.btn-qr').addEventListener('click', () => {
      if (qrBox.hidden) {
        qrBox.hidden = false;
        qrBox.innerHTML = '';
        const c = document.createElement('canvas');
        qrBox.appendChild(c);
        QRCode.toCanvas(c, link, { width: 150, margin: 1 }, () => {});
      } else qrBox.hidden = true;
    });
  });
}

loadHistory();

function createFileItem(file, extra = '') {
  const item = document.createElement('div');
  item.className = 'file-item';
  item.innerHTML = `
    <div class="file-header">
      <div class="file-icon">${getFileIcon(file.name)}</div>
      <div class="file-info">
        <div class="file-name">${file.name}${extra}</div>
        <div class="file-meta">${typeBadge(file.name)} ${formatBytes(file.size)}</div>
      </div>
      <span class="file-status status-uploading">Uploading…</span>
    </div>
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <div class="file-actions" hidden>
      <input class="file-link" readonly />
      <button class="btn-sm btn-copy">Copy</button>
      <button class="btn-sm secondary btn-qr">QR</button>
      <button class="btn-sm secondary btn-preview" hidden>Preview</button>
    </div>
    <div class="qr-box" hidden></div>
    <div class="password-note" hidden></div>
  `;
  filesList.prepend(item);
  filesSection.hidden = false;
  return item;
}

function wireActions(itemEl, url, file) {
  const copyBtn = itemEl.querySelector('.btn-copy');
  const qrBtn = itemEl.querySelector('.btn-qr');
  const previewBtn = itemEl.querySelector('.btn-preview');
  const qrBox = itemEl.querySelector('.qr-box');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(url).then(() => {
      copyBtn.textContent = 'Copied!';
      copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 1500);
    });
  });
  qrBtn.addEventListener('click', () => {
    if (qrBox.hidden) {
      qrBox.hidden = false;
      qrBox.innerHTML = '';
      const c = document.createElement('canvas');
      qrBox.appendChild(c);
      QRCode.toCanvas(c, url, { width: 150, margin: 1 }, () => {});
    } else qrBox.hidden = true;
  });
  if (isImage(file.name) || isPdf(file.name)) {
    previewBtn.hidden = false;
    previewBtn.addEventListener('click', () => openPreview(file));
  }
}

async function uploadToSupabase(file, itemEl) {
  if (!supabase) throw new Error('Supabase not configured');
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (${formatBytes(file.size)}). Max 50 MB on free plan.`);
  }

  const statusEl = itemEl.querySelector('.file-status');
  const progressFill = itemEl.querySelector('.progress-fill');
  const actions = itemEl.querySelector('.file-actions');
  const linkInput = itemEl.querySelector('.file-link');
  const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  progressFill.style.width = '25%';
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream'
  });
  if (upErr) throw upErr;
  progressFill.style.width = '75%';

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = pub?.publicUrl;
  if (!url) throw new Error('No public URL. Make the "documents" bucket Public.');

  const password = (usePassword.checked && filePassword.value.trim().length >= 4)
    ? filePassword.value.trim() : null;

  await saveToHistory({
    file_name: file.name,
    file_size: file.size,
    download_url: url,
    password,
    expiry: 'never',
    storage: 'supabase'
  });

  progressFill.style.width = '100%';
  statusEl.textContent = 'Done';
  statusEl.className = 'file-status status-success';
  linkInput.value = url;
  actions.hidden = false;
  wireActions(itemEl, url, file);
  if (password) {
    const note = itemEl.querySelector('.password-note');
    note.hidden = false;
    note.innerHTML = `🔒 ${password}`;
  }
}

function openPreview(file) {
  previewBody.innerHTML = '';
  const url = URL.createObjectURL(file);
  if (isImage(file.name)) {
    const img = document.createElement('img');
    img.src = url;
    previewBody.appendChild(img);
  } else if (isPdf(file.name)) {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    previewBody.appendChild(iframe);
  }
  previewModal.hidden = false;
}
function closePreview() {
  previewModal.hidden = true;
  previewBody.innerHTML = '';
}

async function processIncomingFiles(files) {
  if (!isAdmin || !files.length) return;

  if (zipMultiple.checked && files.length > 1 && typeof JSZip !== 'undefined') {
    const total = files.reduce((s, f) => s + f.size, 0);
    if (total > MAX_BYTES) {
      alert(`ZIP would be ${formatBytes(total)}. Max 50 MB per file on Supabase free plan.`);
      return;
    }
    const item = createFileItem({ name: 'archive.zip', size: total }, ' (zipping…)');
    try {
      const zip = new JSZip();
      for (const f of files) zip.file(f.webkitRelativePath || f.name, f);
      const blob = await zip.generateAsync({ type: 'blob' }, m => {
        item.querySelector('.progress-fill').style.width = Math.round(m.percent) + '%';
      });
      const zipFile = new File([blob], `DocVault_${Date.now()}.zip`, { type: 'application/zip' });
      if (zipFile.size > MAX_BYTES) {
        throw new Error(`ZIP is ${formatBytes(zipFile.size)}. Max 50 MB.`);
      }
      item.querySelector('.file-name').textContent = zipFile.name;
      item.querySelector('.file-meta').innerHTML = typeBadge(zipFile.name) + ' ' + formatBytes(zipFile.size);
      item.querySelector('.file-status').textContent = 'Uploading…';
      item.querySelector('.progress-fill').style.width = '0%';
      await uploadToSupabase(zipFile, item);
    } catch (e) {
      console.error(e);
      item.querySelector('.file-status').textContent = e.message || 'Failed';
      item.querySelector('.file-status').className = 'file-status status-error';
    }
    return;
  }

  for (const file of files) {
    const item = createFileItem(file);
    if (file.size > MAX_BYTES) {
      item.querySelector('.file-status').textContent = 'Too large (>50 MB)';
      item.querySelector('.file-status').className = 'file-status status-error';
      item.querySelector('.progress-fill').style.width = '100%';
      item.querySelector('.progress-fill').style.background = 'var(--danger)';
      continue;
    }
    try {
      await uploadToSupabase(file, item);
    } catch (err) {
      console.error(err);
      item.querySelector('.file-status').textContent = err.message || 'Failed';
      item.querySelector('.file-status').className = 'file-status status-error';
      item.querySelector('.progress-fill').style.background = 'var(--danger)';
      item.querySelector('.progress-fill').style.width = '100%';
    }
  }
}
