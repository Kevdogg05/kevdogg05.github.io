// JOIN US: lead capture (CONFIG.joinEndpoint, or a pre-filled email), social
// links, share and QR code.
import { CONFIG } from './config.js';
import { member } from './state.js';
import { $, $$, esc, icon, validate, isEmail, mailto, showResult, setupDialog, toast, copyText } from './ui.js';

export function initJoin() {
  // Fill every social / handle / email slot from CONFIG.
  $$('[data-social]').forEach((a) => { a.href = CONFIG.socials[a.dataset.social]; });
  $$('[data-handle]').forEach((el) => { el.textContent = CONFIG.handle; });
  $$('[data-email]').forEach((el) => { el.textContent = CONFIG.email; });
  $$('[data-email-link]').forEach((a) => { a.href = `mailto:${CONFIG.email}`; });

  const form = $('#join-form');
  const result = $('#join-result');
  const welcome = (who) => showResult(result, `<strong>${icon('crown')} Welcome to the movement, ${esc(who.name.split(' ')[0])}!</strong>
    <p>Next step: RSVP to a <a href="#live">live class</a> and tag ${esc(CONFIG.handle)} when you post your sweat.</p>`);

  const saved = member.get();
  if (saved) {
    $('#join-name').value = saved.name;
    $('#join-email').value = saved.email;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = validate(form, {
      'join-name': (v) => (v.length >= 2 ? '' : 'Tell us your name.'),
      'join-email': (v) => (!v ? 'Add your email so we can reach you.' : isEmail(v) ? '' : 'That email doesn’t look right.'),
    });
    if (!ok) return;
    const data = new FormData(form);
    const who = { name: data.get('name').trim(), email: data.get('email').trim() };
    const interests = data.getAll('interests');
    const button = $('button[type="submit"]', form);

    if (CONFIG.joinEndpoint) {
      button.disabled = true;
      try {
        const res = await fetch(CONFIG.joinEndpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(res.status);
        member.set(who);
        welcome(who);
        toast("You're in! 👑", 'success');
      } catch {
        showResult(result, '<strong>Sign-up didn’t go through.</strong><p>Check your connection and try again.</p>', 'error');
      } finally {
        button.disabled = false;
      }
      return;
    }

    // No form backend yet: open a pre-filled email to the team.
    const body = `Hi Road Queen Fitness! Please add me to the movement.\n\nName: ${who.name}\nEmail: ${who.email}\nInterested in: ${interests.join(', ') || 'Everything'}`;
    window.location.href = mailto('Join the Movement', body);
    member.set(who);
    showResult(result, `<strong>${icon('crown')} Almost there, ${esc(who.name.split(' ')[0])}!</strong>
      <p>Your email app opened with your sign-up — hit send and you're in. Then RSVP to a <a href="#live">live class</a>.</p>
      <p class="small muted">Email didn't open? Write to <a href="mailto:${esc(CONFIG.email)}">${esc(CONFIG.email)}</a>.</p>`);
  });

  // Share
  $('#share-btn').addEventListener('click', async () => {
    const share = { title: CONFIG.brand, text: "Train like it's Carnival Monday 👑 Soca workouts, choreo and live classes.", url: CONFIG.siteUrl };
    if (navigator.share) {
      try { await navigator.share(share); } catch { /* closed the share sheet */ }
      return;
    }
    toast(await copyText(CONFIG.siteUrl) ? 'Link copied — share it with your crew!' : CONFIG.siteUrl, 'success');
  });

  // QR code
  const qr = setupDialog($('#qr-dialog'));
  $('#qr-btn').addEventListener('click', () => qr.open());
  $('#qr-copy').addEventListener('click', async () => {
    toast(await copyText(CONFIG.siteUrl) ? 'Link copied.' : CONFIG.siteUrl, 'success');
  });
}
