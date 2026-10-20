/**
 * Brain Gate Quest — keyboard and touch input.
 *
 * Desktop: Arrow keys / WASD to move, Space / Up / W to jump,
 *          P or Esc to pause, M to mute.
 * Touch:   on-screen D-pad (bottom-left) and a large Jump button
 *          (bottom-right). Fingers can slide between Left and Right
 *          without lifting, and any number of fingers work at once.
 */
(function () {
  'use strict';

  const BGQ = window.BGQ;

  const KEY_ACTIONS = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump'
  };

  const keysDown = new Map();   // key code -> action
  const pointers = new Map();   // pointerId -> action ('left' | 'right' | 'jump' | null)
  let jumpQueued = false;
  let buttons = [];

  function anyHeld(action) {
    for (const a of keysDown.values()) if (a === action) return true;
    for (const a of pointers.values()) if (a === action) return true;
    return false;
  }

  /** Shows touch controls once the device is used with a finger. */
  function setTouchMode(on) {
    document.body.classList.toggle('touch', on);
  }

  /* ------------------------------------------------------------------ *
   * Keyboard
   * ------------------------------------------------------------------ */

  function onKeyDown(e) {
    const action = KEY_ACTIONS[e.code];
    if (action) {
      if (BGQ.Input.capture) e.preventDefault();
      if (action === 'jump' && !e.repeat && !keysDown.has(e.code)) jumpQueued = true;
      keysDown.set(e.code, action);
      if (!window.matchMedia('(pointer: coarse)').matches) setTouchMode(false);
      return;
    }
    if (e.repeat) return;
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (BGQ.Input.onPause) BGQ.Input.onPause();
    } else if (e.code === 'KeyM') {
      if (BGQ.Input.onMute) BGQ.Input.onMute();
    }
  }

  function onKeyUp(e) {
    keysDown.delete(e.code);
  }

  /* ------------------------------------------------------------------ *
   * Touch buttons (pointer events cover touch, pen and mouse)
   * ------------------------------------------------------------------ */

  /** Which on-screen button (if any) lies under a screen point. */
  function hitTest(x, y, allowJump) {
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i];
      if (b.action === 'jump' && !allowJump) continue;
      const r = b.el.getBoundingClientRect();
      const pad = 14; // forgiving hit area around each button
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return b.action;
    }
    return null;
  }

  function refreshButtonStates() {
    buttons.forEach(function (b) {
      b.el.classList.toggle('active', anyHeld(b.action));
    });
  }

  function onPointerDown(e) {
    e.preventDefault();
    if (e.pointerType === 'touch') setTouchMode(true);
    const action = e.currentTarget.dataset.action;
    pointers.set(e.pointerId, action);
    if (action === 'jump') jumpQueued = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      /* Pointer capture is a nicety; sliding still works without it. */
    }
    refreshButtonStates();
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    const current = pointers.get(e.pointerId);
    // A jump finger stays a jump finger; D-pad fingers may slide left <-> right.
    if (current === 'jump') return;
    const next = hitTest(e.clientX, e.clientY, false);
    if (next !== current) {
      pointers.set(e.pointerId, next);
      refreshButtonStates();
    }
  }

  function onPointerUp(e) {
    if (pointers.delete(e.pointerId)) refreshButtonStates();
  }

  /** Drops every held input (window lost focus, game paused, etc.). */
  function releaseAll() {
    keysDown.clear();
    pointers.clear();
    jumpQueued = false;
    refreshButtonStates();
  }

  BGQ.Input = {
    /** When true, game keys do not scroll/activate page elements. */
    capture: false,
    onPause: null,
    onMute: null,

    init: function () {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', releaseAll);

      buttons = Array.prototype.map.call(document.querySelectorAll('[data-action]'), function (el) {
        el.addEventListener('pointerdown', onPointerDown);
        el.addEventListener('pointermove', onPointerMove);
        el.addEventListener('pointerup', onPointerUp);
        el.addEventListener('pointercancel', onPointerUp);
        el.addEventListener('lostpointercapture', onPointerUp);
        el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        return { el: el, action: el.dataset.action };
      });

      // Touch-first devices show the on-screen controls straight away.
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      setTouchMode(coarse || navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches);
      window.addEventListener('touchstart', function () { setTouchMode(true); }, { passive: true });
    },

    left: function () { return anyHeld('left'); },
    right: function () { return anyHeld('right'); },
    jumpHeld: function () { return anyHeld('jump'); },

    /** Returns true once per jump press (edge-triggered). */
    consumeJump: function () {
      const j = jumpQueued;
      jumpQueued = false;
      return j;
    },

    /** Forgets queued presses so a tap on a menu never becomes a jump. */
    clearQueued: function () {
      jumpQueued = false;
    },

    releaseAll: releaseAll
  };
})();
