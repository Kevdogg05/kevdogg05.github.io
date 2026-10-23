// LIVE: weekly class schedule (written in the studio's time zone, shown in
// the visitor's), RSVPs, calendar downloads, a countdown stage that switches
// to the stream during class, and the chat / reactions overlay.
import { CONFIG } from './config.js';
import { CLASSES, EVENTS, CHAT_SEED } from './data.js';
import { createStore } from './store.js';
import { member } from './state.js';
import { $, $$, esc, icon, setupTabs, toast, downloadFile, reducedMotion } from './ui.js';

const DAY_MS = 86400000;
const PLATFORM = {
  zoom: { label: 'Zoom', icon: 'zoom' },
  ig: { label: 'IG Live', icon: 'instagram' },
};

// ---- Time zone math (no library) -------------------------------------------
const partsCache = new Map();
function zoneParts(date, timeZone) {
  let fmt = partsCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    partsCache.set(timeZone, fmt);
  }
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, Number(x.value)]));
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute, s: p.second };
}

function zoneOffset(date, timeZone) {
  const p = zoneParts(date, timeZone);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

// Wall-clock time in `timeZone` → real instant.
export function zonedTime(y, m, d, h, min, timeZone) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let ts = guess - zoneOffset(new Date(guess), timeZone);
  const second = zoneOffset(new Date(ts), timeZone);
  ts = guess - second;
  return new Date(ts);
}

// Next occurrences of the weekly classes, starting today in the studio's zone.
export function upcomingSessions(now = new Date(), days = 14) {
  const tz = CONFIG.timezone;
  const today = zoneParts(now, tz);
  const sessions = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    const weekday = day.getUTCDay();
    for (const c of CLASSES) {
      if (c.day !== weekday) continue;
      const [h, min] = c.time.split(':').map(Number);
      const start = zonedTime(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), h, min, tz);
      const end = new Date(start.getTime() + c.minutes * 60000);
      if (end <= now) continue;
      sessions.push({ ...c, key: `${c.id}@${day.toISOString().slice(0, 10)}`, start, end });
    }
  }
  return sessions.sort((a, b) => a.start - b.start);
}

// ---- Formatting -----------------------------------------------------------
const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const fmtDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const fmtMonth = new Intl.DateTimeFormat(undefined, { month: 'short' });
const fmtTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const fmtFull = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtTz = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' });

const tzName = (d = new Date()) => fmtTz.formatToParts(d).find((p) => p.type === 'timeZoneName')?.value || '';

export function relativeWhen(start, now = new Date()) {
  const startDay = new Date(start); startDay.setHours(0, 0, 0, 0);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const diff = Math.round((startDay - today) / DAY_MS);
  const time = fmtTime.format(start);
  if (diff === 0) return `today at ${time}`;
  if (diff === 1) return `tomorrow at ${time}`;
  if (diff < 7) return `${fmtDay.format(start)} at ${time}`;
  return `${fmtDate.format(start)} at ${time}`;
}

function splitCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
}

// ---- Calendar file --------------------------------------------------------
const icsStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

export function buildIcs({ key, title, start, end, platform, blurb }) {
  const where = platform === 'zoom' ? (CONFIG.zoomUrl || 'Zoom — link emailed before class') : `Instagram Live ${CONFIG.handle}`;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Road Queen Fitness//Live Classes//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${key}@roadqueenfitness`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsText(`Road Queen Fitness · ${title}`)}`,
    `DESCRIPTION:${icsText(`${blurb}\n\n${CONFIG.siteUrl}#live`)}`,
    `LOCATION:${icsText(where)}`,
    `URL:${CONFIG.siteUrl}#live`,
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(`${title} starts in 30 minutes`)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}

// ---- UI ---------------------------------------------------------------------
export function initLive() {
  const rsvps = createStore([], 'rsvps');
  const filter = createStore('all');
  let sessions = upcomingSessions();

  $('#viewer-tz').textContent = `your time zone (${tzName()})`;

  const joinHref = (s) => (s.platform === 'zoom' ? CONFIG.zoomUrl : CONFIG.socials.instagram);

  function sessionRow(s, now) {
    const going = rsvps.get().includes(s.key);
    const live = s.start <= now && now < s.end;
    const p = PLATFORM[s.platform];
    return `<li class="session ${live ? 'is-live' : ''} ${going ? 'is-going' : ''}">
      <div class="session-date"><span>${fmtDay.format(s.start)}</span><strong>${s.start.getDate()}</strong><small>${fmtMonth.format(s.start)}</small></div>
      <div class="session-info">
        <p class="session-title">${live ? '<span class="live-tag">Live now</span>' : ''}${esc(s.title)}</p>
        <p class="session-meta">${icon('clock')} ${fmtTime.format(s.start)} · ${s.minutes} min <span class="platform-tag ${s.platform}">${icon(p.icon)} ${p.label}</span></p>
        <p class="session-level">${esc(s.level)} — ${esc(s.blurb)}</p>
      </div>
      <div class="session-actions">
        ${live && joinHref(s)
          ? `<a class="btn btn-gem btn-sm" href="${esc(joinHref(s))}" target="_blank" rel="noopener">Join now</a>`
          : `<button type="button" class="btn btn-sm ${going ? 'btn-going' : 'btn-ghost'}" data-rsvp="${s.key}" aria-pressed="${going}">
              ${going ? `${icon('check')} Going` : 'RSVP'}</button>`}
        <button type="button" class="icon-btn" data-ics="${s.key}" aria-label="Add ${esc(s.title)} on ${fmtFull.format(s.start)} to your calendar" title="Add to calendar">${icon('calendar')}</button>
      </div>
    </li>`;
  }

  function renderList() {
    const now = new Date();
    const f = filter.get();
    const going = rsvps.get();
    const list = sessions.filter((s) => (f === 'all' ? true : f === 'rsvp' ? going.includes(s.key) : s.platform === f));
    $('#session-list').innerHTML = list.length
      ? list.map((s) => sessionRow(s, now)).join('')
      : `<li class="empty">${f === 'rsvp' ? 'No RSVPs yet — tap RSVP on any class to save your spot.' : 'No classes in this view.'}</li>`;
    const last = sessions[sessions.length - 1];
    $('#schedule-range').textContent = sessions.length ? `Next two weeks · through ${fmtDate.format(last.start)}` : '';
    $('#rsvp-count').textContent = going.filter((k) => sessions.some((s) => s.key === k)).length;
  }

  setupTabs($('#schedule-tabs'), (tab) => filter.set(tab.dataset.filter));
  filter.subscribe(renderList);
  rsvps.subscribe(renderList);

  function toggleRsvp(key) {
    const s = sessions.find((x) => x.key === key);
    if (!s) return;
    const going = rsvps.get().includes(key);
    rsvps.set((list) => (going ? list.filter((k) => k !== key) : [...list, key]));
    if (going) toast(`RSVP removed for ${s.title}.`);
    else if (s.platform === 'zoom' && !CONFIG.zoomUrl && !member.get()) toast(`You're in! Sign up under Join Us so we can email you the Zoom link.`, 'success');
    else if (s.platform === 'zoom' && !CONFIG.zoomUrl) toast(`You're in! The Zoom link is emailed before ${s.title}.`, 'success');
    else toast(`You're in for ${s.title}, ${relativeWhen(s.start)}.`, 'success');
    renderStage();
  }

  document.addEventListener('click', (e) => {
    const rsvp = e.target.closest('[data-rsvp]');
    if (rsvp) toggleRsvp(rsvp.dataset.rsvp);
    const ics = e.target.closest('[data-ics]');
    if (ics) {
      const s = sessions.find((x) => x.key === ics.dataset.ics);
      if (s) {
        downloadFile(`road-queen-${s.id}.ics`, buildIcs(s), 'text/calendar;charset=utf-8');
        toast('Calendar file downloaded — open it to add the class.', 'success');
      }
    }
  });

  // Stage + countdown
  const stage = $('#stage');
  let stageKey = '';
  function renderStage() {
    const now = new Date();
    const next = sessions.find((s) => s.end > now);
    if (!next) return;
    const live = next.start <= now;
    const p = PLATFORM[next.platform];
    const going = rsvps.get().includes(next.key);
    stage.dataset.state = live ? 'live' : 'offline';
    $('#stage-badge').innerHTML = live ? `${icon('live')} Live now` : 'Offline';
    $('#stage-platform').innerHTML = `${icon(p.icon)} ${p.label}`;
    $('#stage-kicker').textContent = live ? 'Happening now' : 'Next class';
    $('#stage-title').textContent = next.title;
    $('#stage-meta').textContent = `${fmtFull.format(next.start)} · ${next.minutes} min · ${next.level}`;

    const media = $('#stage-media');
    const embedKey = live && CONFIG.liveEmbedUrl ? next.key : '';
    if (embedKey !== stageKey) {
      stageKey = embedKey;
      // Integration point: CONFIG.liveEmbedUrl can be a YouTube Live / Vimeo
      // embed or a page hosting the Zoom Web SDK meeting component.
      media.innerHTML = embedKey
        ? `<iframe src="${esc(CONFIG.liveEmbedUrl)}" title="${esc(next.title)} live stream" allow="autoplay; camera; microphone; fullscreen; picture-in-picture" allowfullscreen></iframe>`
        : '';
      stage.classList.toggle('has-embed', Boolean(embedKey));
    }

    const href = joinHref(next);
    $('#stage-actions').innerHTML = live
      ? (href ? `<a class="btn btn-gem" href="${esc(href)}" target="_blank" rel="noopener">${icon(p.icon)} Join on ${p.label}</a>` : `<span class="muted">Check your email for the class link.</span>`)
      : `<button type="button" class="btn ${going ? 'btn-going' : 'btn-gem'}" data-rsvp="${next.key}" aria-pressed="${going}">${going ? `${icon('check')} You're going` : `${icon('bolt')} RSVP`}</button>
         <button type="button" class="btn btn-ghost" data-ics="${next.key}">${icon('calendar')} Add to calendar</button>`;

    const heroNext = $('#hero-next');
    heroNext.hidden = false;
    heroNext.classList.toggle('is-live', live);
    $('#hero-next-title').textContent = live ? `Live now: ${next.title}` : `Next live: ${next.title}`;
    $('#hero-next-when').textContent = live ? '— tap to join' : relativeWhen(next.start);
  }

  const cd = Object.fromEntries($$('#countdown [data-unit]').map((b) => [b.dataset.unit, b]));
  function tick() {
    const now = new Date();
    if (sessions.length && sessions[0].end <= now) {
      sessions = upcomingSessions(now);
      renderList();
    }
    const next = sessions.find((s) => s.end > now);
    if (!next) return;
    const live = next.start <= now;
    if ((stage.dataset.state === 'live') !== live) {
      renderStage();
      renderList();
    }
    const t = splitCountdown(live ? next.end - now : next.start - now);
    cd.d.textContent = t.d;
    cd.h.textContent = String(t.h).padStart(2, '0');
    cd.m.textContent = String(t.m).padStart(2, '0');
    cd.s.textContent = String(t.s).padStart(2, '0');
    $('#countdown').setAttribute('aria-label', `${live ? 'Class ends' : 'Class starts'} in ${t.d} days ${t.h} hours ${t.m} minutes`);
  }
  renderStage();
  // Tick just after each wall-clock second so the display never skips or repeats a second.
  const loop = () => {
    tick();
    setTimeout(loop, 1015 - (Date.now() % 1000));
  };
  loop();

  // Instagram Lives + remote events
  const nextIg = sessions.filter((s) => s.platform === 'ig').slice(0, 3);
  $('#ig-list').innerHTML = nextIg.map((s) => `<li>${icon('live')}<span><strong>${esc(s.title)}</strong> ${relativeWhen(s.start)}</span></li>`).join('');
  const now = new Date();
  const events = EVENTS.map((ev) => {
    const [date, time] = ev.date.split('T');
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = time.split(':').map(Number);
    const start = zonedTime(y, m, d, h, min, CONFIG.timezone);
    return { ...ev, key: `${ev.id}@${date}`, start, end: new Date(start.getTime() + 90 * 60000) };
  }).filter((ev) => ev.end > now);
  $('#event-list').innerHTML = events.length
    ? events.map((ev) => `<li>
        <div class="event-date"><strong>${ev.start.getDate()}</strong><small>${fmtMonth.format(ev.start)}</small></div>
        <div><strong>${esc(ev.title)}</strong><span class="muted">${esc(ev.blurb)}</span></div>
        <button type="button" class="icon-btn" data-event-ics="${ev.key}" aria-label="Add ${esc(ev.title)} to your calendar" title="Add to calendar">${icon('calendar')}</button>
      </li>`).join('')
    : '<li class="muted">New events announced soon.</li>';
  $('#event-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-event-ics]');
    const ev = btn && events.find((x) => x.key === btn.dataset.eventIcs);
    if (ev) {
      downloadFile(`road-queen-${ev.id}.ics`, buildIcs({ ...ev, minutes: 90 }), 'text/calendar;charset=utf-8');
      toast('Calendar file downloaded.', 'success');
    }
  });

  initChat();
}

function initChat() {
  const log = $('#chat-log');
  const add = ({ name, text }, mine = false) => {
    const li = document.createElement('li');
    li.className = mine ? 'is-mine' : '';
    const who = document.createElement('strong');
    who.textContent = name;
    li.append(who, document.createTextNode(` ${text}`));
    log.append(li);
    while (log.children.length > 40) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  };
  CHAT_SEED.forEach((m) => add(m));

  $('#chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#chat-input');
    const text = input.value.trim();
    if (!text) return;
    add({ name: 'You', text }, true);
    input.value = '';
  });

  const reactions = $('#reactions');
  $$('[data-react]').forEach((btn) => btn.addEventListener('click', () => {
    if (reducedMotion()) {
      add({ name: 'You', text: btn.dataset.react }, true);
      return;
    }
    const el = document.createElement('span');
    el.className = 'reaction';
    el.textContent = btn.dataset.react;
    el.style.left = `${55 + Math.random() * 35}%`;
    el.style.setProperty('--drift', `${(Math.random() - 0.5) * 80}px`);
    reactions.append(el);
    el.addEventListener('animationend', () => el.remove());
  }));

  const toggle = $('#chat-toggle');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Hide' : 'Show';
    $('#chat').classList.toggle('is-collapsed', !open);
  });
}
