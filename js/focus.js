(function () {
  'use strict';

  const CS = window.CS;
  const modes = { focus: 'Focus', short: 'Short break', long: 'Long break' };
  const ringLength = 2 * Math.PI * 126;
  let mode = 'focus';
  let remaining = 0;
  let duration = 0;
  let deadline = 0;
  let running = false;
  let started = false;
  let completed = false;
  let sessionTask = '';
  let interval = null;
  let view = null;
  let source = null;
  let taskSave = null;
  let audioContext = null;
  let showAllHistory = false;

  function settings() { return CS.state.focus.settings; }
  function configuredDuration() { return Math.max(1, Math.min(180, Number(settings()[mode]) || 25)) * 60000; }
  function stopInterval() { if (interval !== null) window.clearInterval(interval); interval = null; }
  function flushTask() { if (taskSave !== null) { window.clearTimeout(taskSave); taskSave = null; CS.save(); } }
  function liveView() { return view && view.isConnected ? view : null; }

  function ensureSource() {
    if (source !== CS.state.focus) {
      stopInterval();
      source = CS.state.focus;
      mode = 'focus';
      running = false;
      started = false;
      completed = false;
      duration = configuredDuration();
      remaining = duration;
      sessionTask = '';
      showAllHistory = false;
    }
  }

  function prepareAudio() {
    if (!settings().sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (Audio && !audioContext) audioContext = new Audio();
      if (audioContext && audioContext.state === 'suspended') audioContext.resume().catch(function () {});
    } catch (_) { /* The visual completion notice is always available. */ }
  }

  function playChime() {
    if (!settings().sound || !audioContext || audioContext.state !== 'running') return;
    try {
      [523.25, 659.25].forEach(function (frequency, index) {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const at = audioContext.currentTime + index * 0.22;
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.09, at + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.8);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.85);
      });
    } catch (_) { /* A blocked audio device must not interrupt saving. */ }
  }

  function complete() {
    if (!running) return;
    running = false;
    remaining = 0;
    completed = true;
    stopInterval();
    if (mode === 'focus') {
      if (settings().history) {
        CS.state.focus.sessions.unshift({ id: CS.uid(), task: sessionTask, minutes: duration / 60000, completedAt: new Date().toISOString() });
        CS.state.focus.sessions = CS.state.focus.sessions.slice(0, 100);
      }
      CS.touch('Made space for a focus session', 'focus');
    }
    playChime();
    CS.toast(mode === 'focus' ? 'Your focus session is complete. Take a moment before your next task.' : 'Your break is complete. Begin again whenever you feel ready.');
    update();
    renderHistory();
  }

  function tick() {
    ensureSource();
    if (running) {
      remaining = Math.max(0, deadline - Date.now());
      if (remaining <= 0) { complete(); return; }
    }
    update();
  }

  function timeText(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }

  function message() {
    if (completed) return mode === 'focus' ? 'Your focus session is complete. Take a moment before your next task.' : 'Your break is complete. Come back when you are ready.';
    if (running) return mode === 'focus' ? 'You only need to be here, with this one thing.' : 'Step away, stretch, or simply let your mind wander.';
    if (started) return 'Paused. There is no rush to begin again.';
    return mode === 'focus' ? 'A little uninterrupted space for what matters.' : 'Rest is part of the process, too.';
  }

  function update() {
    const el = liveView();
    if (!el) return;
    el.querySelector('[data-focus-time]').textContent = timeText(remaining);
    el.querySelector('[data-focus-time]').setAttribute('aria-label', timeText(remaining) + ' remaining');
    el.querySelector('[data-focus-ring]').style.strokeDashoffset = String(ringLength * (1 - remaining / Math.max(1, duration)));
    el.querySelector('[data-focus-mode]').textContent = completed ? 'A moment well spent' : modes[mode];
    const control = el.querySelector('[data-focus-toggle]');
    control.textContent = running ? 'Pause' : completed ? 'Start again' : started ? 'Resume' : 'Start session';
    const status = el.querySelector('[data-focus-message]');
    const text = message();
    if (status.textContent !== text) status.textContent = text;
    el.querySelector('[data-focus-current]').textContent = started && sessionTask ? sessionTask : '';
    el.querySelector('[data-focus-current]').hidden = !(started && sessionTask);
    el.querySelectorAll('[data-mode]').forEach(function (button) {
      button.classList.toggle('active', button.dataset.mode === mode);
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    });
    el.querySelector('[data-focus-reset]').disabled = !started;
    el.classList.toggle('focus-is-running', running);
  }

  function reset() {
    stopInterval();
    running = false;
    started = false;
    completed = false;
    sessionTask = '';
    duration = configuredDuration();
    remaining = duration;
    update();
  }

  function toggle() {
    ensureSource();
    if (running) {
      remaining = Math.max(0, deadline - Date.now());
      if (remaining <= 0) { complete(); return; }
      running = false;
      stopInterval();
    } else {
      if (completed) reset();
      if (!started) {
        duration = configuredDuration();
        remaining = duration;
        sessionTask = CS.state.focus.task.trim();
      }
      flushTask();
      prepareAudio();
      started = true;
      running = true;
      deadline = Date.now() + remaining;
      stopInterval();
      interval = window.setInterval(tick, 250);
    }
    update();
  }

  function renderHistory() {
    const el = liveView();
    if (!el) return;
    const container = el.querySelector('[data-focus-history]');
    const sessions = CS.state.focus.sessions;
    const visible = showAllHistory ? sessions : sessions.slice(0, 5);
    container.innerHTML = '<div class="section-heading"><div><p class="eyebrow">A little space, made</p><h2>Recent sessions</h2></div>' + (sessions.length ? '<button class="btn quiet small" type="button" data-clear-history>Clear history</button>' : '') + '</div>' +
      (sessions.length ? '<ul class="focus-history-list">' + visible.map(function (item) {
        return '<li><span class="focus-history-icon" aria-hidden="true">' + CS.icon('check', 17) + '</span><div><strong>' + CS.esc(item.task || 'A moment to focus') + '</strong><p class="muted small">' + CS.esc(CS.formatDate(item.completedAt, { month: 'short', day: 'numeric' })) + ' · ' + CS.esc(item.minutes) + ' minutes</p></div></li>';
      }).join('') + '</ul>' + (sessions.length > 5 ? '<button type="button" class="btn quiet small" data-history-more>' + (showAllHistory ? 'Show fewer sessions' : 'View all sessions') + '</button>' : '') : '<div class="focus-history-empty"><span aria-hidden="true">' + CS.icon('leaf', 26) + '</span><p>Room for your next small step.</p><p class="muted small">' + (settings().history ? 'Completed focus sessions will appear here. There is no target to reach.' : 'Session history is turned off. You can still enjoy a little space to focus.') + '</p></div>') +
      (!settings().history && sessions.length ? '<p class="muted small focus-history-note">History is off. Existing sessions are kept; new sessions will not be recorded.</p>' : '');
    const clear = container.querySelector('[data-clear-history]');
    if (clear) clear.addEventListener('click', async function () {
      if (await CS.confirm('Clear your focus session history? This will not change your timer settings.')) {
        CS.state.focus.sessions = [];
        CS.save();
        CS.toast('Focus history cleared.');
        renderHistory();
      }
    });
    const more = container.querySelector('[data-history-more]');
    if (more) more.addEventListener('click', function () { showAllHistory = !showAllHistory; renderHistory(); });
  }

  function openSettings() {
    const prefs = settings();
    CS.modal('Make it your own', '<form id="focus-settings-form"><p class="muted">Choose a rhythm that feels manageable. Each duration can be between 1 and 180 minutes.</p><div class="form-grid focus-settings-fields">' +
      Object.keys(modes).map(function (key) { return '<label class="field">' + modes[key] + ' <span class="muted small">(minutes)</span><input name="' + key + '" type="number" min="1" max="180" step="1" required value="' + CS.esc(prefs[key]) + '"></label>'; }).join('') +
      '</div><label class="focus-checkbox"><input type="checkbox" name="sound"' + (prefs.sound ? ' checked' : '') + '>Play a gentle sound when a session ends</label><label class="focus-checkbox"><input type="checkbox" name="history"' + (prefs.history ? ' checked' : '') + '>Keep completed focus sessions on this device</label><p class="muted small">Your timer continues while you explore this workspace. Closing or refreshing the page resets it.</p><div class="modal-actions"><button class="btn" type="button" data-cancel>Cancel</button><button class="btn primary" type="submit">Save preferences</button></div></form>', function (dialog) {
      const form = dialog.querySelector('form');
      dialog.querySelector('[data-cancel]').addEventListener('click', CS.closeModal);
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const data = new FormData(form);
        const newSettings = { focus: Number(data.get('focus')), short: Number(data.get('short')), long: Number(data.get('long')), sound: data.get('sound') === 'on', history: data.get('history') === 'on' };
        if (!['focus', 'short', 'long'].every(function (key) { return Number.isInteger(newSettings[key]) && newSettings[key] >= 1 && newSettings[key] <= 180; })) return;
        CS.state.focus.settings = newSettings;
        CS.save();
        prepareAudio();
        if (!started) reset();
        CS.closeModal();
        CS.toast(started && !completed ? 'Preferences saved. New durations apply to your next session.' : 'Focus preferences saved.');
        updateSoundButton();
        renderHistory();
      });
    });
  }

  function updateSoundButton() {
    const el = liveView();
    if (!el) return;
    const button = el.querySelector('[data-focus-sound]');
    button.setAttribute('aria-pressed', String(settings().sound));
    button.textContent = 'Sound ' + (settings().sound ? 'on' : 'off');
  }

  CS.pages.focus = function (root) {
    ensureSource();
    tick();
    root.innerHTML = '<div class="focus-page"><div class="page-heading"><div><p class="eyebrow">Focus space</p><h1>One thing at a time.</h1><p class="muted">A quiet corner to begin, pause, and find your own rhythm.</p></div><button class="btn" type="button" data-focus-settings>' + CS.icon('settings', 18) + 'Timer settings</button></div>' +
      '<div class="focus-layout"><section class="card focus-workspace" aria-label="Focus timer"><div class="focus-modes" aria-label="Timer type">' + Object.keys(modes).map(function (key) { return '<button type="button" data-mode="' + key + '" aria-pressed="' + (key === mode) + '" class="' + (key === mode ? 'active' : '') + '">' + modes[key] + '</button>'; }).join('') + '</div>' +
      '<label class="field focus-task-field">What would you like to give your attention to?<input id="focus-task" type="text" maxlength="240" placeholder="One small thing is enough" value="' + CS.esc(CS.state.focus.task) + '"></label>' +
      '<div class="focus-timer"><svg viewBox="0 0 280 280" aria-hidden="true"><circle class="focus-ring-track" cx="140" cy="140" r="126"></circle><circle class="focus-ring-progress" data-focus-ring cx="140" cy="140" r="126" stroke-dasharray="' + ringLength + '" stroke-dashoffset="0"></circle></svg><div class="focus-timer-content"><span class="eyebrow" data-focus-mode>' + modes[mode] + '</span><span class="focus-digits" data-focus-time role="timer" aria-live="off">' + timeText(remaining) + '</span><span class="focus-timer-caption">one breath, one small step</span></div></div>' +
      '<p class="focus-current-task" data-focus-current hidden></p><div class="focus-controls"><button type="button" class="btn primary" data-focus-toggle>Start session</button><button type="button" class="btn" data-focus-reset>Reset</button></div><p class="focus-message muted" data-focus-message role="status" aria-live="polite"></p><button class="btn quiet small focus-sound" type="button" data-focus-sound aria-pressed="' + settings().sound + '">Sound ' + (settings().sound ? 'on' : 'off') + '</button></section>' +
      '<aside class="focus-aside"><section class="focus-note"><div class="focus-note-icon" aria-hidden="true">' + CS.icon('leaf', 28) + '</div><p class="eyebrow">Permission to slow down</p><h2>You do not need to do it all.</h2><p>Choose one small action. Give it a little space. When you need a break, take one.</p><span class="focus-note-rule" aria-hidden="true"></span><p class="small">Progress can be quiet.</p></section><section class="card focus-history" data-focus-history aria-label="Recent focus sessions"></section></aside></div></div>';
    view = root.querySelector('.focus-page');
    view.querySelector('[data-focus-toggle]').addEventListener('click', toggle);
    view.querySelector('[data-focus-reset]').addEventListener('click', reset);
    view.querySelector('[data-focus-settings]').addEventListener('click', openSettings);
    view.querySelector('[data-focus-sound]').addEventListener('click', function () { settings().sound = !settings().sound; CS.save(); prepareAudio(); updateSoundButton(); });
    view.querySelector('#focus-task').addEventListener('input', function (event) {
      CS.state.focus.task = event.target.value;
      if (taskSave !== null) window.clearTimeout(taskSave);
      taskSave = window.setTimeout(function () { taskSave = null; CS.save(); }, 250);
    });
    view.querySelectorAll('[data-mode]').forEach(function (button) {
      button.addEventListener('click', async function () {
        if (mode === button.dataset.mode) return;
        if (started && !completed && !(await CS.confirm('Switch timer mode and reset this unfinished session?'))) return;
        mode = button.dataset.mode;
        reset();
      });
    });
    renderHistory();
    update();
    const renderedView = view;
    return function () { flushTask(); if (view === renderedView) view = null; };
  };

  // Used by workspace restore/clear so an old session cannot affect new data.
  CS.resetFocus = function () { source = null; ensureSource(); update(); };

  document.addEventListener('visibilitychange', function () { if (running) tick(); });
  window.addEventListener('pagehide', function () { flushTask(); if (CS.flush) CS.flush(); });
})();
