(function () {
  'use strict';
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const categories = ['Career', 'Learning', 'Personal', 'Health and wellbeing', 'Relationships', 'Other'];
  const reviewQuestions = ['What went well?', 'What did I learn?', 'What didn’t go as planned?', 'What would I change next week?', 'What am I proud of?'];
  let selectedWeek = null;
  let selectedDay = (new Date().getDay() + 6) % 7;
  let reviewOpen = false;
  let draggedTask = null;

  function dateFromKey(key) { return new Date(key + 'T12:00:00'); }
  function dayDate(key, day) { const date = dateFromKey(key); date.setDate(date.getDate() + day); return date; }
  function dateKey(date) { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); }
  function offsetWeek(key, offset) { return dateKey(dayDate(key, offset * 7)); }
  function weekLabel(key) {
    const start = dateFromKey(key), end = dayDate(key, 6);
    const options = { month: 'short', day: 'numeric' };
    return start.toLocaleDateString(undefined, options) + ' – ' + end.toLocaleDateString(undefined, { ...options, year: 'numeric' });
  }
  function categoryClass(category) { return 'cat-' + categories.indexOf(category); }

  function openTaskEditor(weekKey, taskId, title, category, defaultDay) {
    const week = CS.getWeek(weekKey);
    const oldTask = taskId ? week.tasks.find(task => task.id === taskId) : null;
    if (taskId && !oldTask) return;
    const task = oldTask || { title: title || '', day: defaultDay == null ? selectedDay : defaultDay, time: '', category: categories.includes(category) ? category : 'Career', done: false };
    CS.modal(oldTask ? 'Edit your activity' : 'Make space for an activity', `
      <p class="muted small">Week of ${CS.esc(weekLabel(weekKey))}. Keep it small and manageable.</p>
      <form id="weekly-task-form">
        <div class="form-grid">
          <label class="field full" for="weekly-task-title">Activity<input id="weekly-task-title" name="title" required maxlength="300" value="${CS.esc(task.title)}" placeholder="e.g. Spend 20 minutes exploring a role" autocomplete="off"></label>
          <label class="field" for="weekly-task-day">Day<select id="weekly-task-day" name="day">${days.map((day, index) => `<option value="${index}"${task.day === index ? ' selected' : ''}>${day}</option>`).join('')}</select></label>
          <label class="field" for="weekly-task-time">Time <span class="muted small">(optional)</span><input id="weekly-task-time" name="time" type="time" value="${CS.esc(task.time || '')}"></label>
          <label class="field full" for="weekly-task-category">Category<select id="weekly-task-category" name="category">${categories.map(value => `<option${task.category === value ? ' selected' : ''}>${CS.esc(value)}</option>`).join('')}</select></label>
        </div>
        <div class="modal-actions">${oldTask ? '<button type="button" class="btn danger" id="weekly-delete-task">Delete activity</button>' : ''}<button type="button" class="btn" id="weekly-cancel-task">Cancel</button><button type="submit" class="btn primary">${oldTask ? 'Save changes' : 'Add activity'}</button></div>
      </form>`, dialog => {
      const form = dialog.querySelector('#weekly-task-form');
      form.addEventListener('submit', event => {
        event.preventDefault();
        const formData = new FormData(form);
        const taskTitle = String(formData.get('title')).trim();
        if (!taskTitle) { form.elements.title.setCustomValidity('Please add a short activity name.'); form.elements.title.reportValidity(); return; }
        const updates = { title: taskTitle, day: Number(formData.get('day')), time: String(formData.get('time')), category: String(formData.get('category')) };
        if (oldTask) Object.assign(oldTask, updates);
        else week.tasks.push({ id: CS.uid(), ...updates, done: false });
        CS.touch(oldTask ? 'Adjusted a weekly activity' : 'Made space for a weekly activity', 'weekly');
        CS.closeModal();
        CS.render();
        CS.toast(oldTask ? 'Your activity has been updated.' : 'A little space made in your week.');
      });
      form.elements.title.addEventListener('input', () => form.elements.title.setCustomValidity(''));
      dialog.querySelector('#weekly-cancel-task').addEventListener('click', CS.closeModal);
      const deleteButton = dialog.querySelector('#weekly-delete-task');
      if (deleteButton) deleteButton.addEventListener('click', async () => {
        CS.closeModal();
        if (await CS.confirm('Delete this activity? It will be removed from this week.')) {
          week.tasks = week.tasks.filter(item => item.id !== oldTask.id);
          CS.save(); CS.render(); CS.toast('Activity removed.');
        }
      });
    });
  }

  CS.addWeeklyTask = function (title, category) {
    openTaskEditor(CS.weekKey(), null, title || '', category || 'Career', (new Date().getDay() + 6) % 7);
  };

  function taskMarkup(task) {
    return `<article class="weekly-task${task.done ? ' is-done' : ''}" draggable="true" data-task-id="${CS.esc(task.id)}">
      <div class="weekly-task-top"><label class="weekly-task-check"><input type="checkbox" data-complete="${CS.esc(task.id)}"${task.done ? ' checked' : ''}><span class="sr-only">Mark ${CS.esc(task.title)} ${task.done ? 'incomplete' : 'complete'}</span></label><button class="weekly-task-title" type="button" data-edit="${CS.esc(task.id)}" title="Edit activity">${CS.esc(task.title)}</button></div>
      <div class="weekly-task-meta"><span class="weekly-category ${categoryClass(task.category)}">${CS.esc(task.category)}</span>${task.time ? `<span class="weekly-task-time">${CS.icon('clock', 12)} ${CS.esc(task.time)}</span>` : ''}</div>
      <div class="weekly-task-actions"><button type="button" class="weekly-small-button" data-focus="${CS.esc(task.id)}">${CS.icon('focus', 13)} Focus</button><button type="button" class="weekly-small-button" data-edit="${CS.esc(task.id)}" aria-label="Edit ${CS.esc(task.title)}">${CS.icon('edit', 13)} Edit</button></div>
    </article>`;
  }

  CS.pages.weekly = function (root) {
    selectedWeek = selectedWeek || CS.weekKey();
    const key = selectedWeek;
    const week = CS.getWeek(key);
    // The central store debounces writes and flushes them on pagehide.
    // Queue there immediately so a quick refresh cannot lose the last keystroke.
    function saveSoon() { CS.save(); }
    function flush() { if (CS.flush) CS.flush(); }
    const current = key === CS.weekKey();
    const pending = week.tasks.filter(task => !task.done);
    root.innerHTML = `
      <header class="page-heading weekly-page-heading"><div><p class="eyebrow">YOUR WEEKLY RESET</p><h1>A week with intention.</h1><p class="muted">Let’s make space for what matters. Leave a little room to breathe.</p></div><button type="button" class="btn primary" id="weekly-add">${CS.icon('plus', 17)} Add activity</button></header>
      <div class="weekly-week-bar"><div class="weekly-week-navigation"><button type="button" class="icon-btn weekly-previous" id="weekly-previous" aria-label="Previous week">${CS.icon('chevron', 19)}</button><h2>${CS.esc(weekLabel(key))}</h2><button type="button" class="icon-btn" id="weekly-next" aria-label="Next week">${CS.icon('chevron', 19)}</button></div><button type="button" class="btn quiet small" id="weekly-today"${current ? ' disabled' : ''}>${current ? 'This week' : 'Back to this week'}</button></div>
      <section class="card weekly-priorities" aria-labelledby="weekly-priorities-title"><div class="section-heading"><div><p class="eyebrow">A LITTLE DIRECTION</p><h2 id="weekly-priorities-title">My three priorities</h2></div><span class="muted small">Just a few things that matter.</span></div><div class="weekly-priority-grid">${week.priorities.map((value, index) => `<label class="weekly-priority" for="weekly-priority-${index}"><span class="weekly-priority-number">0${index + 1}</span><span class="sr-only">Priority ${index + 1}</span><input id="weekly-priority-${index}" data-priority="${index}" value="${CS.esc(value)}" maxlength="300" placeholder="${['One step for your future', 'Something you want to learn', 'Something just for you'][index]}"></label>`).join('')}</div></section>
      <section class="weekly-calendar" aria-labelledby="weekly-calendar-title"><div class="section-heading"><h2 id="weekly-calendar-title">This week’s activities</h2><span class="small muted weekly-drag-hint">Drag to move, or choose Edit.</span></div>
      <div class="weekly-day-picker" role="group" aria-label="Choose day">${days.map((day, index) => `<button type="button" data-select-day="${index}" class="weekly-day-choice${selectedDay === index ? ' active' : ''}" aria-pressed="${selectedDay === index}"><span>${day.slice(0, 3)}</span><strong>${dayDate(key, index).getDate()}</strong></button>`).join('')}</div>
      <div class="weekly-grid">${days.map((day, index) => {
        const date = dayDate(key, index);
        const isToday = dateKey(date) === CS.today();
        const tasks = week.tasks.filter(task => task.day === index).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
        return `<section class="weekly-day${selectedDay === index ? ' is-selected' : ''}${isToday ? ' is-today' : ''}" data-day="${index}" aria-label="${day}"><header class="weekly-day-heading"><span>${day.slice(0, 3)}</span><span class="weekly-date">${date.getDate()}</span>${isToday ? '<span class="sr-only">Today</span>' : ''}</header><div class="weekly-day-tasks">${tasks.length ? tasks.map(taskMarkup).join('') : '<p class="weekly-open-day">Room to<br>breathe.</p>'}</div><button type="button" class="weekly-add-day" data-add-day="${index}" aria-label="Add activity on ${day}">${CS.icon('plus', 15)}<span>Add activity</span></button></section>`;
      }).join('')}</div></section>
      <div class="weekly-bottom"><div class="weekly-gentle-note">${CS.icon('leaf', 24)}<p>Rest belongs in your plan, too.<br><span class="muted small">A good week has room for being human.</span></p></div>${pending.length ? `<button type="button" class="btn" id="weekly-carry">Move unfinished activities to next week ${CS.icon('arrow', 16)}</button>` : ''}</div>
      <details class="card weekly-review"${reviewOpen ? ' open' : ''}><summary><span>${CS.icon('clarity', 22)}<span><strong>A moment to look back</strong><span class="muted small">Notice what this week taught you.</span></span></span>${CS.icon('chevron', 18)}</summary><div class="weekly-review-body"><p class="muted">There’s no score here. Take what you need, and leave the rest.</p><div class="form-grid">${reviewQuestions.map((question, index) => `<label class="field${index === 4 ? ' full' : ''}" for="weekly-review-${index}">${question}<textarea id="weekly-review-${index}" data-review="${index}" rows="3" maxlength="12000" placeholder="A few words is enough…">${CS.esc(week.review[index] || '')}</textarea></label>`).join('')}</div><p class="small muted">Your reflections save automatically as you write.</p></div></details>`;

    root.querySelector('#weekly-add').addEventListener('click', () => { flush(); openTaskEditor(key, null, '', 'Career', selectedDay); });
    root.querySelector('#weekly-previous').addEventListener('click', () => { flush(); selectedWeek = offsetWeek(key, -1); CS.render(); });
    root.querySelector('#weekly-next').addEventListener('click', () => { flush(); selectedWeek = offsetWeek(key, 1); CS.render(); });
    root.querySelector('#weekly-today').addEventListener('click', () => { flush(); selectedWeek = CS.weekKey(); selectedDay = (new Date().getDay() + 6) % 7; CS.render(); });
    root.querySelectorAll('[data-priority]').forEach(input => input.addEventListener('input', () => { week.priorities[Number(input.dataset.priority)] = input.value; saveSoon(); }));
    root.querySelectorAll('[data-review]').forEach(input => input.addEventListener('input', () => { week.review[Number(input.dataset.review)] = input.value; saveSoon(); }));
    root.querySelector('.weekly-review').addEventListener('toggle', event => { reviewOpen = event.currentTarget.open; });
    root.querySelectorAll('[data-select-day]').forEach(button => button.addEventListener('click', () => {
      selectedDay = Number(button.dataset.selectDay);
      root.querySelectorAll('[data-select-day]').forEach(item => { const active = Number(item.dataset.selectDay) === selectedDay; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
      root.querySelectorAll('.weekly-day').forEach(item => item.classList.toggle('is-selected', Number(item.dataset.day) === selectedDay));
    }));
    root.querySelectorAll('[data-add-day]').forEach(button => button.addEventListener('click', () => { flush(); openTaskEditor(key, null, '', 'Career', Number(button.dataset.addDay)); }));
    root.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => { flush(); openTaskEditor(key, button.dataset.edit); }));
    root.querySelectorAll('[data-complete]').forEach(input => input.addEventListener('change', () => {
      const task = week.tasks.find(item => item.id === input.dataset.complete);
      if (!task) return;
      task.done = input.checked;
      input.closest('.weekly-task').classList.toggle('is-done', task.done);
      CS.save(); CS.render();
    }));
    root.querySelectorAll('[data-focus]').forEach(button => button.addEventListener('click', () => {
      const task = week.tasks.find(item => item.id === button.dataset.focus);
      if (task) { flush(); CS.focusTask(task.title); }
    }));
    root.querySelectorAll('.weekly-task').forEach(card => {
      card.addEventListener('dragstart', event => {
        draggedTask = card.dataset.taskId;
        event.dataTransfer.setData('text/plain', draggedTask);
        event.dataTransfer.effectAllowed = 'move';
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend', () => {
        draggedTask = null;
        card.classList.remove('is-dragging');
        root.querySelectorAll('.weekly-day').forEach(day => day.classList.remove('is-drag-over'));
      });
    });
    root.querySelectorAll('.weekly-day').forEach(day => {
      day.addEventListener('dragover', event => { if (draggedTask) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; day.classList.add('is-drag-over'); } });
      day.addEventListener('dragleave', event => { if (!day.contains(event.relatedTarget)) day.classList.remove('is-drag-over'); });
      day.addEventListener('drop', event => {
        event.preventDefault(); day.classList.remove('is-drag-over');
        const id = draggedTask;
        draggedTask = null;
        const task = week.tasks.find(item => item.id === id);
        if (task && task.day !== Number(day.dataset.day)) {
          task.day = Number(day.dataset.day); CS.save(); CS.render(); CS.toast('Activity moved to ' + days[task.day] + '.');
        }
      });
    });
    const carry = root.querySelector('#weekly-carry');
    if (carry) carry.addEventListener('click', async () => {
      flush();
      const unfinished = week.tasks.filter(task => !task.done);
      if (!unfinished.length) return;
      if (await CS.confirm('Some things didn’t fit into this week. Move ' + unfinished.length + ' unfinished ' + (unfinished.length === 1 ? 'activity' : 'activities') + ' into next week? They will keep their day and time.')) {
        const next = CS.getWeek(offsetWeek(key, 1));
        const movingIds = new Set(unfinished.map(task => task.id));
        next.tasks.push(...unfinished.filter(task => !next.tasks.some(existing => existing.id === task.id)));
        week.tasks = week.tasks.filter(task => !movingIds.has(task.id));
        CS.touch('Made room in next week’s plan', 'weekly'); CS.render(); CS.toast('Moved to next week. You can pick them up when you’re ready.');
      }
    });
    return flush;
  };
})();
