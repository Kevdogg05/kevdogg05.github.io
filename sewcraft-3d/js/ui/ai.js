// Ask SewCraft AI — optional. Sends the user's description and photos to
// Claude with the SewCraft persona, using the user's own Anthropic API key,
// straight from the browser. Nothing goes through any other server.
import { systemPrompt } from '../ai/persona.js';
import { TEMPLATES } from '../templates/index.js';
import { getMaterial } from '../data/materials.js';
import { fmtLen } from '../engine/units.js';
import { downscale } from './projectPanel.js';
import { $, esc, store } from './dom.js';

// The official SDK as a browser ES module; esm.sh is the backup CDN.
const SDK_URLS = ['https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm', 'https://esm.sh/@anthropic-ai/sdk@0.131.0'];
const MARKED_URL = 'https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.esm.js';
const PURIFY_URL = 'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs';

// USD per million tokens (input, output) — for the per-answer cost readout.
const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — most thorough', price: [4, 20], fallbacks: true },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — faster, cheaper', price: [2, 10], fallbacks: true },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — quick answers', price: [0.1, 0.5], fallbacks: false },
];
const KEY_STORE = 'sewcraft3d.anthropicKey';
const MAX_PHOTOS = 4;

let sdk = null;
function loadSdk() {
  if (!sdk) {
    sdk = (async () => {
      let last;
      for (const url of SDK_URLS) {
        try {
          return await import(url);
        } catch (err) {
          last = err;
        }
      }
      sdk = null;
      throw last;
    })();
  }
  return sdk;
}

let libs = null;
async function loadLibs() {
  if (!libs) {
    libs = Promise.all([import(MARKED_URL), import(PURIFY_URL)]).then(([m, p]) => {
      const DOMPurify = p.default;
      // Links in answers open in a new tab, without access to this page.
      DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName === 'A') {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }
      });
      return { marked: m.marked, DOMPurify };
    });
  }
  return libs;
}

export function initAI(el, app) {
  const state = {
    history: [],
    photos: app.photo ? [app.photo] : [],
    busy: false,
    controller: null,
  };
  const savedKey = store.get(KEY_STORE, '');

  el.innerHTML = `
    <h2 class="section-title"><span class="stage ai">✦</span>Ask SewCraft AI</h2>
    <p class="section-lead">Describe any project — or add photos of a sketch, a finished piece or the fabric — and SewCraft answers with the full four-stage workflow for your 315R and 2206RB. If it matches a built-in template, one click loads it into the 3D builder. This runs on Claude using <strong>your own Anthropic API key</strong>, sent directly from this page to Anthropic.</p>
    <div class="ai-grid">
      <div class="card">
        <h3>API key</h3>
        <div class="field">
          <label for="ai-key">Anthropic API key</label>
          <input type="password" id="ai-key" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" value="${esc(savedKey)}">
        </div>
        <label class="toggle"><span>Remember on this device</span><input type="checkbox" id="ai-remember"${savedKey ? ' checked' : ''}></label>
        <p class="small muted" style="margin:4px 0 12px">The key goes only to api.anthropic.com. "Remember" stores it in this browser's local storage, where browser extensions can read it — use a key with a monthly spend limit. <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Create a key</a>.</p>
        <div class="field">
          <label for="ai-model">Model</label>
          <select id="ai-model">${MODELS.map((m) => `<option value="${m.id}">${esc(m.label)}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label for="ai-effort">Depth</label>
          <select id="ai-effort">
            <option value="low">Low — fast, brief</option>
            <option value="medium">Medium</option>
            <option value="high" selected>High — full technical detail</option>
          </select>
        </div>
        <h3 style="margin-top:16px">Your project</h3>
        <div class="field">
          <label for="ai-text">Description or question</label>
          <textarea id="ai-text" rows="5" placeholder="e.g. A dopp kit in 1000D Cordura, about 10 × 5 × 5 in, U-shaped zipper top, end handle, lined with 210D."></textarea>
        </div>
        <label class="photo-drop">
          <span>📷 Add photos (up to ${MAX_PHOTOS}) — sketches, a finished piece, or close-ups of the fabric</span>
          <input type="file" id="ai-photos" accept="image/*" multiple aria-label="Add photos">
        </label>
        <div class="ai-thumbs" id="ai-thumbs"></div>
        <label class="toggle" style="margin-top:8px"><span>Include the project open in the builder</span><input type="checkbox" id="ai-ctx" checked></label>
        <div class="chips" style="gap:8px;margin-top:10px">
          <button type="button" class="btn primary" id="ai-send">Ask SewCraft</button>
          <button type="button" class="btn ghost" id="ai-stop" hidden>Stop</button>
          <button type="button" class="btn ghost" id="ai-new">New conversation</button>
        </div>
        <p class="small muted" id="ai-meta" style="margin:10px 0 0">Each answer is billed to your Anthropic account; the cost appears under the answer.</p>
      </div>
      <div class="card ai-out" id="ai-out" aria-live="polite">
        <p class="muted">Answers appear here. Try: <em>“Marine vinyl helm seat cushion, 22 × 18 × 4 with welt — which machine for which seam?”</em></p>
      </div>
    </div>`;

  const keyIn = $('#ai-key', el);
  const remember = $('#ai-remember', el);
  const out = $('#ai-out', el);
  const sendBtn = $('#ai-send', el);
  const stopBtn = $('#ai-stop', el);

  const saveKey = () => {
    if (remember.checked && keyIn.value.trim()) store.set(KEY_STORE, keyIn.value.trim());
    else store.remove(KEY_STORE);
  };
  keyIn.addEventListener('change', saveKey);
  remember.addEventListener('change', saveKey);

  const renderThumbs = () => {
    const box = $('#ai-thumbs', el);
    box.replaceChildren();
    state.photos.forEach((src, i) => {
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      img.src = src;
      img.alt = `Photo ${i + 1}`;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.textContent = '×';
      rm.setAttribute('aria-label', `Remove photo ${i + 1}`);
      rm.addEventListener('click', () => {
        state.photos.splice(i, 1);
        renderThumbs();
      });
      fig.append(img, rm);
      box.append(fig);
    });
  };
  renderThumbs();

  $('#ai-photos', el).addEventListener('change', async (e) => {
    for (const f of [...e.target.files].slice(0, MAX_PHOTOS - state.photos.length)) {
      try {
        state.photos.push(await downscale(f, 1568));
      } catch (err) {
        showError(out, err.message);
      }
    }
    e.target.value = '';
    renderThumbs();
  });

  $('#ai-new', el).addEventListener('click', () => {
    state.controller?.abort();
    state.history = [];
    out.innerHTML = '<p class="muted">New conversation.</p>';
    sendBtn.textContent = 'Ask SewCraft';
  });
  stopBtn.addEventListener('click', () => state.controller?.abort());

  sendBtn.addEventListener('click', async () => {
    if (state.busy) return;
    const key = keyIn.value.trim();
    const text = $('#ai-text', el).value.trim();
    if (!key) return showError(out, 'Add your Anthropic API key first.', true);
    if (!text && !state.photos.length) return showError(out, 'Describe the project or add a photo.', true);
    saveKey();
    state.busy = true;
    sendBtn.disabled = true;
    stopBtn.hidden = false;
    try {
      await ask(app, el, state, {
        key,
        text,
        model: $('#ai-model', el).value,
        effort: $('#ai-effort', el).value,
        withContext: $('#ai-ctx', el).checked && state.history.length === 0,
      });
      $('#ai-text', el).value = '';
      state.photos = [];
      renderThumbs();
      sendBtn.textContent = 'Send follow-up';
    } finally {
      state.busy = false;
      sendBtn.disabled = false;
      stopBtn.hidden = true;
    }
  });

  return {
    addPhoto(src) {
      if (src && state.photos.length < MAX_PHOTOS && !state.photos.includes(src)) {
        state.photos.push(src);
        renderThumbs();
      }
    },
  };
}

function projectContext(app) {
  const p = app.plan;
  if (!p) return '';
  const pr = p.project;
  const dims = p.template.dims.map((d) => `${d.label}: ${d.count ? pr.dims[d.key] : fmtLen(pr.dims[d.key], 'in')}`).join(', ');
  const setup = p.steps
    .filter((s) => s.setup)
    .map((s) => `${s.index + 1}. ${s.title} — ${s.setup.machineName}, Tex ${s.setup.tex}, ${s.setup.spi} SPI, stack ${s.setup.stackMm.toFixed(1)} mm`)
    .join('\n');
  return `[Project currently open in the SewCraft 3D builder]\nTemplate: ${p.template.name} (${p.template.id}). ${dims}. Options: ${JSON.stringify(pr.options)}. Main fabric: ${p.mat.name}${p.lin ? `; lining: ${p.lin.name}` : ''}.\nThe app's machine plan:\n${setup}\n[End of builder context]`;
}

async function ask(app, el, state, { key, text, model, effort, withContext }) {
  const out = $('#ai-out', el);
  if (!state.history.length) out.replaceChildren();
  const userBlocks = [];
  for (const src of state.photos) {
    const [head, data] = src.split(',');
    const media = head.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
    userBlocks.push({ type: 'image', source: { type: 'base64', media_type: media, data } });
  }
  const ctxText = withContext ? projectContext(app) : '';
  userBlocks.push({ type: 'text', text: [ctxText, text || 'Here are photos of my project. Please run the SewCraft protocol.'].filter(Boolean).join('\n\n') });
  state.history.push({ role: 'user', content: userBlocks });

  const userEcho = document.createElement('div');
  userEcho.className = 'ai-msg user';
  userEcho.textContent = `You: ${text || '(photos)'}${state.photos.length ? ` · ${state.photos.length} photo${state.photos.length > 1 ? 's' : ''}` : ''}`;
  out.append(userEcho);

  const msg = document.createElement('div');
  msg.className = 'ai-msg';
  msg.innerHTML = '<div class="ai-status"><span class="dot pulse"></span><span class="st">Loading the Anthropic SDK…</span></div><details class="thinking" hidden><summary>Reasoning summary</summary><div class="th"></div></details><div class="md"></div><div class="handoff"></div><p class="small muted cost"></p>';
  out.append(msg);
  const status = msg.querySelector('.st');
  const statusRow = msg.querySelector('.ai-status');
  const mdEl = msg.querySelector('.md');
  const thinkBox = msg.querySelector('details');
  const thinkEl = msg.querySelector('.th');

  let Anthropic;
  let render;
  try {
    const [mod, { marked, DOMPurify }] = await Promise.all([loadSdk(), loadLibs()]);
    Anthropic = mod.default;
    render = (md) => DOMPurify.sanitize(marked.parse(stripBuild(md)));
  } catch (err) {
    state.history.pop();
    statusRow.remove();
    showError(msg, `Could not load the AI libraries from the CDN (${err.message}). Check your connection and try again.`);
    return;
  }

  const m = MODELS.find((x) => x.id === model) || MODELS[0];
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  const params = {
    model: m.id,
    max_tokens: 32000,
    system: systemPrompt(),
    cache_control: { type: 'ephemeral' },
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort },
    messages: state.history,
  };
  state.controller = new AbortController();
  let text_ = '';
  let thinking = '';
  let fellBack = false;
  let raf = 0;
  const flush = () => {
    raf = 0;
    mdEl.innerHTML = render(text_);
    if (thinking) {
      thinkBox.hidden = false;
      thinkEl.textContent = thinking;
    }
  };
  try {
    status.textContent = 'Thinking…';
    // Server-side fallback re-runs a declined request on Anthropic's recommended model.
    const stream = m.fallbacks
      ? client.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, { signal: state.controller.signal })
      : client.messages.stream(params, { signal: state.controller.signal });
    for await (const event of stream) {
      if (event.type === 'content_block_start' && event.content_block.type === 'fallback') fellBack = true;
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          text_ += event.delta.text;
          status.textContent = 'Writing…';
        } else if (event.delta.type === 'thinking_delta') {
          thinking += event.delta.thinking;
        }
        if (!raf) raf = requestAnimationFrame(flush);
      }
    }
    const final = await stream.finalMessage();
    cancelAnimationFrame(raf);
    statusRow.remove();
    if (final.stop_reason === 'refusal') {
      state.history.pop();
      mdEl.innerHTML = '';
      showError(msg, 'Claude declined this request. Try rephrasing the project description.');
      return;
    }
    text_ = final.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    flush();
    state.history.push({ role: 'assistant', content: echoContent(final.content) });
    if (final.stop_reason === 'max_tokens') showError(msg, 'The answer hit the length limit and was cut off — ask a follow-up such as “continue from Stage 3”.');
    const u = final.usage || {};
    const inTok = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1;
    const cost = (inTok * m.price[0] + (u.output_tokens || 0) * m.price[1]) / 1e6;
    msg.querySelector('.cost').textContent = `${final.model}${fellBack ? ' (fallback model)' : ''} · ${u.input_tokens ?? 0} in + ${u.output_tokens ?? 0} out tokens · ≈ $${cost.toFixed(cost < 0.01 ? 4 : 2)}`;
    offerHandoff(app, msg.querySelector('.handoff'), text_);
  } catch (err) {
    cancelAnimationFrame(raf);
    statusRow.remove();
    state.history.pop();
    showError(msg, explain(err, Anthropic));
  } finally {
    state.controller = null;
  }
}

/** Keep the assistant turn replayable: drop fallback markers and pre-fallback non-text blocks. */
function echoContent(content) {
  const last = content.map((b) => b.type).lastIndexOf('fallback');
  return content.filter((b, i) => b.type !== 'fallback' && (i > last || b.type === 'text'));
}

function explain(err, Anthropic) {
  if (err?.name === 'AbortError' || (Anthropic && err instanceof Anthropic.APIUserAbortError)) return 'Stopped.';
  if (Anthropic) {
    if (err instanceof Anthropic.AuthenticationError) return 'That API key was rejected. Check it in the Anthropic Console.';
    if (err instanceof Anthropic.PermissionDeniedError) return 'This key does not have access to that model.';
    if (err instanceof Anthropic.RateLimitError) return 'Rate limited — wait a minute and try again.';
    if (err instanceof Anthropic.BadRequestError) return `Request rejected: ${err.message}`;
    if (err instanceof Anthropic.InternalServerError) return 'Anthropic had a server error — try again shortly.';
    if (err instanceof Anthropic.APIConnectionError) return 'Could not reach api.anthropic.com. Check your connection.';
    if (err instanceof Anthropic.APIError) return `API error ${err.status ?? ''}: ${err.message}`;
  }
  return `Something went wrong: ${err?.message || err}`;
}

function stripBuild(md) {
  return md.replace(/```sewcraft-build[\s\S]*?(```|$)/g, '');
}

/** Turn a sewcraft-build block into a "load into the builder" button. */
function offerHandoff(app, box, md) {
  const m = md.match(/```sewcraft-build\s*([\s\S]*?)```/);
  if (!m) return;
  let spec;
  try {
    spec = JSON.parse(m[1]);
  } catch {
    return;
  }
  const tpl = TEMPLATES[spec.template];
  if (!tpl) return;
  const mat = getMaterial(spec.material);
  const dims = tpl.dims
    .filter((d) => Number.isFinite(Number(spec.dims?.[d.key])))
    .map((d) => `${d.label.toLowerCase()} ${d.count ? spec.dims[d.key] : fmtLen(Number(spec.dims[d.key]), 'in')}`)
    .join(', ');
  const wrap = document.createElement('div');
  wrap.className = 'callout cyan build-handoff';
  const label = document.createElement('span');
  label.textContent = `Suggested build: ${tpl.name}${dims ? ` · ${dims}` : ''} · ${mat.name}`;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn primary';
  btn.textContent = 'Load into the 3D builder';
  btn.addEventListener('click', () =>
    app.loadProject({
      template: tpl.id,
      dims: spec.dims || {},
      options: spec.options || {},
      material: spec.material,
      lining: spec.lining || 'none',
      colors: {},
    })
  );
  wrap.append(label, btn);
  box.append(wrap);
}

function showError(root, message, transient = false) {
  const p = document.createElement('div');
  p.className = 'callout red';
  p.textContent = message;
  root.append(p);
  if (transient) setTimeout(() => p.remove(), 5000);
}
