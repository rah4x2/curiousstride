(function () {
  'use strict';

  const categories = [
    {
      title: 'Where am I now?', icon: 'sun', label: 'Take stock',
      description: 'Pause and notice what life looks like for you today.',
      questions: [
        'How would I describe my current stage of life?',
        'What has changed since graduating?',
        'What am I finding difficult at the moment?',
        'What is going well, even if it seems small?',
        'What would I like to change?'
      ],
      hints: [
        'A few words, a feeling, or a longer story — begin wherever feels natural.',
        'Think about your routine, relationships, responsibilities, or sense of direction.',
        'You do not need to solve it here. Naming it can be enough for now.',
        'There is room here for small moments as well as big changes.',
        'Choose something within reach. It does not have to change everything.'
      ]
    },
    {
      title: "What's on my mind?", icon: 'clarity', label: 'Make some space',
      description: 'Put your thoughts somewhere you can see them more clearly.',
      questions: [
        'Which thoughts keep coming back to me lately?',
        'What feels uncertain or unresolved?',
        'Which of these things can I influence right now?',
        'What could I give myself permission to set aside for now?',
        'What support or small next step might help?'
      ],
      hints: [
        'Let this be a place to set things down, without organising them perfectly.',
        'It is okay to have questions without answers.',
        'Consider one action, conversation, or choice that is within your control.',
        'Not every thought needs your attention today.',
        'A person to talk to, something to learn, or a little breathing room all count.'
      ]
    },
    {
      title: 'What matters to me?', icon: 'heart', label: 'Find your anchors',
      description: 'Explore the values and everyday moments you want more of.',
      questions: [
        'When have I felt most like myself recently?',
        'What activities or conversations give me energy?',
        'Which values do I want my choices to reflect?',
        'What would I like to make more space for?',
        'What is one small way I could honour these priorities?'
      ],
      hints: [
        'Think of a moment when you felt comfortable, interested, or connected.',
        'Notice what draws you in, even when there is no reward or deadline.',
        'For example: curiosity, stability, creativity, family, contribution, or independence.',
        'This can be a relationship, an interest, a habit, or time to rest.',
        'Start with a choice you could make this week.'
      ]
    },
    {
      title: 'Where do I want to go?', icon: 'arrow', label: 'Explore possibilities',
      description: 'Imagine a direction without needing a complete life plan.',
      questions: [
        'What would I like the next few months to feel like?',
        'Which possibilities am I curious about?',
        'What would I like to learn or try?',
        'What could make taking a first step easier?',
        'What is one possibility I want to explore next?'
      ],
      hints: [
        'Focus on how you want your days to feel, as well as what you want to do.',
        'You can be curious about more than one direction.',
        'An experiment can be small and temporary.',
        'Consider time, information, support, or a gentler expectation.',
        'You are choosing a next step, not signing up for a lifetime.'
      ]
    }
  ];

  let activeId = null;
  let step = 0;
  let saveTimer = null;
  const esc = value => CS.esc(value);
  const current = () => CS.state.reflections.find(item => item.id === activeId);

  function flush() {
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
      CS.save();
      if (CS.flush) CS.flush();
    }
  }

  function scheduleSave(record) {
    record.updatedAt = new Date().toISOString();
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      CS.save();
    }, 300);
  }

  function backButton() {
    return '<button type="button" class="btn quiet clarity-back" data-clarity="library">← All reflections</button>';
  }

  function printReflection(record) {
    const category = categories[record.category];
    const lines = value => esc(value).replace(/\n/g, '<br>');
    CS.print(category.title,
      '<p class="eyebrow">CURIOUSSTRIDE · CLARITY CORNER</p>' +
      '<p>' + esc(CS.formatDate(record.createdAt)) + '</p>' +
      category.questions.map((question, index) => '<section class="clarity-print-section"><h2>' + esc(question) +
        '</h2><p>' + (record.answers[index].trim() ? lines(record.answers[index]) : 'Left open for now.') + '</p></section>').join('') +
      '<section class="clarity-print-section"><h2>One thing I would like to focus on</h2><p>' +
      (record.focus.trim() ? lines(record.focus) : 'Still considering my next step.') + '</p></section>'
    );
  }

  CS.pages.clarity = function (root) {
    function draw(focusTarget) {
      flush();
      if (activeId && !current()) activeId = null;
      const record = current();
      if (record) {
        if (step >= 5) drawSummary(record);
        else drawQuestion(record);
      } else drawLibrary();
      if (focusTarget) {
        const target = root.querySelector(focusTarget);
        if (target) target.focus({ preventScroll: true });
      }
    }

    function drawLibrary() {
      const saved = CS.state.reflections.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      root.innerHTML = '<header class="page-heading"><div><p class="eyebrow">CLARITY CORNER</p><h1>A little room to think.</h1>' +
        '<p class="muted clarity-intro">Before deciding where you’re going, understand where you are.</p></div>' +
        '<div class="clarity-heading-art" aria-hidden="true">' + CS.icon('leaf', 38) + '</div></header>' +
        '<section class="clarity-start" aria-labelledby="clarity-choose"><div class="section-heading"><div><h2 id="clarity-choose">Where would you like to begin?</h2>' +
        '<p class="muted small">Five gentle prompts. No right answers, and no rush.</p></div></div>' +
        '<div class="clarity-category-grid">' + categories.map((category, index) =>
          '<button type="button" class="card clarity-category" data-category="' + index + '"><span class="clarity-category-top"><span class="clarity-symbol tone-' + index + '">' +
          CS.icon(category.icon, 23) + '</span><span class="clarity-number">0' + (index + 1) + '</span></span><span class="eyebrow">' + esc(category.label) +
          '</span><span class="clarity-category-title">' + esc(category.title) + '</span><span class="muted clarity-category-description">' + esc(category.description) +
          '</span><span class="clarity-category-action">Begin reflection ' + CS.icon('arrow', 17) + '</span></button>'
        ).join('') + '</div></section>' +
        '<section class="clarity-library" aria-labelledby="clarity-saved"><div class="section-heading"><h2 id="clarity-saved">Your reflections</h2><span class="muted small">A place to return to</span></div>' +
        (saved.length ? '<div class="card clarity-records">' + saved.map(item => {
          const category = categories[item.category];
          const answerCount = item.answers.filter(answer => answer.trim()).length;
          const preview = item.focus.trim() || item.answers.find(answer => answer.trim()) || 'Your thoughts have a place here. Pick up whenever you’re ready.';
          return '<article class="clarity-record"><div class="clarity-record-symbol" aria-hidden="true">' + CS.icon(category.icon, 20) + '</div><div class="clarity-record-copy">' +
            '<div class="clarity-record-top"><h3>' + esc(category.title) + '</h3><span class="badge">' + (item.complete ? 'Reflected' : 'In progress') + '</span></div>' +
            '<p class="clarity-record-preview muted">' + esc(preview) + '</p><p class="muted small">' + esc(CS.formatDate(item.updatedAt)) + ' · ' + answerCount + ' of 5 prompts explored</p></div>' +
            '<div class="actions clarity-record-actions"><button type="button" class="btn" data-open="' + esc(item.id) + '">' + (item.complete ? 'View reflection' : 'Continue') + '</button>' +
            '<button type="button" class="icon-btn" data-delete="' + esc(item.id) + '" aria-label="Delete reflection: ' + esc(category.title) + '">' + CS.icon('trash', 17) + '</button></div></article>';
        }).join('') + '</div>' : '<div class="card clarity-empty"><span class="clarity-empty-icon" aria-hidden="true">' + CS.icon('file', 26) + '</span><div><h3>A fresh page is waiting.</h3><p class="muted">Choose a reflection above. Your words will be here when you come back.</p></div></div>') +
        '</section><p class="clarity-gentle-note">You don’t need to figure everything out to take a small step.</p>';
    }

    function drawQuestion(record) {
      const category = categories[record.category];
      root.innerHTML = '<div class="clarity-reading">' + backButton() + '<header class="clarity-exercise-heading"><p class="eyebrow">CLARITY CORNER · ' + esc(category.label) + '</p>' +
        '<h1>' + esc(category.title) + '</h1><p class="muted">' + esc(category.description) + '</p></header>' +
        '<div class="clarity-progress"><span class="muted small">Question ' + (step + 1) + ' of 5</span><nav class="clarity-steps" aria-label="Reflection questions">' +
        category.questions.map((question, index) => '<button type="button" class="clarity-step' + (index === step ? ' active' : '') + (record.answers[index].trim() ? ' answered' : '') +
          '" data-step="' + index + '" aria-label="Question ' + (index + 1) + ': ' + esc(question) + '"' + (index === step ? ' aria-current="step"' : '') + '><span class="sr-only">' + (index + 1) + '</span></button>').join('') + '</nav></div>' +
        '<section class="card clarity-question-card"><span class="clarity-question-number" aria-hidden="true">0' + (step + 1) + '</span><label for="clarity-answer" class="clarity-question-title">' + esc(category.questions[step]) +
        '</label><p class="muted" id="clarity-hint">' + esc(category.hints[step]) + '</p><textarea id="clarity-answer" rows="9" maxlength="10000" placeholder="Start with whatever comes to mind…" aria-describedby="clarity-hint">' +
        esc(record.answers[step]) + '</textarea><div class="clarity-writing-note"><span>' + CS.icon('leaf', 14) + ' A few words are enough.</span><span class="muted small">Optional</span></div></section>' +
        '<div class="clarity-question-actions"><button type="button" class="btn" data-clarity="previous"' + (step === 0 ? ' disabled' : '') + '>← Previous</button><div class="actions">' +
        '<button type="button" class="btn quiet" data-clarity="next">Skip for now</button><button type="button" class="btn primary" data-clarity="next">' + (step === 4 ? 'Review reflection' : 'Next question') + ' ' + CS.icon('arrow', 17) + '</button></div></div>' +
        '<p class="clarity-gentle-note">You can come back to any question, anytime.</p></div>';
    }

    function drawSummary(record) {
      const category = categories[record.category];
      root.innerHTML = '<div class="clarity-reading">' + backButton() + '<header class="clarity-exercise-heading"><p class="eyebrow">YOUR REFLECTION</p><h1>A moment of clarity.</h1><p class="muted">' +
        esc(category.title) + ' · ' + esc(CS.formatDate(record.createdAt)) + '</p></header><section class="card clarity-summary" aria-label="Your answers">' +
        category.questions.map((question, index) => '<article class="clarity-summary-answer"><div class="section-heading"><h2>' + esc(question) + '</h2><button type="button" class="icon-btn" data-step="' + index + '" aria-label="Edit answer to ' + esc(question) + '">' + CS.icon('edit', 17) + '</button></div><p class="clarity-answer' + (record.answers[index].trim() ? '' : ' muted') + '">' + (record.answers[index].trim() ? esc(record.answers[index]) : 'Left open for now.') + '</p></article>').join('') +
        '</section><section class="card clarity-next-step"><span class="eyebrow">ONE SMALL STEP</span><h2><label for="clarity-focus">After reflecting on everything, what is one thing you would like to focus on?</label></h2>' +
        '<p class="muted">Something small and possible is a good place to start. You can leave this open, too.</p><textarea id="clarity-focus" rows="3" maxlength="500" placeholder="One thing I’d like to make space for…">' + esc(record.focus) +
        '</textarea><button type="button" class="btn" data-clarity="plan"' + (record.focus.trim() ? '' : ' disabled') + '>' + CS.icon('weekly', 17) + ' Add to Weekly Reset</button></section>' +
        '<div class="clarity-summary-actions"><button type="button" class="btn" data-clarity="print">' + CS.icon('download', 17) + ' Print / save PDF</button><button type="button" class="btn primary" data-clarity="finish">' + (record.complete ? 'Done' : 'Finish reflection') + ' ' + CS.icon('check', 17) + '</button></div>' +
        '<p class="clarity-gentle-note">Every reflection is a starting point, not a final answer.</p></div>';
    }

    async function handleClick(event) {
      const button = event.target.closest('button');
      if (!button || !root.contains(button)) return;
      if (button.dataset.category !== undefined) {
        flush();
        const category = Number(button.dataset.category);
        if (!categories[category]) return;
        const now = new Date().toISOString();
        const record = { id: CS.uid(), category: category, answers: ['', '', '', '', ''], focus: '', createdAt: now, updatedAt: now, complete: false };
        CS.state.reflections.unshift(record);
        activeId = record.id;
        step = 0;
        CS.touch('Started a reflection', 'clarity');
        draw('#clarity-answer');
        return;
      }
      if (button.dataset.open) {
        activeId = button.dataset.open;
        const record = current();
        if (!record) return;
        const firstEmpty = record.answers.findIndex(answer => !answer.trim());
        step = record.complete ? 5 : (firstEmpty < 0 ? 5 : firstEmpty);
        draw();
        return;
      }
      if (button.dataset.delete) {
        const id = button.dataset.delete;
        if (await CS.confirm('Delete this reflection and its answers? This cannot be undone.')) {
          flush();
          CS.state.reflections = CS.state.reflections.filter(record => record.id !== id);
          CS.save();
          CS.toast('Reflection deleted.');
          draw();
        }
        return;
      }
      if (button.dataset.step !== undefined) {
        const targetStep = Number(button.dataset.step);
        if (targetStep >= 0 && targetStep < 5) {
          step = targetStep;
          draw('#clarity-answer');
        }
        return;
      }
      const action = button.dataset.clarity;
      const record = current();
      if (action === 'library') {
        flush(); activeId = null; draw();
      } else if (action === 'previous') {
        step = Math.max(0, step - 1); draw('#clarity-answer');
      } else if (action === 'next') {
        step = Math.min(5, step + 1); draw(step < 5 ? '#clarity-answer' : '#clarity-focus');
      } else if (action === 'finish' && record) {
        flush();
        record.complete = true;
        record.updatedAt = new Date().toISOString();
        CS.touch('Made space for a reflection', 'clarity');
        activeId = null;
        draw();
        CS.toast('A little time for yourself, well spent.');
      } else if (action === 'print' && record) {
        flush(); printReflection(record);
      } else if (action === 'plan' && record && record.focus.trim()) {
        flush(); CS.addWeeklyTask(record.focus.trim(), 'Personal');
      }
    }

    function handleInput(event) {
      const record = current();
      if (!record) return;
      if (event.target.id === 'clarity-answer' && step < 5) {
        record.answers[step] = event.target.value;
        const dot = root.querySelector('[data-step="' + step + '"]');
        if (dot) dot.classList.toggle('answered', !!event.target.value.trim());
        scheduleSave(record);
      } else if (event.target.id === 'clarity-focus') {
        record.focus = event.target.value;
        const plan = root.querySelector('[data-clarity="plan"]');
        if (plan) plan.disabled = !record.focus.trim();
        scheduleSave(record);
      }
    }

    root.addEventListener('click', handleClick);
    root.addEventListener('input', handleInput);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    draw();
    return function () {
      flush();
      root.removeEventListener('click', handleClick);
      root.removeEventListener('input', handleInput);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  };
}());
