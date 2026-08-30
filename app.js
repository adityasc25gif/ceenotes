/**
 * DocVault – Admin upload only + Public download + Supabase history
 */

const SUPABASE_URL = 'https://ydexxymhtuoanntzjfgz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkZXh4eW1odHVvYW5udHpqZmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwNjU3OTAsImV4cCI6MjEwMzY0MTc5MH0.9mqb5QbrIDa-7vDBUW2QJwVOi-fF5uen765tmV8BJqY';

const GOFILE_TOKEN = 'bmp4F48x2ygw163r7UYZjCmKAelu8cNH';

// Change this password to your own secret
const ADMIN_PASSWORD = 'admin123';

let supabase = null;
let isAdmin = sessionStorage.getItem('docvault_admin') === '1';

if (SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
const browseBtn = document.getElementById('browseBtn');
const filesSection = document.getElementById('filesSection');
const filesList = document.getElementById('filesList');
const clearBtn = document.getElementById('clearBtn');
const themeToggle = document.getElementById('themeToggle');
const usePassword = document.getElementById('usePassword');
const filePassword = document.getElementById('filePassword');
const passwordRow = document.getElementById('passwordRow');
const zipMultiple = document.getElementById('zipMultiple');
const folderMode = document.getElementById('folderMode');
const expirySelect = document.getElementById('expirySelect');
const previewModal = document.getElementById('previewModal');
const previewBody = document.getElementById('previewBody');
const modalClose = document.getElementById('modalClose');
const modalBackdrop = document.getElementById('modalBackdrop');
const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');
const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
const adminOnlyArea = document.getElementById('adminOnlyArea');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const adminStatus = document.getElementById('adminStatus');
const loginBox = document.getElementById('loginBox');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const adminLoginSubmit = document.getElementById('adminLoginSubmit');
const loginError = document.getElementById('loginError');

function initTheme() {
  const saved = localStorage.getItem('docvault-theme') || 'dark';
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
    adminStatus.textContent = 'Admin mode (you can upload)';
    adminStatus.classList.add('admin-on');
  } else {
    adminOnlyArea.hidden = true;
    adminLoginBtn.hidden = false;
    adminLogoutBtn.hidden = true;
    loginBox.hidden = true;
    adminStatus.textContent = 'Public view (download only)';
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
adminPasswordInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') tryLogin();
});

function tryLogin() {
  if (adminPasswordInput.value === ADMIN_PASSWORD) {
    isAdmin = true;
    sessionStorage.setItem('docvault_admin', '1');
    updateAdminUI();
  } else {
    loginError.hidden = false;
  }
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
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
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
}

if (browseBtn) {
  browseBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (!isAdmin) return;
    if (folderMode.checked) folderInput.click();
    else fileInput.click();
  });
}
if (dropZone) {
  dropZone.addEventListener('click', e => {
    if (!isAdmin) return;
    if (e.target.closest('.options-bar') || e.target.closest('.password-row')) return;
    if (folderMode.checked) folderInput.click();
    else fileInput.click();
  });
}

if (fileInput) {
  fileInput.addEventListener('change', () => {
    if (!isAdmin) return;
    const files = [...fileInput.files];
    if (files.length) processIncomingFiles(files);
    fileInput.value = '';
  });
}
if (folderInput) {
  folderInput.addEventListener('change', () => {
    if (!isAdmin) return;
    const files = [...folderInput.files];
    if (files.length) processIncomingFiles(files);
    folderInput.value = '';
  });
}

if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    filesList.innerHTML = '';
    filesSection.hidden = true;
  });
}

modalClose.addEventListener('click', closePreview);
modalBackdrop.addEventListener('click', closePreview);
refreshHistoryBtn.addEventListener('click', loadHistory);

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

function getFileIcon(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map = {
    pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗',
    ppt: '📙', pptx: '📙', txt: '📄', md: '📄',
    zip: '🗜️', rar: '🗜️', '7z': '🗜️',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️',
    mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬', webm: '🎬',
    mp3: '🎵', wav: '🎵', flac: '🎵', json: '📋', csv: '📋'
  };
  return map[ext] || '📁';
}

function isImage(name) { return /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(name); }
function isPdf(name) { return /\.pdf$/i.test(name); }

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return Math.floor(sec / 60) + ' min ago';
  if (sec < 86400) return Math.floor(sec / 3600) + ' h ago';
  return Math.floor(sec / 86400) + ' d ago';
}

async function saveToHistory({ fileName, fileSize, downloadUrl, password, expiry }) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('uploads').insert({
      file_name: fileName,
      file_size: fileSize,
      download_url: downloadUrl,
      password: password || null,
      expiry: expiry || null
    });
    if (error) console.warn('History save failed:', error.message);
    else loadHistory();
  } catch (e) {
    console.warn('History save error', e);
  }
}

async function loadHistory() {
  if (!supabase) {
    historyEmpty.textContent = 'Supabase not configured.';
    historyEmpty.hidden = false;
    return;
  }
  try {
    const { data, error } = await supabase
      .from('uploads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    historyList.innerHTML = '';
    if (!data || data.length === 0) {
      historyEmpty.hidden = false;
      historyEmpty.textContent = 'No files yet.';
      return;
    }
    historyEmpty.hidden = true;

    data.forEach(row => {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.innerHTML = `
        <div class="file-header">
          <div class="file-icon">${getFileIcon(row.file_name)}</div>
          <div class="file-info">
            <div class="file-name" title="${row.file_name}">${row.file_name}</div>
            <div class="file-meta">${formatBytes(row.file_size)} · ${timeAgo(row.created_at)}</div>
          </div>
          <span class="file-status status-success">Ready</span>
        </div>
        <div class="file-actions">
          <input class="file-link" readonly value="${row.download_url || ''}" />
          <button class="btn-sm btn-copy">Copy</button>
          <button class="btn-sm secondary btn-qr">QR</button>
        </div>
        <div class="qr-box" hidden></div>
        ${row.password ? `<div class="password-note">🔒 Password: <strong>${row.password}</strong></div>` : ''}
        ${row.expiry && row.expiry !== 'never' ? `<div class="expiry-note">⏱️ Expiry: ${row.expiry} day(s)</div>` : ''}
      `;
      historyList.appendChild(item);

      const copyBtn = item.querySelector('.btn-copy');
      const qrBtn = item.querySelector('.btn-qr');
      const qrBox = item.querySelector('.qr-box');
      const link = row.download_url || '';

      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(link).then(() => {
          copyBtn.textContent = 'Copied!';
          copyBtn.classList.add('copied');
          setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 1800);
        });
      });

      qrBtn.addEventListener('click', () => {
        if (qrBox.hidden) {
          qrBox.hidden = false;
          qrBox.innerHTML = '';
          const canvas = document.createElement('canvas');
          qrBox.appendChild(canvas);
          QRCode.toCanvas(canvas, link, { width: 160, margin: 1 }, err => { if (err) console.error(err); });
        } else qrBox.hidden = true;
      });
    });
  } catch (e) {
    console.error(e);
    historyEmpty.hidden = false;
    historyEmpty.textContent = 'Could not load history. Check Supabase table.';
  }
}

loadHistory();

function createFileItem(file, extraLabel = '') {
  const item = document.createElement('div');
  item.className = 'file-item';
  item.innerHTML = `
    <div class="file-header">
      <div class="file-icon">${getFileIcon(file.name)}</div>
      <div class="file-info">
        <div class="file-name" title="${file.name}">${file.name}${extraLabel}</div>
        <div class="file-meta">${formatBytes(file.size)}</div>
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
    <div class="expiry-note" hidden></div>
  `;
  filesList.prepend(item);
  filesSection.hidden = false;
  return item;
}

async function getGoFileServer() {
  const res = await fetch('https://api.gofile.io/servers');
  if (!res.ok) throw new Error('Could not get upload server');
  const data = await res.json();
  if (data.status !== 'ok' || !data.data?.servers?.length) throw new Error('No servers');
  const servers = data.data.servers;
  return (servers.find(s => s.zone === 'eu') || servers[0]).name;
}

async function setContentOption(contentId, attribute, value) {
  try {
    const res = await fetch(`https://api.gofile.io/contents/${contentId}/update`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GOFILE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ attribute, attributeValue: value })
    });
    const data = await res.json();
    return data.status === 'ok';
  } catch (e) {
    return false;
  }
}

async function uploadToGoFile(file, itemEl) {
  if (!isAdmin) return;

  const statusEl = itemEl.querySelector('.file-status');
  const progressFill = itemEl.querySelector('.progress-fill');
  const actions = itemEl.querySelector('.file-actions');
  const linkInput = itemEl.querySelector('.file-link');
  const copyBtn = itemEl.querySelector('.btn-copy');
  const qrBtn = itemEl.querySelector('.btn-qr');
  const previewBtn = itemEl.querySelector('.btn-preview');
  const qrBox = itemEl.querySelector('.qr-box');
  const passNote = itemEl.querySelector('.password-note');
  const expNote = itemEl.querySelector('.expiry-note');

  const password = (usePassword.checked && filePassword.value.trim().length >= 4)
    ? filePassword.value.trim() : null;
  const expiryDays = expirySelect.value;

  try {
    const server = await getGoFileServer();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('token', GOFILE_TOKEN);

    const result = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://${server}.gofile.io/contents/uploadfile`);
      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) {
          progressFill.style.width = Math.round((e.loaded / e.total) * 100) + '%';
        }
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error('Invalid response')); }
        } else reject(new Error(`Upload failed (${xhr.status})`));
      });
      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.send(formData);
    });

    if (result.status !== 'ok' || !result.data) throw new Error(result.status || 'Upload failed');

    const data = result.data;
    const downloadPage = data.downloadPage
      || `https://gofile.io/d/${data.code || data.fileId || data.id}`;
    const contentId = data.fileId || data.id || data.parentFolder;

    progressFill.style.width = '100%';
    statusEl.textContent = 'Done';
    statusEl.className = 'file-status status-success';
    linkInput.value = downloadPage;
    actions.hidden = false;

    await saveToHistory({
      fileName: file.name,
      fileSize: file.size,
      downloadUrl: downloadPage,
      password,
      expiry: expiryDays
    });

    if (password && contentId) {
      const parentId = data.parentFolder || contentId;
      await setContentOption(parentId, 'password', password);
      passNote.hidden = false;
      passNote.innerHTML = `🔒 Password: <strong>${password}</strong>`;
    }

    if (expiryDays !== 'never' && contentId) {
      const seconds = parseInt(expiryDays, 10) * 24 * 60 * 60;
      const expiryTimestamp = Math.floor(Date.now() / 1000) + seconds;
      const parentId = data.parentFolder || contentId;
      await setContentOption(parentId, 'expiry', expiryTimestamp);
      expNote.hidden = false;
      expNote.innerHTML = `⏱️ Expiry: <strong>${expiryDays} day(s)</strong>`;
    }

