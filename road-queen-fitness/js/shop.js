// GEAR UP: product grid with category tabs, size pickers, hover/flip views
// and a persistent cart drawer with checkout hand-off.
import { CONFIG } from './config.js';
import { PRODUCTS } from './data.js';
import { createStore } from './store.js';
import { member } from './state.js';
import { productArt } from './shop-art.js';
import { $, $$, esc, icon, setupTabs, setupDialog, toast, formatMoney, mailto, showResult, reducedMotion } from './ui.js';

// Cart lines: [{ id, size, qty }]
const cart = createStore([], 'cart');
const lineKey = (l) => `${l.id}|${l.size ?? ''}`;
const product = (id) => PRODUCTS.find((p) => p.id === id);

export function initShop() {
  const grid = $('#product-grid');
  const category = createStore('all');
  $$('[data-free-ship]').forEach((el) => { el.textContent = formatMoney(CONFIG.freeShippingAt); });

  const card = (p) => `<article class="product" data-id="${p.id}">
    <div class="product-media">
      ${p.badge ? `<span class="product-badge">${esc(p.badge)}</span>` : ''}
      <div class="product-view view-front">${productArt(p.art, 'front', esc(p.name))}</div>
      <div class="product-view view-back">${productArt(p.art, 'back', esc(p.name))}</div>
      <button type="button" class="flip-btn" data-flip aria-pressed="false" aria-label="Show the other side of ${esc(p.name)}">${icon('flip')}<span>Flip</span></button>
    </div>
    <div class="product-body">
      <div class="product-title"><h3>${esc(p.name)}</h3><strong>${formatMoney(p.price)}</strong></div>
      <p class="muted small">${esc(p.blurb)}</p>
      ${p.sizes ? `<fieldset class="sizes">
          <legend class="sr-only">Size for ${esc(p.name)}</legend>
          ${p.sizes.map((s) => `<label><input type="radio" name="size-${p.id}" value="${esc(s)}"><span>${esc(s)}</span></label>`).join('')}
        </fieldset>
        <p class="size-hint" aria-live="polite"></p>`
        : '<p class="one-size">One size fits most</p>'}
      <button type="button" class="btn btn-gem btn-block add-btn" data-add="${p.id}">${icon('cart')}<span>Add to cart</span></button>
    </div>
  </article>`;

  category.subscribe((cat) => {
    grid.innerHTML = PRODUCTS.filter((p) => cat === 'all' || p.cat === cat).map(card).join('');
  });
  setupTabs($('#shop-tabs'), (tab) => category.set(tab.dataset.cat));

  grid.addEventListener('click', (e) => {
    const flip = e.target.closest('[data-flip]');
    if (flip) {
      const media = flip.closest('.product-media');
      const on = !media.classList.contains('is-flipped');
      media.classList.toggle('is-flipped', on);
      flip.setAttribute('aria-pressed', String(on));
      return;
    }
    const add = e.target.closest('[data-add]');
    if (!add) return;
    const p = product(add.dataset.add);
    const el = add.closest('.product');
    let size = null;
    if (p.sizes) {
      size = $('input[type="radio"]:checked', el)?.value;
      const hint = $('.size-hint', el);
      if (!size) {
        hint.textContent = 'Pick a size first.';
        const sizes = $('.sizes', el);
        sizes.classList.remove('is-shake');
        void sizes.offsetWidth;
        sizes.classList.add('is-shake');
        $('input[type="radio"]', el).focus();
        return;
      }
      hint.textContent = '';
    }
    addToCart(p, size);
    add.classList.add('is-added');
    $('span', add).textContent = 'Added!';
    add.querySelector('use').setAttribute('href', '#i-check');
    setTimeout(() => {
      add.classList.remove('is-added');
      $('span', add).textContent = 'Add to cart';
      add.querySelector('use').setAttribute('href', '#i-cart');
    }, 1400);
    flyToCart($('.product-media svg', el));
  });
  grid.addEventListener('change', (e) => {
    if (e.target.matches('.sizes input')) $('.size-hint', e.target.closest('.product')).textContent = '';
  });

  initCart();
}

function addToCart(p, size) {
  cart.set((lines) => {
    const key = lineKey({ id: p.id, size });
    const found = lines.find((l) => lineKey(l) === key);
    return found
      ? lines.map((l) => (l === found ? { ...l, qty: Math.min(10, l.qty + 1) } : l))
      : [...lines, { id: p.id, size, qty: 1 }];
  });
  toast(`${p.name}${size ? ` (${size})` : ''} added to your bag.`, 'success');
}

function flyToCart(fromEl) {
  const target = $('#cart-open');
  if (reducedMotion() || !fromEl) return;
  const a = fromEl.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const ghost = fromEl.cloneNode(true);
  ghost.classList.add('fly-ghost');
  Object.assign(ghost.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
  document.body.append(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  ghost.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 0.9 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.08)`, opacity: 0.4 },
  ], { duration: 650, easing: 'cubic-bezier(.6,-0.2,.7,1)' }).onfinish = () => {
    ghost.remove();
    target.classList.remove('is-bump');
    void target.offsetWidth;
    target.classList.add('is-bump');
  };
}

function initCart() {
  const drawer = setupDialog($('#cart'));
  const list = $('#cart-items');
  $('#cart-open').addEventListener('click', () => {
    $('#checkout-result').hidden = true;
    drawer.open();
  });

  cart.subscribe((lines) => {
    const valid = lines.filter((l) => product(l.id));
    const count = valid.reduce((n, l) => n + l.qty, 0);
    const subtotal = valid.reduce((n, l) => n + l.qty * product(l.id).price, 0);
    $('#cart-count').textContent = count;
    $('#cart-count').classList.toggle('is-empty', count === 0);
    $('#cart-open').setAttribute('aria-label', `Open cart, ${count} item${count === 1 ? '' : 's'}`);
    $('#cart-subtotal').textContent = formatMoney(subtotal);
    $('#cart-empty').hidden = count > 0;
    $('#cart-foot').hidden = count === 0;
    $('#ship-meter').hidden = count === 0;

    const left = CONFIG.freeShippingAt - subtotal;
    $('#ship-text').innerHTML = left > 0
      ? `You're <strong>${formatMoney(left)}</strong> away from free shipping.`
      : `${icon('truck')} You've unlocked <strong>free shipping</strong>!`;
    $('#ship-bar').style.width = `${Math.min(100, (subtotal / CONFIG.freeShippingAt) * 100)}%`;

    list.innerHTML = valid.map((l) => {
      const p = product(l.id);
      const key = esc(lineKey(l));
      return `<li class="cart-line">
        <div class="cart-thumb">${productArt(p.art, 'front', esc(p.name))}</div>
        <div class="cart-line-info">
          <strong>${esc(p.name)}</strong>
          <span class="muted small">${l.size ? `Size ${esc(l.size)} · ` : ''}${formatMoney(p.price)}</span>
          <div class="qty" role="group" aria-label="Quantity for ${esc(p.name)}">
            <button type="button" class="icon-btn" data-qty="-1" data-key="${key}" aria-label="One fewer">${icon('minus')}</button>
            <output aria-live="polite">${l.qty}</output>
            <button type="button" class="icon-btn" data-qty="1" data-key="${key}" aria-label="One more" ${l.qty >= 10 ? 'disabled' : ''}>${icon('plus')}</button>
          </div>
        </div>
        <div class="cart-line-end">
          <strong>${formatMoney(p.price * l.qty)}</strong>
          <button type="button" class="icon-btn" data-remove-line="${key}" aria-label="Remove ${esc(p.name)}">${icon('trash')}</button>
        </div>
      </li>`;
    }).join('');
  });

  list.addEventListener('click', (e) => {
    const qty = e.target.closest('[data-qty]');
    if (qty) {
      const step = Number(qty.dataset.qty);
      cart.set((lines) => lines
        .map((l) => (lineKey(l) === qty.dataset.key ? { ...l, qty: Math.min(10, l.qty + step) } : l))
        .filter((l) => l.qty > 0));
      $(`[data-qty="${step}"][data-key="${CSS.escape(qty.dataset.key)}"]`, list)?.focus();
    }
    const rm = e.target.closest('[data-remove-line]');
    if (rm) {
      cart.set((lines) => lines.filter((l) => lineKey(l) !== rm.dataset.removeLine));
      toast('Removed from your bag.');
    }
  });

  $('#checkout-btn').addEventListener('click', () => {
    const lines = cart.get().filter((l) => product(l.id));
    if (!lines.length) return;
    if (CONFIG.checkoutUrl) {
      window.location.href = CONFIG.checkoutUrl;
      return;
    }
    const subtotal = lines.reduce((n, l) => n + l.qty * product(l.id).price, 0);
    const who = member.get();
    const body = [
      'Hi Road Queen Fitness, I would like to order:',
      '',
      ...lines.map((l) => `- ${l.qty} × ${product(l.id).name}${l.size ? ` (size ${l.size})` : ''} — ${formatMoney(l.qty * product(l.id).price)}`),
      '',
      `Subtotal: ${formatMoney(subtotal)}`,
      '',
      `Name: ${who?.name || ''}`,
      'Shipping address: ',
    ].join('\n');
    window.location.href = mailto('Gear Up order request', body);
    showResult($('#checkout-result'), `<strong>${icon('check')} Order request ready.</strong>
      <p>Your email app opened with your bag — add your shipping address and send. We'll reply with payment and delivery details.</p>`);
  });
}
