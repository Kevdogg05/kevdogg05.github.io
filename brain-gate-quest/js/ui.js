/**
 * Brain Gate Quest — HTML user interface layered over the canvas:
 * HUD, menus, the Brain Gate question modal, toasts and the
 * "rotate your device" prompt. Text lives in the DOM (not the canvas)
 * so it stays sharp, readable and accessible on every screen size.
 */
(function () {
  'use strict';

  const BGQ = window.BGQ;

  const PRAISE = ['Awesome!', 'Brilliant!', 'You got it!', 'Super smart!', 'Fantastic!', 'Great thinking!'];
  const RETRY = ['Not quite — try again!', 'So close! Give it another go.', 'Good try! Think it through once more.'];
  const CONFETTI_COLORS = ['#ffd23f', '#ff5d8f', '#19a68f', '#3a9bff', '#9b4fd0', '#7ee05a'];

  const el = {};
  let quiz = null;          // the active question session
  let usingKeyboard = false; // auto-focus buttons only for keyboard players
  let hudCache = {};
  let toastTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  /**
   * Moves focus to a button for keyboard players. Touch and mouse players
   * get no focus ring, so an answer never looks pre-selected to them.
   */
  function focusFor(button, fallback) {
    window.setTimeout(function () {
      if (usingKeyboard && button) button.focus({ preventScroll: true });
      else if (fallback) fallback.focus({ preventScroll: true });
    }, 60);
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function pad(n, len) {
    return String(n).padStart(len, '0');
  }

  function formatTime(seconds) {
    const s = Math.floor(seconds);
    return Math.floor(s / 60) + ':' + pad(s % 60, 2);
  }

  /** Draws a sprite into a small canvas element (scaled up by CSS). */
  function paintSprite(canvas, sprite) {
    canvas.width = sprite.width;
    canvas.height = sprite.height;
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(sprite, 0, 0);
  }

  /** A short burst of CSS confetti inside the question card. */
  function burstConfetti(container) {
    for (let i = 0; i < 36; i++) {
      const bit = document.createElement('span');
      bit.className = 'confetti';
      bit.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      bit.style.left = 50 + BGQ.rand(-8, 8) + '%';
      bit.style.setProperty('--dx', BGQ.rand(-180, 180).toFixed(0) + 'px');
      bit.style.setProperty('--dy', BGQ.rand(-160, -40).toFixed(0) + 'px');
      bit.style.setProperty('--rot', BGQ.rand(-540, 540).toFixed(0) + 'deg');
      bit.style.animationDelay = (Math.random() * 0.08).toFixed(2) + 's';
      container.appendChild(bit);
      window.setTimeout(function () { bit.remove(); }, 1400);
    }
  }

  function onQuizKey(e) {
    if (!quiz) return;
    const n = parseInt(e.key, 10);
    if (!quiz.solved && n >= 1 && n <= 4) {
      e.preventDefault();
      choose(n - 1);
    }
  }

  function choose(index) {
    if (!quiz || quiz.solved) return;
    const btn = quiz.buttons[index];
    if (!btn || btn.disabled) return;

    if (index === quiz.question.correct) {
      quiz.solved = true;
      const firstTry = quiz.wrong === 0;
      btn.classList.add('correct');
      quiz.buttons.forEach(function (b) { b.disabled = true; });
      el.quizFeedback.className = 'quiz-feedback good';
      el.quizFeedback.innerHTML = '';
      const strong = document.createElement('strong');
      strong.textContent = pick(PRAISE) + (firstTry ? ' First try — you earned a Brain Star!' : ' The gate is unlocked!');
      const fact = document.createElement('span');
      fact.textContent = quiz.question.fact;
      el.quizFeedback.appendChild(strong);
      el.quizFeedback.appendChild(fact);
      paintSprite(el.quizOwl, BGQ.Sprites.owlCheer);
      el.quizOwl.classList.add('cheer');
      burstConfetti(el.quizConfetti);
      BGQ.Audio.play('correct');
      el.quizContinue.classList.remove('hidden');
      focusFor(el.quizContinue, el.quizCard);
      quiz.handlers.onCorrect(firstTry);
    } else {
      quiz.wrong++;
      btn.classList.add('wrong');
      btn.disabled = true;
      btn.setAttribute('aria-label', btn.textContent + ' (not correct)');
      el.quizFeedback.className = 'quiz-feedback retry';
      el.quizFeedback.innerHTML = '';
      const strong = document.createElement('strong');
      strong.textContent = pick(RETRY);
      const hint = document.createElement('span');
      hint.textContent = 'Hint: ' + quiz.question.hint;
      el.quizFeedback.appendChild(strong);
      el.quizFeedback.appendChild(hint);
      el.quizCard.classList.remove('shake');
      void el.quizCard.offsetWidth; // restart the shake animation
      el.quizCard.classList.add('shake');
      BGQ.Audio.play('wrong');
    }
  }

  BGQ.UI = {
    init: function (handlers) {
      el.stage = $('stage');
      el.hud = $('hud');
      el.score = $('hud-score');
      el.coins = $('hud-coins');
      el.lives = $('hud-lives');
      el.time = $('hud-time');
      el.gates = $('hud-gates');
      el.toast = $('toast');
      el.rotate = $('rotate');
      el.mute = $('btn-mute');
      el.fullscreen = $('btn-fullscreen');
      el.pause = $('btn-pause');
      el.screens = {
        title: $('screen-title'),
        pause: $('screen-pause'),
        gameover: $('screen-gameover'),
        victory: $('screen-victory')
      };
      el.quiz = $('quiz');
      el.quizCard = $('quiz-card');
      el.quizOwl = $('quiz-owl');
      el.quizGate = $('quiz-gate');
      el.quizCat = $('quiz-cat');
      el.quizQuestion = $('quiz-question');
      el.quizChoices = $('quiz-choices');
      el.quizFeedback = $('quiz-feedback');
      el.quizContinue = $('quiz-continue');
      el.quizConfetti = $('quiz-confetti');

      // Title screen mascot art
      paintSprite($('title-pip'), BGQ.Sprites.pip.right.jump);
      paintSprite($('title-owl'), BGQ.Sprites.owl);

      const bind = function (id, fn) {
        $(id).addEventListener('click', function () {
          BGQ.Audio.unlock();
          BGQ.Audio.play('click');
          fn();
        });
      };
      bind('btn-play', handlers.onPlay);
      bind('btn-resume', handlers.onResume);
      bind('btn-restart', handlers.onRestart);
      bind('btn-continue', handlers.onContinue);
      bind('btn-startover', handlers.onRestart);
      bind('btn-again', handlers.onRestart);
      bind('btn-pause', handlers.onPause);
      bind('btn-pause-mute', handlers.onMute);
      $('btn-mute').addEventListener('click', function () {
        BGQ.Audio.unlock();
        handlers.onMute();
      });

      el.quizContinue.addEventListener('click', function () {
        if (!quiz || !quiz.solved) return;
        const done = quiz.handlers.onContinue;
        BGQ.UI.hideQuiz();
        done();
      });
      window.addEventListener('keydown', onQuizKey);
      window.addEventListener('keydown', function () { usingKeyboard = true; }, true);
      window.addEventListener('pointerdown', function () { usingKeyboard = false; }, true);

      // Fullscreen is offered only where the browser supports it (not iPhone Safari).
      const root = document.documentElement;
      const canFullscreen = !!(root.requestFullscreen || root.webkitRequestFullscreen);
      el.fullscreen.classList.toggle('hidden', !canFullscreen);
      el.fullscreen.addEventListener('click', function () { BGQ.UI.toggleFullscreen(); });

      this.updateMute();
    },

    /** Enters/exits fullscreen and, on phones, tries to lock landscape. */
    toggleFullscreen: function () {
      const root = document.documentElement;
      const isFull = document.fullscreenElement || document.webkitFullscreenElement;
      try {
        if (isFull) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
          const req = root.requestFullscreen || root.webkitRequestFullscreen;
          const result = req.call(root, { navigationUI: 'hide' });
          const lock = function () {
            if (screen.orientation && screen.orientation.lock) {
              screen.orientation.lock('landscape').catch(function () {});
            }
          };
          if (result && result.then) result.then(lock).catch(function () {});
          else lock();
        }
      } catch (err) {
        /* Fullscreen refused — the game still scales to the window. */
      }
    },

    showScreen: function (name) {
      Object.keys(el.screens).forEach(function (key) {
        el.screens[key].classList.toggle('hidden', key !== name);
      });
      const screen = el.screens[name];
      if (screen) {
        const first = screen.querySelector('button:not(.hidden)');
        // The title's Play button is always focused so Enter/Space starts the game.
        if (name === 'title' && first) window.setTimeout(function () { first.focus({ preventScroll: true }); }, 50);
        else focusFor(first, screen.querySelector('.panel'));
      }
    },

    hideScreens: function () {
      this.showScreen(null);
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    },

    setPlaying: function (on) {
      el.hud.classList.toggle('hidden', !on);
      document.body.classList.toggle('playing', on);
    },

    setBest: function (best) {
      const box = $('title-best');
      if (best && best.score) {
        box.textContent = 'Best score: ' + best.score.toLocaleString() + ' · Fastest finish: ' + formatTime(best.time);
        box.classList.remove('hidden');
      } else {
        box.classList.add('hidden');
      }
    },

    updateMute: function () {
      const muted = BGQ.Audio.isMuted();
      el.mute.classList.toggle('off', muted);
      el.mute.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
      el.mute.title = muted ? 'Sound off (M)' : 'Sound on (M)';
      $('btn-pause-mute').textContent = muted ? 'Sound: Off' : 'Sound: On';
    },

    /** Refreshes HUD numbers, touching the DOM only when a value changes. */
    updateHud: function (G) {
      const values = {
        score: pad(G.score, 6),
        coins: '×' + pad(G.coins, 2),
        lives: '×' + G.lives,
        time: formatTime(G.time),
        gates: G.level.gates.map(function (g) { return g.state === 'open' || g.state === 'opening' ? '1' : '0'; }).join('')
      };
      if (values.score !== hudCache.score) el.score.textContent = values.score;
      if (values.coins !== hudCache.coins) el.coins.textContent = values.coins;
      if (values.lives !== hudCache.lives) el.lives.textContent = values.lives;
      if (values.time !== hudCache.time) el.time.textContent = values.time;
      if (values.gates !== hudCache.gates) {
        el.gates.innerHTML = '';
        values.gates.split('').forEach(function (v, i) {
          const dot = document.createElement('span');
          dot.className = 'gate-dot' + (v === '1' ? ' done' : '');
          dot.title = 'Brain Gate ' + (i + 1) + (v === '1' ? ' unlocked' : ' locked');
          el.gates.appendChild(dot);
        });
        el.gates.setAttribute('aria-label', 'Brain Gates unlocked: ' + (values.gates.split('1').length - 1));
      }
      hudCache = values;
    },

    resetHud: function () {
      hudCache = {};
    },

    toast: function (text) {
      el.toast.textContent = text;
      el.toast.classList.add('show');
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(function () { el.toast.classList.remove('show'); }, 2200);
    },

    /**
     * Opens the Brain Gate question modal.
     * @param {object} question - from BGQ.Questions.make()
     * @param {number} number   - 1-based gate number
     * @param {number} total    - number of gates in the level
     * @param {object} handlers - { onCorrect(firstTry), onContinue() }
     */
    showQuiz: function (question, number, total, handlers) {
      quiz = { question: question, handlers: handlers, wrong: 0, solved: false, buttons: [] };

      el.quizGate.textContent = 'Brain Gate ' + number + ' of ' + total;
      el.quizCat.textContent = question.category;
      el.quizCat.className = 'badge ' + (question.type === 'math' ? 'badge-math' : 'badge-know');
      el.quizQuestion.textContent = question.prompt;
      el.quizFeedback.className = 'quiz-feedback';
      el.quizFeedback.textContent = 'Tap the right answer to open the gate!';
      el.quizContinue.classList.add('hidden');
      el.quizCard.classList.remove('shake');
      el.quizOwl.classList.remove('cheer');
      paintSprite(el.quizOwl, BGQ.Sprites.owl);

      el.quizChoices.innerHTML = '';
      question.choices.forEach(function (text, i) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'choice';
        const key = document.createElement('span');
        key.className = 'choice-key';
        key.textContent = String(i + 1);
        key.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'choice-text';
        label.textContent = text;
        b.appendChild(key);
        b.appendChild(label);
        b.addEventListener('click', function () { choose(i); });
        el.quizChoices.appendChild(b);
        quiz.buttons.push(b);
      });

      el.quiz.classList.remove('hidden');
      el.quizCard.scrollTop = 0;
      focusFor(quiz.buttons[0], el.quizCard);
    },

    hideQuiz: function () {
      el.quiz.classList.add('hidden');
      quiz = null;
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    },

    quizOpen: function () {
      return !!quiz;
    },

    showGameOver: function (G) {
      $('gameover-score').textContent = G.score.toLocaleString();
      this.showScreen('gameover');
    },

    showVictory: function (G, isBest) {
      const total = G.level.gates.length;
      const stars = $('victory-stars');
      stars.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const s = document.createElement('span');
        s.className = 'star' + (i < G.stars ? ' earned' : '');
        s.style.animationDelay = (0.25 + i * 0.25) + 's';
        s.textContent = '★';
        stars.appendChild(s);
      }
      stars.setAttribute('aria-label', G.stars + ' of ' + total + ' Brain Stars');
      $('victory-score').textContent = G.score.toLocaleString();
      $('victory-coins').textContent = G.coins + ' / ' + G.totalCoins;
      $('victory-time').textContent = formatTime(G.time);
      $('victory-best').classList.toggle('hidden', !isBest);
      const msg = G.stars === total
        ? 'Perfect! You answered every Brain Gate on the first try!'
        : 'You unlocked every Brain Gate! Play again to collect all ' + total + ' Brain Stars.';
      $('victory-message').textContent = msg;
      this.showScreen('victory');
    },

    /** Shows the rotate prompt for touch devices held in portrait. */
    checkOrientation: function () {
      const touch = document.body.classList.contains('touch');
      const portrait = window.innerHeight > window.innerWidth;
      const blocked = touch && portrait;
      el.rotate.classList.toggle('hidden', !blocked);
      return blocked;
    }
  };
})();
