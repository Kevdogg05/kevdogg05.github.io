// Community uploads: drag-and-drop clips, check type / size / length in the
// browser before anything is sent, then upload (CONFIG.uploadEndpoint) or
// hand off to email.
import { CONFIG } from './config.js';
import { createStore } from './store.js';
import { $, esc, icon, validate, isEmail, mailto, showResult, toast } from './ui.js';

const MAX_FILES = 3;
const MAX_BYTES = 250 * 1024 * 1024;
const MAX_SECONDS = 180;
const TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
const EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v'];

const formatBytes = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const formatSeconds = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

// Reads the clip's duration; rejects if the browser can't decode it.
function probe(url) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const timer = setTimeout(() => reject(new Error('timeout')), 10000);
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => { clearTimeout(timer); resolve(video.duration); };
    video.onerror = () => { clearTimeout(timer); reject(new Error('decode')); };
    video.src = url;
  });
}

export async function checkFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!TYPES.includes(file.type) && !EXTENSIONS.includes(ext)) return { error: 'Not a supported video — use MP4, MOV or WebM.' };
  if (file.size > MAX_BYTES) return { error: `Too large (${formatBytes(file.size)}) — the limit is 250 MB.` };
  if (file.size < 10 * 1024) return { error: 'This file looks empty.' };
  const url = URL.createObjectURL(file);
  try {
    const seconds = await probe(url);
    if (!Number.isFinite(seconds)) return { url, seconds: null };
    if (seconds > MAX_SECONDS) return { url, seconds, error: `Too long (${formatSeconds(seconds)}) — keep clips under 3 minutes.` };
    if (seconds < 3) return { url, seconds, error: 'Too short — send at least 3 seconds.' };
    return { url, seconds };
  } catch {
    // Some phones save HEVC .mov files this browser can't preview; let the team review them.
    return { url, seconds: null, warning: "Can't preview here — we'll still review it." };
  }
}

export function initUploads() {
  const queue = createStore([]);
  const form = $('#upload-form');
  const zone = $('#dropzone');
  const input = $('#file-input');
  const list = $('#file-queue');
  let nextId = 1;

  queue.subscribe((items) => {
    list.innerHTML = items.map((f) => `<li class="file ${f.status}">
      <div class="file-thumb">${f.url && f.status !== 'error' ? `<video src="${f.url}#t=0.5" muted playsinline preload="metadata"></video>` : icon('film')}</div>
      <div class="file-info">
        <strong>${esc(f.file.name)}</strong>
        <span>${formatBytes(f.file.size)}${f.seconds ? ` · ${formatSeconds(f.seconds)}` : ''}</span>
        <span class="file-status">${f.status === 'checking' ? 'Checking…'
          : f.status === 'error' ? `${icon('close')} ${esc(f.error)}`
          : `${icon('check')} ${esc(f.warning || 'Ready to submit')}`}</span>
      </div>
      <button type="button" class="icon-btn" data-remove="${f.id}" aria-label="Remove ${esc(f.file.name)}">${icon('trash')}</button>
    </li>`).join('');
    zone.classList.toggle('is-full', items.length >= MAX_FILES);
  });

  async function addFiles(files) {
    const room = MAX_FILES - queue.get().length;
    if (!room) { toast(`Up to ${MAX_FILES} clips at a time.`, 'error'); return; }
    const picked = [...files].slice(0, room);
    if (files.length > room) toast(`Only the first ${room} clip${room > 1 ? 's were' : ' was'} added — ${MAX_FILES} max.`, 'error');
    const entries = picked.map((file) => ({ id: nextId++, file, status: 'checking' }));
    queue.set((q) => [...q, ...entries]);
    await Promise.all(entries.map(async (entry) => {
      const result = await checkFile(entry.file);
      queue.set((q) => q.map((x) => (x.id === entry.id ? { ...x, ...result, status: result.error ? 'error' : 'ready' } : x)));
    }));
  }

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.remove('is-over'); }));
  zone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
  // A clip dropped just outside the zone shouldn't navigate away from the page.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    const id = Number(btn.dataset.remove);
    const gone = queue.get().find((x) => x.id === id);
    if (gone?.url) URL.revokeObjectURL(gone.url);
    queue.set((q) => q.filter((x) => x.id !== id));
  });

  const caption = $('#up-caption');
  caption.addEventListener('input', () => { $('#caption-count').textContent = `${caption.value.length}/200`; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const result = $('#upload-result');
    result.hidden = true;
    const items = queue.get();
    if (items.some((f) => f.status === 'checking')) { toast('Still checking your clips — one moment.'); return; }
    const ready = items.filter((f) => f.status === 'ready');
    const ok = validate(form, {
      'up-name': (v) => (v ? '' : 'Tell us who to credit.'),
      'up-email': (v) => (!v ? 'We need an email to reach you.' : isEmail(v) ? '' : 'That email doesn’t look right.'),
      'up-consent': (v) => (v ? '' : 'Please confirm you have permission to share this clip.'),
    });
    if (!ready.length) {
      zone.classList.add('is-shake');
      setTimeout(() => zone.classList.remove('is-shake'), 500);
      toast(items.length ? 'Remove the clips with errors, or add a valid one.' : 'Add at least one clip first.', 'error');
      return;
    }
    if (!ok) return;

    const data = new FormData(form);
    if (!CONFIG.uploadEndpoint) {
      const names = ready.map((f) => `- ${f.file.name} (${formatBytes(f.file.size)})`).join('\n');
      const body = `Name / handle: ${data.get('name')}\nEmail: ${data.get('email')}\nType: ${data.get('type')}\nCaption: ${data.get('caption') || '—'}\n\nClips (attached):\n${names}\n\nI confirm I own these clips, everyone in them is 18+ and agrees to be featured.`;
      showResult(result, `<strong>${icon('check')} Your ${ready.length > 1 ? 'clips passed' : 'clip passed'} every check.</strong>
        <p>Send ${ready.length > 1 ? 'them' : 'it'} our way: open the pre-filled email, attach your ${ready.length > 1 ? 'clips' : 'clip'} and hit send — or DM ${esc(CONFIG.handle)} on Instagram.</p>
        <div class="result-actions"><a class="btn btn-gem btn-sm" href="${mailto('Community clip submission', body)}">${icon('mail')} Open email</a>
        <a class="btn btn-ghost btn-sm" href="${esc(CONFIG.socials.instagram)}" target="_blank" rel="noopener">${icon('instagram')} DM on Instagram</a></div>`);
      return;
    }

    ready.forEach((f) => data.append('clips', f.file, f.file.name));
    const bar = $('#upload-progress');
    const submit = $('#upload-submit');
    bar.hidden = false;
    submit.disabled = true;
    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', CONFIG.uploadEndpoint);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) bar.firstElementChild.style.width = `${(ev.loaded / ev.total) * 100}%`; };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(xhr.status)));
        xhr.onerror = () => reject(new Error('network'));
        xhr.send(data);
      });
      ready.forEach((f) => f.url && URL.revokeObjectURL(f.url));
      queue.set([]);
      form.reset();
      showResult(result, `<strong>${icon('check')} Uploaded!</strong><p>Our team reviews every clip — watch your inbox and our page for features.</p>`);
    } catch {
      showResult(result, `<strong>Upload didn't go through.</strong><p>Check your connection and try again.</p>`, 'error');
    } finally {
      bar.hidden = true;
      bar.firstElementChild.style.width = '0';
      submit.disabled = false;
    }
  });
}
