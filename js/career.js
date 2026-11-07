(function () {
  'use strict';
  const statuses = ['Interested', 'Preparing application', 'Applied', 'Interview', 'Offer received', 'Rejected', 'Withdrawn'];
  const skillStatuses = ['Not started', 'In progress', 'Completed'];
  const prompts = ['Which subjects did I genuinely enjoy?', 'What types of problems do I like solving?', 'What industries interest me?', 'What kind of working environment would suit me?', 'Which roles would I like to research?'];
  let tab = 'applications', view = 'table', query = '', filter = '';
  const e = value => CS.esc(value == null ? '' : value);
  const option = (value, selected) => `<option value="${e(value)}"${value === selected ? ' selected' : ''}>${e(value)}</option>`;
  const safeURL = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (_) { return ''; } };
  const statusClass = value => 'status-' + Math.max(0, statuses.indexOf(value));
  const badge = value => `<span class="badge career-status ${statusClass(value)}">${e(value)}</span>`;
  const empty = (title, copy, action, label) => `<div class="empty-state career-empty"><span class="career-empty-icon">${CS.icon('career', 28)}</span><h2>${title}</h2><p>${copy}</p><button type="button" class="btn primary" data-career-action="${action}">${CS.icon('plus', 18)}${label}</button></div>`;

  function applicationForm(id) {
    const existing = CS.state.applications.find(item => item.id === id);
    const item = existing || {company: '', title: '', status: 'Interested', date: '', location: '', url: '', interview: '', notes: ''};
    CS.modal(existing ? 'Edit application' : 'A new possibility', `<form id="career-application-form">
      <p class="muted">Start with the essentials. You can add more details whenever you like.</p>
      <div class="form-grid">
        <label class="field">Company <input name="company" required maxlength="160" autocomplete="organization" value="${e(item.company)}" placeholder="Company or organisation"></label>
        <label class="field">Job title <input name="title" required maxlength="200" value="${e(item.title)}" placeholder="Role you’re interested in"></label>
        <label class="field full">Application status <select name="status">${statuses.map(s => option(s, item.status)).join('')}</select></label>
      </div>
      <details class="career-form-details"${existing ? ' open' : ''}><summary>More details <span class="muted">(optional)</span></summary><div class="form-grid">
        <label class="field">Application date <input name="date" type="date" value="${e(item.date)}"></label>
        <label class="field">Location <input name="location" maxlength="200" value="${e(item.location)}" placeholder="City, country, or remote"></label>
        <label class="field full">Job posting URL <input name="url" type="url" value="${e(item.url)}" maxlength="2000" placeholder="https://…"><span class="small muted">Use a full link beginning with https:// or http://.</span></label>
        <label class="field full">Interview date and time <input name="interview" type="datetime-local" value="${e(item.interview)}"></label>
        <label class="field full">Notes <textarea name="notes" rows="4" maxlength="10000" placeholder="People to contact, preparation ideas, or your next step…">${e(item.notes)}</textarea></label>
      </div></details>
      <p class="career-form-error" role="alert" id="career-form-error"></p>
      <div class="modal-actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn primary">${existing ? 'Save changes' : 'Add application'}</button></div>
    </form>`, dialog => {
      const form = dialog.querySelector('form');
      dialog.querySelector('[data-cancel]').addEventListener('click', CS.closeModal);
      form.addEventListener('submit', event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form));
        Object.keys(values).forEach(key => values[key] = values[key].trim());
        if (!values.company || !values.title) { dialog.querySelector('#career-form-error').textContent = 'Please enter a company and job title.'; return; }
        if (values.url && !safeURL(values.url)) { dialog.querySelector('#career-form-error').textContent = 'Please use a complete http:// or https:// link.'; form.elements.url.focus(); return; }
        const now = new Date().toISOString();
        if (existing) Object.assign(existing, values, {updatedAt: now});
        else CS.state.applications.unshift(Object.assign(values, {id: CS.uid(), createdAt: now, updatedAt: now}));
        CS.touch(existing ? 'Updated an application' : 'Added a career opportunity', 'career');
        CS.closeModal(); CS.render(); CS.toast(existing ? 'Application updated.' : 'Your opportunity is added.');
      });
    });
  }

  function applicationDetails(id) {
    const item = CS.state.applications.find(a => a.id === id);
    if (!item) return;
    const link = safeURL(item.url);
    CS.modal(item.title, `<div class="career-detail-heading"><p>${e(item.company)}</p>${badge(item.status)}</div>
      <dl class="career-detail-grid"><div><dt>Location</dt><dd>${e(item.location) || 'Not added'}</dd></div><div><dt>Application date</dt><dd>${item.date ? e(CS.formatDate(item.date)) : 'Not added'}</dd></div><div class="full"><dt>Interview</dt><dd>${item.interview ? e(CS.formatDate(item.interview, {dateStyle: 'medium', timeStyle: 'short'})) : 'Not scheduled'}</dd></div></dl>
      ${item.notes ? `<h3>Your notes</h3><p class="career-notes">${e(item.notes)}</p>` : '<p class="muted">Add notes to keep your next step close at hand.</p>'}
      ${link ? `<a class="btn" href="${e(link)}" target="_blank" rel="noopener noreferrer">Open job posting ${CS.icon('arrow', 16)}</a>` : ''}
      <div class="modal-actions career-detail-actions"><button type="button" class="btn danger" data-delete>${CS.icon('trash', 16)}Delete</button><button type="button" class="btn" data-plan>Plan a next step</button><button type="button" class="btn primary" data-edit>${CS.icon('edit', 16)}Edit application</button></div>`, dialog => {
      dialog.querySelector('[data-edit]').addEventListener('click', () => { CS.closeModal(); applicationForm(id); });
      dialog.querySelector('[data-plan]').addEventListener('click', () => { CS.closeModal(); CS.addWeeklyTask(`Next step: ${item.title} at ${item.company}`, 'Career'); });
      dialog.querySelector('[data-delete]').addEventListener('click', () => { CS.closeModal(); removeRecord('applications', id, `Delete the ${item.title} application at ${item.company}?`); });
    });
  }

  async function removeRecord(collection, id, message) {
    if (!await CS.confirm(message + ' This cannot be undone.')) return;
    if (collection === 'ideas') CS.state.exploration.items = CS.state.exploration.items.filter(item => item.id !== id);
    else CS.state[collection] = CS.state[collection].filter(item => item.id !== id);
    CS.save(); CS.render(); CS.toast('Item deleted.');
  }

  function filteredApplications() {
    return CS.state.applications.filter(item => (!filter || item.status === filter) && (!query || `${item.company} ${item.title} ${item.location} ${item.notes}`.toLowerCase().includes(query.toLowerCase())));
  }

  function applicationContent() {
    if (!CS.state.applications.length) return empty('Your career journey starts here.', 'Keep opportunities, preparation, and next steps together. Add one role that interests you.', 'add-application', 'Add your first application');
    const items = filteredApplications();
    if (!items.length) return '<div class="empty-state"><h3>No matching opportunities</h3><p>Try another search or show all statuses.</p><button type="button" class="btn" data-career-action="clear-filters">Clear filters</button></div>';
    if (view === 'board') return `<div class="career-board" aria-label="Applications by status">${statuses.map(status => {
      const entries = items.filter(item => item.status === status);
      return `<section class="career-board-column"><div class="career-board-header"><h3>${e(status)}</h3><span class="career-count">${entries.length}</span></div><div class="career-board-stack">${entries.map(item => `<article class="career-opportunity"><button type="button" class="career-card-title" data-career-action="details" data-id="${e(item.id)}">${e(item.title)}</button><p>${e(item.company)}</p>${item.location ? `<span class="small muted">${e(item.location)}</span>` : ''}<label class="field career-board-status"><span class="sr-only">Status for ${e(item.title)} at ${e(item.company)}</span><select data-application-status="${e(item.id)}">${statuses.map(s => option(s, item.status)).join('')}</select></label></article>`).join('') || '<p class="career-column-empty">Room for possibilities.</p>'}</div></section>`;
    }).join('')}</div><p class="small muted career-board-hint">Scroll across to see every stage. Change a card’s status to move it.</p>`;
    return `<div class="career-table-wrap"><table class="career-table"><caption class="sr-only">Your saved job applications</caption><thead><tr><th scope="col">Opportunity</th><th scope="col">Status</th><th scope="col">Applied</th><th scope="col">Location</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${items.map(item => `<tr><td><button class="career-table-title" type="button" data-career-action="details" data-id="${e(item.id)}">${e(item.title)}</button><span class="career-company">${e(item.company)}</span></td><td>${badge(item.status)}</td><td class="small">${item.date ? e(CS.formatDate(item.date)) : '<span class="muted">—</span>'}</td><td class="small">${e(item.location) || '<span class="muted">—</span>'}</td><td><div class="actions"><button type="button" class="icon-btn" aria-label="Edit ${e(item.title)} at ${e(item.company)}" data-career-action="edit-application" data-id="${e(item.id)}">${CS.icon('edit', 17)}</button><button type="button" class="icon-btn" aria-label="Delete ${e(item.title)} at ${e(item.company)}" data-career-action="delete-application" data-id="${e(item.id)}">${CS.icon('trash', 17)}</button></div></td></tr>`).join('')}</tbody></table></div>`;
  }

  function applicationsMarkup() {
    const hasRecords = CS.state.applications.length > 0;
    return `<div class="section-heading"><div><h2>My applications</h2><p class="muted small">A little organisation for your next opportunity.</p></div><button type="button" class="btn primary" data-career-action="add-application">${CS.icon('plus', 18)}Add application</button></div>
      ${hasRecords ? `<div class="career-summary" aria-label="Application overview">${[['Saved opportunities', CS.state.applications.length], ['In preparation', CS.state.applications.filter(x => x.status === 'Preparing application').length], ['Interviews', CS.state.applications.filter(x => x.status === 'Interview').length], ['Offers received', CS.state.applications.filter(x => x.status === 'Offer received').length]].map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>` : ''}
      <div class="card career-applications-card"><div class="career-toolbar"><label class="career-search"><span class="sr-only">Search applications</span>${CS.icon('search', 18)}<input type="search" id="career-search" placeholder="Find an opportunity…" value="${e(query)}"></label><label class="career-filter"><span class="sr-only">Filter application status</span><select id="career-filter"><option value="">All statuses</option>${statuses.map(s => option(s, filter)).join('')}</select></label><div class="career-view-switch" aria-label="Application view"><button type="button" data-career-action="view-table" class="${view === 'table' ? 'active' : ''}" aria-pressed="${view === 'table'}">Table</button><button type="button" data-career-action="view-board" class="${view === 'board' ? 'active' : ''}" aria-pressed="${view === 'board'}">Board</button></div></div><div id="career-applications-content">${applicationContent()}</div></div>`;
  }

  function skillForm(id) {
    const existing = CS.state.skills.find(item => item.id === id);
    const item = existing || {name: '', reason: '', target: '', status: 'Not started'};
    CS.modal(existing ? 'Edit skill goal' : 'Make room to learn', `<form id="career-skill-form"><p class="muted">Choose something you’re curious about. Progress can happen at your own pace.</p><div class="form-grid"><label class="field full">Skill name <input name="name" required maxlength="200" value="${e(item.name)}" placeholder="What would you like to learn?"></label><label class="field full">Why I want to learn it <textarea name="reason" rows="3" maxlength="5000" placeholder="A small goal or a reason that matters to you…">${e(item.reason)}</textarea></label><label class="field">Target date <span class="small muted">(optional)</span><input type="date" name="target" value="${e(item.target)}"></label><label class="field">Progress <select name="status">${skillStatuses.map(s => option(s, item.status)).join('')}</select></label></div><p class="career-form-error" role="alert"></p><div class="modal-actions"><button class="btn" type="button" data-cancel>Cancel</button><button class="btn primary" type="submit">${existing ? 'Save changes' : 'Add skill goal'}</button></div></form>`, dialog => {
      const form = dialog.querySelector('form');
      dialog.querySelector('[data-cancel]').addEventListener('click', CS.closeModal);
      form.addEventListener('submit', event => {
        event.preventDefault(); const values = Object.fromEntries(new FormData(form));
        Object.keys(values).forEach(key => values[key] = values[key].trim());
        if (!values.name) { dialog.querySelector('[role="alert"]').textContent = 'Please enter the skill you want to learn.'; return; }
        const now = new Date().toISOString();
        if (existing) Object.assign(existing, values, {updatedAt: now});
        else CS.state.skills.unshift(Object.assign(values, {id: CS.uid(), createdAt: now, updatedAt: now}));
        CS.touch(existing ? 'Updated a skill goal' : 'Added a skill to explore', 'career');
        CS.closeModal(); CS.render(); CS.toast('Your skill goal is ready.');
      });
    });
  }

  function skillsMarkup() {
    return `<div class="section-heading"><div><h2>Skills to grow</h2><p class="muted small">Follow your curiosity, one small learning goal at a time.</p></div><button type="button" class="btn primary" data-career-action="add-skill">${CS.icon('plus', 18)}Add skill goal</button></div>${CS.state.skills.length ? `<div class="career-skills-grid">${CS.state.skills.map(item => `<article class="card career-skill-card"><div class="section-heading"><span class="career-skill-mark">${CS.icon('leaf', 22)}</span><div class="actions"><button class="icon-btn" type="button" data-career-action="edit-skill" data-id="${e(item.id)}" aria-label="Edit ${e(item.name)}">${CS.icon('edit', 17)}</button><button class="icon-btn" type="button" data-career-action="delete-skill" data-id="${e(item.id)}" aria-label="Delete ${e(item.name)}">${CS.icon('trash', 17)}</button></div></div><h3>${e(item.name)}</h3><p class="career-notes muted">${e(item.reason) || 'A new possibility to explore.'}</p>${item.target ? `<p class="small muted">${CS.icon('clock', 15)} Aim for ${e(CS.formatDate(item.target))}</p>` : ''}<label class="field"><span class="small">Progress</span><select data-skill-status="${e(item.id)}">${skillStatuses.map(s => option(s, item.status)).join('')}</select></label><button type="button" class="btn quiet career-plan-btn" data-career-action="plan-skill" data-id="${e(item.id)}">Add to my week ${CS.icon('arrow', 16)}</button></article>`).join('')}</div>` : `<div class="card">${empty('There’s always room to grow.', 'A practical skill, a project, or more confidence in interviews. Choose a goal that feels useful to you.', 'add-skill', 'Add your first skill goal')}</div>`}`;
  }

  function ideaForm(id) {
    const existing = CS.state.exploration.items.find(item => item.id === id);
    const item = existing || {type: 'Role', title: '', notes: ''};
    CS.modal(existing ? 'Edit a possibility' : 'Save a possibility', `<form><div class="form-grid"><label class="field full">What are you exploring? <select name="type">${['Industry', 'Role', 'Question'].map(s => option(s, item.type)).join('')}</select></label><label class="field full">Title <input name="title" required maxlength="300" value="${e(item.title)}" placeholder="A role, an industry, or a question"></label><label class="field full">Notes <textarea name="notes" maxlength="8000" rows="4" placeholder="What interests you? What would you like to find out?">${e(item.notes)}</textarea></label></div><p class="career-form-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn primary">${existing ? 'Save changes' : 'Save possibility'}</button></div></form>`, dialog => {
      dialog.querySelector('[data-cancel]').addEventListener('click', CS.closeModal);
      dialog.querySelector('form').addEventListener('submit', event => {
        event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
        Object.keys(values).forEach(key => values[key] = values[key].trim());
        if (!values.title) { dialog.querySelector('[role="alert"]').textContent = 'Please give this possibility a title.'; return; }
        if (existing) Object.assign(existing, values);
        else CS.state.exploration.items.unshift(Object.assign(values, {id: CS.uid()}));
        CS.touch(existing ? 'Updated a career possibility' : 'Saved a career possibility', 'career');
        CS.closeModal(); CS.render(); CS.toast('Possibility saved.');
      });
    });
  }

  function explorationMarkup() {
    return `<div class="section-heading"><div><h2>Follow a little curiosity.</h2><p class="muted small">You don’t need the whole answer. Start with what interests you.</p></div></div><div class="career-explore-layout"><section class="card career-prompts"><div class="eyebrow">A place to begin</div><h3>What feels like a good fit?</h3><p class="muted small">Answer whichever prompts feel helpful. Your notes save automatically.</p>${prompts.map((prompt, index) => `<label class="field career-prompt"><span><span class="career-prompt-number">0${index + 1}</span>${prompt}</span><textarea data-exploration-answer="${index}" rows="3" maxlength="12000" placeholder="There’s no right answer…">${e(CS.state.exploration.answers[index])}</textarea></label>`).join('')}</section><section class="career-possibilities"><div class="section-heading"><h3>Possibilities to explore</h3><button type="button" class="icon-btn" data-career-action="add-idea" aria-label="Add a career possibility">${CS.icon('plus', 20)}</button></div><p class="small muted">A short list of things you’d like to learn more about.</p><div class="stack">${CS.state.exploration.items.map(item => `<article class="card career-idea"><div class="section-heading"><span class="badge">${e(item.type)}</span><div class="actions"><button type="button" class="icon-btn" data-career-action="edit-idea" data-id="${e(item.id)}" aria-label="Edit ${e(item.title)}">${CS.icon('edit', 16)}</button><button type="button" class="icon-btn" data-career-action="delete-idea" data-id="${e(item.id)}" aria-label="Delete ${e(item.title)}">${CS.icon('trash', 16)}</button></div></div><h3>${e(item.title)}</h3>${item.notes ? `<p class="small muted career-notes">${e(item.notes)}</p>` : ''}<button type="button" class="btn quiet" data-career-action="plan-idea" data-id="${e(item.id)}">Make time to explore ${CS.icon('arrow', 15)}</button></article>`).join('') || '<div class="career-idea-empty"><p>Your interests don’t need to become a decision just yet.</p><span class="small muted">Save a role, industry, or question to come back to.</span></div>'}</div><button type="button" class="btn career-add-idea" data-career-action="add-idea">${CS.icon('plus', 18)}Save a possibility</button></section></div>`;
  }

  CS.pages.career = function (root) {
    root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">Build your next chapter</p><h1>Career Launchpad</h1><p class="muted">Make space for possibilities. Take the next step when you’re ready.</p></div><span class="career-heading-symbol" aria-hidden="true">${CS.icon('career', 30)}</span></div><div class="tabs career-tabs" aria-label="Career sections">${[['applications', 'Applications'], ['skills', 'Skills'], ['explore', 'Explore Careers']].map(([key, label]) => `<button type="button" class="${tab === key ? 'active' : ''}" data-career-tab="${key}" aria-pressed="${tab === key}">${label}</button>`).join('')}</div><div class="career-content">${tab === 'applications' ? applicationsMarkup() : tab === 'skills' ? skillsMarkup() : explorationMarkup()}</div><p class="career-footnote">Your path is yours to explore. A small step is still a step.</p>`;
    const onClick = event => {
      const tabButton = event.target.closest('[data-career-tab]');
      if (tabButton) { tab = tabButton.dataset.careerTab; CS.render(); return; }
      const button = event.target.closest('[data-career-action]');
      if (!button) return;
      const action = button.dataset.careerAction, id = button.dataset.id;
      if (action === 'add-application') applicationForm();
      else if (action === 'edit-application') applicationForm(id);
      else if (action === 'details') applicationDetails(id);
      else if (action === 'delete-application') { const item = CS.state.applications.find(x => x.id === id); if (item) removeRecord('applications', id, `Delete the ${item.title} application at ${item.company}?`); }
      else if (action === 'view-table' || action === 'view-board') { view = action.slice(5); CS.render(); }
      else if (action === 'clear-filters') { query = ''; filter = ''; CS.render(); }
      else if (action === 'add-skill') skillForm();
      else if (action === 'edit-skill') skillForm(id);
      else if (action === 'delete-skill') { const item = CS.state.skills.find(x => x.id === id); if (item) removeRecord('skills', id, `Delete the ${item.name} skill goal?`); }
      else if (action === 'plan-skill') { const item = CS.state.skills.find(x => x.id === id); if (item) CS.addWeeklyTask(`Practise ${item.name}`, 'Learning'); }
      else if (action === 'add-idea') ideaForm();
      else if (action === 'edit-idea') ideaForm(id);
      else if (action === 'delete-idea') { const item = CS.state.exploration.items.find(x => x.id === id); if (item) removeRecord('ideas', id, `Delete “${item.title}” from your possibilities?`); }
      else if (action === 'plan-idea') { const item = CS.state.exploration.items.find(x => x.id === id); if (item) CS.addWeeklyTask(`Explore: ${item.title}`, 'Career'); }
    };
    const onInput = event => {
      if (event.target.id === 'career-search') { query = event.target.value; root.querySelector('#career-applications-content').innerHTML = applicationContent(); }
      if (event.target.matches('[data-exploration-answer]')) {
        CS.state.exploration.answers[Number(event.target.dataset.explorationAnswer)] = event.target.value;
        CS.save();
      }
    };
    const onChange = event => {
      if (event.target.id === 'career-filter') { filter = event.target.value; root.querySelector('#career-applications-content').innerHTML = applicationContent(); }
      if (event.target.matches('[data-application-status]')) {
        const item = CS.state.applications.find(x => x.id === event.target.dataset.applicationStatus);
        if (item && statuses.includes(event.target.value)) { item.status = event.target.value; item.updatedAt = new Date().toISOString(); CS.touch('Updated an application’s progress', 'career'); CS.render(); CS.toast('Application status updated.'); }
      }
      if (event.target.matches('[data-skill-status]')) {
        const item = CS.state.skills.find(x => x.id === event.target.dataset.skillStatus);
        if (item && skillStatuses.includes(event.target.value)) { item.status = event.target.value; item.updatedAt = new Date().toISOString(); CS.touch('Updated a learning goal', 'career'); CS.toast('Skill progress updated.'); }
      }
    };
    root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange);
    return () => { root.removeEventListener('click', onClick); root.removeEventListener('input', onInput); root.removeEventListener('change', onChange); };
  };
})();
