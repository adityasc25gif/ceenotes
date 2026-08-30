/**
 * DocVault – GoFile uploader (with your account token)
 */

const GOFILE_TOKEN = 'bmp4F48x2ygw163r7UYZjCmKAelu8cNH';

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

usePassword.addEventListener('change', () => {
  passwordRow.hidden = !usePassword.checked;
  if (usePassword.checked) filePassword.focus();
});

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
  dropZone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); });
});
dropZone.addEventListener('dragenter', () => dropZone.classList.add('dragover'));
dropZone.addEventListener('dragover', () => dropZone.classList.add('dragover'));
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  dropZone.classList.remove('dragover');
  const files = [...e.dataTransfer.files];
  if (files.length) processIncomingFiles(files);
});

browseBtn.addEventListener('click', e => {
  e.stopPropagation();
  if (folderMode.checked) folderInput.click();
  else fileInput.click();
});
dropZone.addEventListener('click', e => {
  if (e.target.closest('.options-bar') || e.target.closest('.password-row')) return;
  if (folderMode.checked) folderInput.click();
  else fileInput.click();
});

fileInput.addEventListener('change', () => {
  const files = [...fileInput.files];
  if (files.length) processIncomingFiles(files);
  fileInput.value = '';
});
folderInput.addEventListener('change', () => {
  const files = [...folderInput.files];
  if (files.length) processIncomingFiles(files);
  folderInput.value = '';
});

clearBtn.addEventListener('click', () => {
  filesList.innerHTML = '';
  filesSection.hidden = true;
});

modalClose.addEventListener('click', closePreview);
modalBackdrop.addEventListener('click', closePreview);

function formatBytes(bytes) {
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

function isImage(name) {
  return /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(name);
}
function isPdf(name) {
  return /\.pdf$/i.test(name);
}

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
    console.warn('Could not set option:', attribute, e);
    return false;
  }
}

async function uploadToGoFile(file, itemEl) {
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

    if (password && contentId) {
      const parentId = data.parentFolder || contentId;
      const ok = await setContentOption(parentId, 'password', password);
      if (ok) {
        passNote.hidden = false;
        passNote.innerHTML = `🔒 Password set: <strong>${password}</strong>`;
      } else {
        passNote.hidden = false;
        passNote.innerHTML = `🔒 Password requested: <strong>${password}</strong><br>
          Open the link → ⚙️ → set password if needed.`;
      }
    }

    if (expiryDays !== 'never' && contentId) {
      const seconds = parseInt(expiryDays, 10) * 24 * 60 * 60;
      const expiryTimestamp = Math.floor(Date.now() / 1000) + seconds;
      const parentId = data.parentFolder || contentId;
      const ok = await setContentOption(parentId, 'expiry', expiryTimestamp);
      if (ok) {
        expNote.hidden = false;
        expNote.innerHTML = `⏱️ Expiry set: <strong>${expiryDays} day(s)</strong>`;
      } else {
        expNote.hidden = false;
        expNote.innerHTML = `⏱️ Requested expiry: <strong>${expiryDays} day(s)</strong>`;
      }
    }

    if (isImage(file.name) || isPdf(file.name)) {
      previewBtn.hidden = false;
      previewBtn.addEventListener('click', () => openPreview(file));
    }

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(downloadPage).then(() => {
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
        QRCode.toCanvas(canvas, downloadPage, { width: 160, margin: 1 }, err => {
          if (err) console.error(err);
        });
      } else {
        qrBox.hidden = true;
      }
    });

  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Failed';
    statusEl.className = 'file-status status-error';
    progressFill.style.background = 'var(--danger)';
    progressFill.style.width = '100%';
  }
}

function openPreview(file) {
  previewBody.innerHTML = '';
  if (isImage(file.name)) {
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.src = url;
    img.alt = file.name;
    previewBody.appendChild(img);
  } else if (isPdf(file.name)) {
    const url = URL.createObjectURL(file);
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
  if (!files.length) return;

  if (zipMultiple.checked && files.length > 1 && typeof JSZip !== 'undefined') {
    const item = createFileItem({ name: 'archive.zip', size: 0 }, ' (creating…)');
    const statusEl = item.querySelector('.file-status');
    const progressFill = item.querySelector('.progress-fill');
    const meta = item.querySelector('.file-meta');

    try {
      const zip = new JSZip();
      let total = 0;
      for (const f of files) {
        zip.file(f.webkitRelativePath || f.name, f);
        total += f.size;
      }
      meta.textContent = formatBytes(total) + ' → zipping…';

      const blob = await zip.generateAsync({ type: 'blob' }, meta => {
        progressFill.style.width = Math.round(meta.percent) + '%';
      });

      const zipFile = new File([blob], `DocVault_${Date.now()}.zip`, { type: 'application/zip' });
      item.querySelector('.file-name').textContent = zipFile.name;
      meta.textContent = formatBytes(zipFile.size);
      statusEl.textContent = 'Uploading…';
      progressFill.style.width = '0%';

      await uploadToGoFile(zipFile, item);
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'ZIP failed';
      statusEl.className = 'file-status status-error';
    }
    return;
  }

  files.forEach(file => {
    const item = createFileItem(file);
    uploadToGoFile(file, item);
  });
}
