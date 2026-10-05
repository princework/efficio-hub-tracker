(function () {
  'use strict';

  var KEY_STORAGE = 'efficioHubTracker.key';

  var adminKey = '';
  var isAdmin  = false;   // the client link is view + feedback only

  var project = { name: 'Efficio Hub', description: '' };
  var milestones = {};            // id -> {name, order, objective, allocatedDays, createdAt}
  var tasksByMilestone = {};      // milestoneId -> { taskDocId -> task }
  var feedback = {};              // id -> {text, author, createdAt}

  var activeView = 'dashboard';
  var statusFilter = 'all';
  var priorityFilter = 'all';
  var milestoneFilter = 'all';
  var searchText = '';
  var STATUS_OPTS = ['Not Started', 'In Progress', 'Done'];
  var STATUS_CLASS = { 'Not Started': 'st-todo', 'In Progress': 'st-active', 'Done': 'st-done' };
  var PRIORITY_OPTS = ['Low', 'Medium', 'High'];
  var PRIORITY_CLASS = { 'Low': 'pr-low', 'Medium': 'pr-medium', 'High': 'pr-high' };
  // one colour per milestone, reused across the sidebar, the table and the charts
  var TRASH_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8">' +
    '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/></svg>';
  var MILESTONE_COLORS = ['#2f4a8a', '#7159ad', '#2f8a52', '#cc7a1b', '#c0392b', '#1f8fa3', '#a8468c', '#6b8a2f', '#5a6b7d'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var p = String(iso).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }
  function fmtTime(ts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ================================================================
     ACCESS + API
     The page works two ways: served by the Node app it reads and writes
     MongoDB through /api; opened as a plain file it falls back to the
     localStorage copy below, so the tracker still runs with no server.
     ================================================================ */
  function storageGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function storageSet(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} }

  function authHeaders(extra) {
    var h = extra || {};
    if (adminKey) h['x-admin-key'] = adminKey;
    return h;
  }

  function api(path, options) {
    var opts = options || {};
    opts.headers = authHeaders(opts.headers || {});
    if (opts.body) opts.headers['Content-Type'] = 'application/json';
    return fetch('/api' + path, opts).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok || !json.success) throw new Error(json.message || ('Request failed (' + res.status + ')'));
        return json.data;
      });
    });
  }

  function showLoadError(err) {
    var box = document.getElementById('load-error');
    box.innerHTML = '';
    box.appendChild(el('h3', null, 'Can’t reach the tracker database'));
    box.appendChild(el('p', null, esc(err && err.message ? err.message : 'The server did not respond.')));
    var retry = el('button', 'btn primary', 'Try again');
    retry.addEventListener('click', function () { location.reload(); });
    box.appendChild(retry);
    box.hidden = false;
    document.getElementById('stats').hidden = true;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  }

  var toastTimer;
  function showToast(msg, isError) {
    var box = document.getElementById('toast');
    box.textContent = msg;
    box.className = 'toast' + (isError ? ' err' : '');
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.hidden = true; }, 4000);
  }

  // Writes are optimistic: the change shows immediately, then goes to the
  // server. If the server rejects it we say so and reload the real state.
  function push(promise, what) {
    promise.catch(function (err) {
      showToast((what || 'Change') + ' not saved: ' + err.message, true);
      loadFromServer().then(renderAll).catch(function () {});
    });
  }

  function initAuth() {
    var url = new URL(location.href);
    var fromUrl = url.searchParams.get('key');
    if (fromUrl) {
      storageSet(KEY_STORAGE, fromUrl);
      url.searchParams.delete('key');
      history.replaceState(null, '', url.pathname + url.search + url.hash); // keep the key out of the address bar
    }
    adminKey = fromUrl || storageGet(KEY_STORAGE);
    if (!adminKey) return Promise.resolve();
    return api('/auth').then(function (data) {
      isAdmin = !!data.admin;
      if (!isAdmin) {
        storageSet(KEY_STORAGE, '');
        adminKey = '';
        showToast('Developer key not accepted — showing the view-only page', true);
      }
    }).catch(function () { isAdmin = false; });
  }

  function exitDeveloperMode() {
    storageSet(KEY_STORAGE, '');
    location.reload();
  }

  function applyAccess() {
    document.body.classList.toggle('readonly', !isAdmin);
    var pill = document.getElementById('role-pill');
    pill.hidden = !isAdmin;
    if (!isAdmin) {
      document.querySelectorAll('#task-tbody select, #task-tbody input, #task-tbody textarea, #task-tbody .cell-btn')
        .forEach(function (c) { c.disabled = true; });
    }
  }

  function loadFromServer() {
    return api('/state').then(function (data) {
      project = data.project || project;
      milestones = data.milestones || {};
      tasksByMilestone = data.tasksByMilestone || {};
      feedback = data.feedback || {};
      return data;
    });
  }

  /* ---------------- modal plumbing ---------------- */
  var overlay = document.getElementById('modal-overlay');
  var modalBox = document.getElementById('modal-box');
  function closeModal() { overlay.hidden = true; modalBox.innerHTML = ''; }
  function openModal(node) { modalBox.innerHTML = ''; modalBox.appendChild(node); overlay.hidden = false; }
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) closeModal(); });

  function bindConfirm(btn, onConfirm) {
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (btn.classList.contains('confirm')) { onConfirm(); return; }
      btn.classList.add('confirm');
      var prev = btn.textContent;
      btn.textContent = '?';
      setTimeout(function () { btn.classList.remove('confirm'); btn.textContent = prev; }, 2500);
    });
  }

  function setLive(state) {
    var dot = document.getElementById('live-dot');
    var label = document.getElementById('live-label');
    dot.classList.toggle('on', state === 'live');
    label.textContent = state === 'live' ? 'Live' : 'Offline';
  }

  /* ---------------- nav / views ---------------- */
  function splitMilestoneName(name) {
    var m = /^\s*(M\d+)\s*[–—-]\s*(.+)$/.exec(name || '');
    return m ? { code: m[1], title: m[2] } : { code: '', title: name || '' };
  }

  function autoGrow(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    var h = ta.scrollHeight;
    if (!h) return;                       // not laid out yet (hidden view)
    ta.style.height = Math.max(h, 34) + 'px';
  }
  function sizeTaskEditors() {
    [].slice.call(document.querySelectorAll('#task-tbody textarea')).forEach(autoGrow);
  }

  function switchView(view) {
    activeView = view;
    document.querySelectorAll('.nav-item[data-view]').forEach(function (b) { b.classList.toggle('active', b.dataset.view === view); });
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + view); });
    // a hidden textarea reports scrollHeight 0, so re-fit once the view is visible
    if (view === 'tasks') sizeTaskEditors();
  }
  document.querySelectorAll('.nav-item[data-view]').forEach(function (b) {
    b.addEventListener('click', function () { switchView(b.dataset.view); });
  });

  /* ---------------- computed helpers ---------------- */
  function orderedMilestoneIds() {
    return Object.keys(milestones).sort(function (a, b) { return (milestones[a].order || 0) - (milestones[b].order || 0); });
  }
  function milestoneColor(id) {
    var i = orderedMilestoneIds().indexOf(id);
    return MILESTONE_COLORS[(i < 0 ? 0 : i) % MILESTONE_COLORS.length];
  }
  function tasksFor(id) { return tasksByMilestone[id] || {}; }
  function taskIdsFor(id) { return Object.keys(tasksFor(id)); }
  function milestoneCounts(id) {
    var ids = taskIdsFor(id);
    var counts = { total: ids.length, todo: 0, active: 0, done: 0 };
    ids.forEach(function (tid) {
      var s = tasksFor(id)[tid].status;
      if (s === 'Done') counts.done++;
      else if (s === 'In Progress') counts.active++;
      else counts.todo++;
    });
    return counts;
  }
  function allTasksFlat() {
    var out = [];
    orderedMilestoneIds().forEach(function (mid) {
      taskIdsFor(mid).forEach(function (tid) { out.push({ mid: mid, tid: tid, t: tasksFor(mid)[tid] }); });
    });
    out.sort(function (a, b) { return (a.t.taskId || 0) - (b.t.taskId || 0); });
    return out;
  }

  /* ---------------- render: header + stats ---------------- */
  function renderHeader() {
    document.getElementById('proj-title').textContent = project.name || 'Untitled tracker';
    document.title = project.name || 'Tracker';
  }

  function renderNavCounts() {
    var totalTasks = 0;
    orderedMilestoneIds().forEach(function (id) { totalTasks += taskIdsFor(id).length; });
    document.getElementById('topbar-count').textContent = totalTasks + (totalTasks === 1 ? ' Task' : ' Tasks');
  }

  function renderSidebarMilestones() {
    var wrap = document.getElementById('sidebar-milestones');
    wrap.innerHTML = '';
    var ids = orderedMilestoneIds();
    var total = 0;
    ids.forEach(function (id) { total += taskIdsFor(id).length; });

    function addRow(id, label, color, count) {
      var btn = el('button', 'nav-item ms-item' + (milestoneFilter === id ? ' active' : ''));
      btn.dataset.milestone = id;
      var dot = el('span', 'm-dot');
      dot.style.background = color;
      btn.appendChild(dot);
      btn.appendChild(el('span', 'nav-text', esc(label)));
      btn.appendChild(el('span', 'nav-count', String(count)));
      btn.title = label;
      btn.addEventListener('click', function () {
        milestoneFilter = id;
        document.getElementById('milestone-filter').value = id;
        switchView('tasks');
        renderTaskTable();
        renderSidebarMilestones();
      });
      wrap.appendChild(btn);
    }

    addRow('all', 'All Milestones', 'var(--ink-faint)', total);
    ids.forEach(function (id) {
      var parts = splitMilestoneName(milestones[id].name);
      addRow(id, parts.title || milestones[id].name, milestoneColor(id), taskIdsFor(id).length);
    });
  }

  function renderStats() {
    var wrap = document.getElementById('stats');
    wrap.innerHTML = '';
    var totals = { total: 0, todo: 0, active: 0, done: 0 };
    orderedMilestoneIds().forEach(function (id) {
      var c = milestoneCounts(id);
      totals.total += c.total; totals.todo += c.todo; totals.active += c.active; totals.done += c.done;
    });
    var pct = totals.total ? Math.round(totals.done / totals.total * 100) : 0;
    function share(n) { return totals.total ? Math.round(n / totals.total * 100) : 0; }
    function tile(cls, label, value, meterPct, sub) {
      var html = '<div class="l">' + label + '</div><div class="n">' + value + '</div>';
      if (meterPct != null) html += '<div class="meter"><span style="width:' + meterPct + '%"></span></div>';
      if (sub) html += '<div class="sub">' + sub + '</div>';
      wrap.appendChild(el('div', 'stat ' + cls, html));
    }
    var mCount = orderedMilestoneIds().length;
    tile('', 'Total Tasks', totals.total, null, mCount + (mCount === 1 ? ' milestone' : ' milestones'));
    tile('done-n', 'Completed', totals.done, share(totals.done));
    tile('active-n', 'In Progress', totals.active, share(totals.active));
    tile('todo-n', 'Not Started', totals.todo, share(totals.todo));
    tile('accent-n', 'Overall %', pct + '%', pct);
    var fbCount = Object.keys(feedback).length;
    tile('', 'Client Feedback', fbCount, null, fbCount + (fbCount === 1 ? ' message' : ' messages') + ' total');
  }

  function renderChart() {
    var wrap = document.getElementById('chart');
    wrap.innerHTML = '';
    var ids = orderedMilestoneIds();
    if (!ids.length) { wrap.appendChild(el('p', null, '<span style="color:var(--ink-faint);font-size:13px;">No milestones yet.</span>')); return; }
    ids.forEach(function (id) {
      var m = milestones[id];
      var c = milestoneCounts(id);
      var pct = c.total ? Math.round(c.done / c.total * 100) : 0;
      var row = el('div', 'chart-row');
      var color = milestoneColor(id);
      var parts = splitMilestoneName(m.name);
      var label = el('div', 'chart-label');
      if (parts.code) {
        var code = el('span', 'm-code', esc(parts.code));
        code.style.color = color;
        label.appendChild(code);
      }
      label.appendChild(document.createTextNode(parts.title || m.name));
      row.appendChild(label);
      var track = el('div', 'chart-track');
      var fill = el('div', 'chart-fill'); fill.style.width = pct + '%'; fill.style.background = color;
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('div', 'chart-pct mono', pct + '%'));
      row.title = c.done + ' of ' + c.total + ' tasks done';
      row.addEventListener('click', function () {
        switchView('tasks');
        milestoneFilter = id;
        document.getElementById('milestone-filter').value = id;
        renderTaskTable();
        renderSidebarMilestones();
      });
      wrap.appendChild(row);
    });
  }

  /* ---------------- render: milestones grid ---------------- */
  function renderMilestonesGrid() {
    var wrap = document.getElementById('milestones-grid');
    wrap.innerHTML = '';
    var ids = orderedMilestoneIds();
    if (!ids.length) {
      var empty = el('div', 'empty-state');
      empty.appendChild(el('h3', null, 'No milestones yet'));
      empty.appendChild(el('p', null, 'Add your first milestone to start tracking tasks.'));
      wrap.appendChild(empty);
      return;
    }
    ids.forEach(function (id) {
      var m = milestones[id];
      var c = milestoneCounts(id);
      var pct = c.total ? Math.round(c.done / c.total * 100) : 0;
      var card = el('div', 'm-card');
      var color = milestoneColor(id);
      card.style.borderLeftColor = color;
      var top = el('div', 'm-card-top');
      top.appendChild(el('h3', null, esc(m.name)));
      var actions = el('div', 'm-card-actions');
      var editBtn = el('button', 'mini-btn', '✎');
      editBtn.title = 'Rename / delete milestone';
      editBtn.addEventListener('click', function () { openMilestoneModal(id); });
      actions.appendChild(editBtn);
      top.appendChild(actions);
      card.appendChild(top);
      card.appendChild(el('div', 'm-count', c.done + ' / ' + c.total + ' tasks done'));
      var pctEl = el('div', 'm-pct', pct + '% complete');
      pctEl.style.color = color;
      card.appendChild(pctEl);
      var track = el('div', 'm-track');
      var fill = el('div', 'm-fill'); fill.style.width = pct + '%'; fill.style.background = color;
      track.appendChild(fill);
      card.appendChild(track);
      card.addEventListener('click', function (e) {
        if (e.target.closest('.m-card-actions')) return;
        switchView('tasks');
        milestoneFilter = id;
        document.getElementById('milestone-filter').value = id;
        renderTaskTable();
        renderSidebarMilestones();
      });
      card.style.cursor = 'pointer';
      wrap.appendChild(card);
    });
  }

  /* ---------------- render: task table ---------------- */
  function populateMilestoneSelects() {
    var filterSel = document.getElementById('milestone-filter');
    var curFilter = filterSel.value || 'all';
    filterSel.innerHTML = '<option value="all">All milestones</option>';
    orderedMilestoneIds().forEach(function (id) {
      var m = milestones[id];
      var o1 = document.createElement('option'); o1.value = id; o1.textContent = m.name;
      filterSel.appendChild(o1);
    });
    if ([].slice.call(filterSel.options).some(function (o) { return o.value === curFilter; })) filterSel.value = curFilter;
  }

  function matchesFilters(mid, t) {
    if (milestoneFilter !== 'all' && mid !== milestoneFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && (t.priority || 'Medium') !== priorityFilter) return false;
    if (searchText) {
      var hay = ((t.text || '') + ' ' + (t.clientFeedback || '')).toLowerCase();
      if (hay.indexOf(searchText) === -1) return false;
    }
    return true;
  }

  function renderTaskTable() {
    var tbody = document.getElementById('task-tbody');
    tbody.innerHTML = '';
    var all = allTasksFlat().filter(function (row) { return matchesFilters(row.mid, row.t); });
    document.getElementById('task-count').textContent = all.length + (all.length === 1 ? ' task' : ' tasks');
    var sno = 0;
    all.forEach(function (row) {
      sno++;
      tbody.appendChild(buildTaskRow(sno, row.mid, row.tid, row.t));
    });
    // size every editor to its full content now that the rows are in the DOM
    sizeTaskEditors();
    applyAccess();
    if (!all.length) {
      var tr = document.createElement('tr');
      var td = document.createElement('td'); td.colSpan = 8;
      td.innerHTML = '<span style="display:block;padding:18px 10px;color:var(--ink-faint);font-size:14.5px;">No tasks match the current filters.</span>';
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  function buildTaskRow(sno, milestoneId, taskDocId, t) {
    var tr = document.createElement('tr');

    var snoTd = document.createElement('td'); snoTd.className = 'task-sno mono'; snoTd.textContent = sno;
    tr.appendChild(snoTd);

    var mTd = document.createElement('td');
    var mCell = el('div', 'm-cell');
    var mName = (milestones[milestoneId] && milestones[milestoneId].name) || '';
    var mParts = splitMilestoneName(mName);
    var mLabel = el('div', 'm-cell-label');
    mLabel.setAttribute('aria-hidden', 'true');
    if (mParts.code) {
      var mCode = el('span', 'm-code', esc(mParts.code));
      mCode.style.color = milestoneColor(milestoneId);
      mLabel.appendChild(mCode);
    }
    mLabel.appendChild(document.createTextNode(mParts.title || mName));
    var mSel = document.createElement('select');
    mSel.className = 'm-select overlay';
    mSel.setAttribute('aria-label', 'Milestone');
    orderedMilestoneIds().forEach(function (mid) {
      var o = document.createElement('option'); o.value = mid; o.textContent = milestones[mid].name;
      if (mid === milestoneId) o.selected = true;
      mSel.appendChild(o);
    });
    mSel.title = mName;
    mSel.addEventListener('change', function () { moveTaskToMilestone(milestoneId, taskDocId, mSel.value); });
    mCell.appendChild(mLabel);
    mCell.appendChild(mSel);
    mTd.appendChild(mCell);
    tr.appendChild(mTd);

    var textTd = document.createElement('td');
    var textInput = document.createElement('textarea');
    textInput.className = 'task-text-input'; textInput.value = t.text || ''; textInput.rows = 1;
    textInput.addEventListener('input', function () { autoGrow(textInput); });
    textInput.addEventListener('blur', function () {
      var v = textInput.value.trim();
      if (v && v !== t.text) writeTaskUpdate(milestoneId, taskDocId, { text: v });
    });
    textTd.appendChild(textInput);
    tr.appendChild(textTd);

    var statusTd = document.createElement('td');
    var sel = document.createElement('select');
    sel.className = 'status-select ' + (STATUS_CLASS[t.status] || 'st-todo');
    STATUS_OPTS.forEach(function (opt) {
      var o = document.createElement('option'); o.value = opt; o.textContent = opt;
      if (t.status === opt) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      sel.className = 'status-select ' + (STATUS_CLASS[sel.value] || 'st-todo');
      writeTaskUpdate(milestoneId, taskDocId, { status: sel.value });
    });
    statusTd.appendChild(sel);
    tr.appendChild(statusTd);

    var prioTd = document.createElement('td');
    var prioSel = document.createElement('select');
    var curPrio = t.priority || 'Medium';
    prioSel.className = 'prio-select ' + (PRIORITY_CLASS[curPrio] || 'pr-medium');
    PRIORITY_OPTS.forEach(function (opt) {
      var o = document.createElement('option'); o.value = opt; o.textContent = opt;
      if (curPrio === opt) o.selected = true;
      prioSel.appendChild(o);
    });
    prioSel.addEventListener('change', function () {
      prioSel.className = 'prio-select ' + (PRIORITY_CLASS[prioSel.value] || 'pr-medium');
      writeTaskUpdate(milestoneId, taskDocId, { priority: prioSel.value });
    });
    prioTd.appendChild(prioSel);
    tr.appendChild(prioTd);

    var startTd = document.createElement('td');
    if (isAdmin) {
      var startInput = document.createElement('input');
      startInput.type = 'date'; startInput.className = 'date-input'; startInput.value = t.startDate || '';
      startInput.addEventListener('change', function () { writeTaskUpdate(milestoneId, taskDocId, { startDate: startInput.value }); });
      startTd.appendChild(startInput);
    } else {
      // the client link reads as plain text rather than an empty date field
      startTd.appendChild(el('span', 'cell-text', fmtDate(t.startDate)));
    }
    tr.appendChild(startTd);

    // client feedback opens a small editor, which keeps the table inside the
    // window instead of scrolling sideways
    var fbTd = document.createElement('td');
    if (isAdmin) {
      var fbBtn = el('button', 'cell-btn' + (t.clientFeedback ? '' : ' empty'), esc(t.clientFeedback || '— add feedback'));
      fbBtn.title = t.clientFeedback || 'Add client feedback';
      fbBtn.addEventListener('click', function () { openTaskFeedbackModal(milestoneId, taskDocId); });
      fbTd.appendChild(fbBtn);
    } else {
      var fbText = el('span', 'cell-text' + (t.clientFeedback ? '' : ' empty'), esc(t.clientFeedback || '—'));
      fbText.title = t.clientFeedback || '';
      fbTd.appendChild(fbText);
    }
    tr.appendChild(fbTd);

    var delTd = document.createElement('td'); delTd.className = 'row-del';
    var del = el('button', 'mini-btn', TRASH_SVG); del.title = 'Delete task';
    bindConfirm(del, function () { deleteTaskDoc(milestoneId, taskDocId); });
    delTd.appendChild(del);
    tr.appendChild(delTd);

    return tr;
  }

  /* ---------------- render: client feedback ---------------- */
  function renderFeedbackList() {
    var wrap = document.getElementById('feedback-list');
    wrap.innerHTML = '';
    var ids = Object.keys(feedback).sort(function (a, b) { return (feedback[b].createdAt || 0) - (feedback[a].createdAt || 0); });
    if (!ids.length) {
      var empty = el('div', 'empty-state');
      empty.appendChild(el('h3', null, 'No feedback yet'));
      empty.appendChild(el('p', null, 'Feedback shared by the client or team will appear here.'));
      wrap.appendChild(empty);
      return;
    }
    ids.forEach(function (id) {
      var f = feedback[id];
      var card = el('div', 'feedback-card');
      card.appendChild(el('div', 'fb-text', esc(f.text)));
      card.appendChild(el('div', 'fb-meta', (f.author ? esc(f.author) + ' · ' : '') + fmtTime(f.createdAt)));
      var del = el('button', 'mini-btn row-del', '✕'); del.title = 'Delete';
      bindConfirm(del, function () { deleteFeedbackDoc(id); });
      card.appendChild(del);
      wrap.appendChild(card);
    });
  }

  /* ---------------- modals ---------------- */
  function openMilestoneModal(id) {
    var editing = !!id;
    var m = editing ? milestones[id] : { name: '', order: (orderedMilestoneIds().length + 1) * 10 };
    var box = el('div');
    box.appendChild(el('h3', null, editing ? 'Edit milestone' : 'New milestone'));
    var field = el('div', 'field');
    field.appendChild(el('label', null, 'Name'));
    var input = document.createElement('input');
    input.type = 'text'; input.value = m.name || ''; input.placeholder = 'e.g. Milestone 10: Post-launch Support';
    field.appendChild(input);
    box.appendChild(field);

    var actionsRow = el('div', 'modal-actions');
    if (editing) {
      var delBtn = el('button', 'btn danger', 'Delete');
      bindConfirm(delBtn, function () { deleteMilestoneDoc(id); closeModal(); });
      actionsRow.appendChild(delBtn);
    } else {
      actionsRow.appendChild(el('span'));
    }
    var right = el('div', 'right');
    var cancel = el('button', 'btn ghost', 'Cancel');
    cancel.addEventListener('click', closeModal);
    var save = el('button', 'btn primary', editing ? 'Save' : 'Add milestone');
    save.addEventListener('click', function () {
      var name = input.value.trim();
      if (!name) { input.focus(); return; }
      if (editing) { writeMilestoneUpdate(id, { name: name }); }
      else { createMilestoneDoc(name, m.order); }
      closeModal();
    });
    right.appendChild(cancel); right.appendChild(save);
    actionsRow.appendChild(right);
    box.appendChild(actionsRow);
    openModal(box);
    setTimeout(function () { input.focus(); }, 10);
  }

  function openSettingsModal() {
    var box = el('div');
    box.appendChild(el('h3', null, 'Project settings'));
    var nameField = el('div', 'field');
    nameField.appendChild(el('label', null, 'Tracker name'));
    var nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.value = project.name || '';
    nameField.appendChild(nameInput);
    box.appendChild(nameField);
    var descField = el('div', 'field');
    descField.appendChild(el('label', null, 'Description'));
    var descInput = document.createElement('textarea');
    descInput.value = project.description || '';
    descField.appendChild(descInput);
    box.appendChild(descField);

    var actionsRow = el('div', 'modal-actions');
    actionsRow.appendChild(el('span'));
    var right = el('div', 'right');
    var cancel = el('button', 'btn ghost', 'Cancel');
    cancel.addEventListener('click', closeModal);
    var save = el('button', 'btn primary', 'Save');
    save.addEventListener('click', function () {
      writeProjectUpdate({ name: nameInput.value.trim() || 'Untitled tracker', description: descInput.value.trim() });
      closeModal();
    });
    right.appendChild(cancel); right.appendChild(save);
    actionsRow.appendChild(right);
    box.appendChild(actionsRow);
    openModal(box);
    setTimeout(function () { nameInput.focus(); }, 10);
  }

  function openAddTaskModal() {
    var ids = orderedMilestoneIds();
    if (!ids.length) { showToast('Add a milestone first', true); return; }
    var box = el('div');
    box.appendChild(el('h3', null, 'Add task'));

    var msField = el('div', 'field');
    msField.appendChild(el('label', null, 'Milestone'));
    var msSelect = document.createElement('select');
    ids.forEach(function (id) {
      var o = document.createElement('option');
      o.value = id; o.textContent = milestones[id].name;
      if (id === milestoneFilter) o.selected = true;
      msSelect.appendChild(o);
    });
    msField.appendChild(msSelect);
    box.appendChild(msField);

    var textField = el('div', 'field');
    textField.appendChild(el('label', null, 'Task'));
    var textInput = document.createElement('textarea');
    textInput.placeholder = 'What needs to be done…';
    textField.appendChild(textInput);
    box.appendChild(textField);

    var actionsRow = el('div', 'modal-actions');
    actionsRow.appendChild(el('span'));
    var right = el('div', 'right');
    var cancel = el('button', 'btn ghost', 'Cancel');
    cancel.addEventListener('click', closeModal);
    var add = el('button', 'btn primary', 'Add task');
    function submit() {
      var text = textInput.value.trim();
      if (!text) { textInput.focus(); return; }
      createTaskDoc(msSelect.value, text);
      closeModal();
    }
    add.addEventListener('click', submit);
    textInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
    });
    right.appendChild(cancel); right.appendChild(add);
    actionsRow.appendChild(right);
    box.appendChild(actionsRow);
    openModal(box);
    setTimeout(function () { textInput.focus(); }, 10);
  }

  function openTaskFeedbackModal(milestoneId, taskDocId) {
    var t = tasksFor(milestoneId)[taskDocId];
    if (!t) return;
    var box = el('div');
    box.appendChild(el('h3', null, 'Client feedback'));
    box.appendChild(el('p', 'modal-sub', esc(t.text || '')));

    var fbField = el('div', 'field');
    fbField.appendChild(el('label', null, 'Feedback on this task'));
    var fbInput = document.createElement('textarea');
    fbInput.value = t.clientFeedback || '';
    fbInput.placeholder = 'What the client said about this task…';
    fbField.appendChild(fbInput);
    box.appendChild(fbField);

    var actionsRow = el('div', 'modal-actions');
    actionsRow.appendChild(el('span'));
    var right = el('div', 'right');
    var cancel = el('button', 'btn ghost', 'Cancel');
    cancel.addEventListener('click', closeModal);
    var save = el('button', 'btn primary', 'Save');
    save.addEventListener('click', function () {
      var value = fbInput.value.trim();
      if (value !== (t.clientFeedback || '')) writeTaskUpdate(milestoneId, taskDocId, { clientFeedback: value });
      closeModal();
    });
    right.appendChild(cancel); right.appendChild(save);
    actionsRow.appendChild(right);
    box.appendChild(actionsRow);
    openModal(box);
    setTimeout(function () { fbInput.focus(); }, 10);
  }

  function openFeedbackModal() {
    var box = el('div');
    box.appendChild(el('h3', null, 'Give feedback'));
    var nameField = el('div', 'field');
    nameField.appendChild(el('label', null, 'Your name (optional)'));
    var nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.placeholder = 'e.g. Client stakeholder';
    nameField.appendChild(nameInput);
    box.appendChild(nameField);
    var msgField = el('div', 'field');
    msgField.appendChild(el('label', null, 'Message'));
    var msgInput = document.createElement('textarea');
    msgInput.placeholder = 'Share a comment, question or observation…';
    msgField.appendChild(msgInput);
    box.appendChild(msgField);

    var actionsRow = el('div', 'modal-actions');
    actionsRow.appendChild(el('span'));
    var right = el('div', 'right');
    var cancel = el('button', 'btn ghost', 'Cancel');
    cancel.addEventListener('click', closeModal);
    var send = el('button', 'btn primary', 'Send Feedback');
    send.addEventListener('click', function () {
      var text = msgInput.value.trim();
      if (!text) { msgInput.focus(); return; }
      createFeedbackDoc(text, nameInput.value.trim());
      closeModal();
      switchView('feedback');
    });
    right.appendChild(cancel); right.appendChild(send);
    actionsRow.appendChild(right);
    box.appendChild(actionsRow);
    openModal(box);
    setTimeout(function () { msgInput.focus(); }, 10);
  }

  /* ---------------- CSV export ---------------- */
  function exportCsv() {
    var rows = [['S.No', 'Milestone', 'Task', 'Status', 'Priority', 'Start', 'Client Feedback']];
    allTasksFlat().forEach(function (row, i) {
      rows.push([i + 1, milestones[row.mid] ? milestones[row.mid].name : '', row.t.text || '', row.t.status || '', row.t.priority || '', row.t.startDate || '', row.t.clientFeedback || '']);
    });
    var csv = rows.map(function (r) {
      return r.map(function (cell) {
        var s = String(cell == null ? '' : cell).replace(/"/g, '""');
        return /[",\n]/.test(s) ? '"' + s + '"' : s;
      }).join(',');
    }).join('\r\n');
    var filename = (project.name || 'tasks').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-tasks.csv';
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------------- local data writes ---------------- */
  function writeProjectUpdate(data) {
    project = Object.assign({}, project, data);
    renderHeader();
    push(api('/project', { method: 'PATCH', body: JSON.stringify(data) }), 'Project');
  }
  function createMilestoneDoc(name, order) {
    var id = uid('m');
    milestones[id] = { name: name, order: order, objective: '', allocatedDays: 0, createdAt: Date.now() };
    tasksByMilestone[id] = {};
    renderAll();
    push(api('/milestones', { method: 'POST', body: JSON.stringify({ id: id, name: name, order: order }) }), 'Milestone');
  }
  function writeMilestoneUpdate(id, data) {
    if (!milestones[id]) return;
    milestones[id] = Object.assign({}, milestones[id], data);
    renderAll();
    push(api('/milestones/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(data) }), 'Milestone');
  }
  function deleteMilestoneDoc(id) {
    delete milestones[id];
    delete tasksByMilestone[id];
    renderAll();
    push(api('/milestones/' + encodeURIComponent(id), { method: 'DELETE' }), 'Milestone');
  }
  function createTaskDoc(milestoneId, text) {
    if (!tasksByMilestone[milestoneId]) tasksByMilestone[milestoneId] = {};
    var maxId = 0;
    orderedMilestoneIds().forEach(function (mid) {
      taskIdsFor(mid).forEach(function (tid) { maxId = Math.max(maxId, tasksFor(mid)[tid].taskId || 0); });
    });
    var tid = uid('t');
    tasksByMilestone[milestoneId][tid] = {
      taskId: maxId + 1, text: text, status: 'Not Started', priority: 'Medium', owner: '', startDate: '', dueDate: '', clientFeedback: '', createdAt: Date.now()
    };
    renderAll();
    push(api('/tasks', { method: 'POST', body: JSON.stringify({ id: tid, milestoneId: milestoneId, text: text }) }), 'Task');
  }
  function writeTaskUpdate(milestoneId, taskDocId, data) {
    var bucket = tasksByMilestone[milestoneId];
    if (!bucket || !bucket[taskDocId]) return;
    bucket[taskDocId] = Object.assign({}, bucket[taskDocId], data);
    renderAll();
    push(api('/tasks/' + encodeURIComponent(taskDocId), { method: 'PATCH', body: JSON.stringify(data) }), 'Task');
  }
  function deleteTaskDoc(milestoneId, taskDocId) {
    var bucket = tasksByMilestone[milestoneId];
    if (!bucket) return;
    delete bucket[taskDocId];
    renderAll();
    push(api('/tasks/' + encodeURIComponent(taskDocId), { method: 'DELETE' }), 'Task');
  }
  function moveTaskToMilestone(fromMid, taskDocId, toMid) {
    if (fromMid === toMid) return;
    var t = tasksFor(fromMid)[taskDocId];
    if (!t) return;
    if (!tasksByMilestone[toMid]) tasksByMilestone[toMid] = {};
    // the document keeps its id, only its milestone changes
    tasksByMilestone[toMid][taskDocId] = t;
    delete tasksByMilestone[fromMid][taskDocId];
    renderAll();
    push(api('/tasks/' + encodeURIComponent(taskDocId), { method: 'PATCH', body: JSON.stringify({ milestoneId: toMid }) }), 'Task');
  }
  function createFeedbackDoc(text, author) {
    var id = uid('f');
    feedback[id] = { text: text, author: author || '', createdAt: Date.now() };
    renderNavCounts();
    renderStats();
    renderFeedbackList();
    api('/feedback', { method: 'POST', body: JSON.stringify({ text: text, author: author || '' }) })
      .then(function (saved) {
        // keep the server's id so a later delete hits the right document
        delete feedback[id];
        feedback[saved._id] = { text: saved.text, author: saved.author, createdAt: saved.createdAt };
        renderFeedbackList();
      })
      .catch(function (err) {
        delete feedback[id];
        renderNavCounts(); renderStats(); renderFeedbackList();
        showToast('Feedback not saved: ' + err.message, true);
      });
  }
  function deleteFeedbackDoc(id) {
    delete feedback[id];
    renderNavCounts();
    renderStats();
    renderFeedbackList();
    push(api('/feedback/' + encodeURIComponent(id), { method: 'DELETE' }), 'Feedback');
  }

  function renderAll() {
    renderHeader();
    renderNavCounts();
    renderSidebarMilestones();
    renderStats();
    renderChart();
    renderMilestonesGrid();
    populateMilestoneSelects();
    renderTaskTable();
    renderFeedbackList();
    applyAccess();
  }

  function boot() {
    document.getElementById('settings-btn').addEventListener('click', openSettingsModal);
    document.getElementById('add-milestone-btn').addEventListener('click', function () { openMilestoneModal(null); });
    document.getElementById('feedback-btn').addEventListener('click', openFeedbackModal);
    document.getElementById('add-feedback-btn').addEventListener('click', openFeedbackModal);
    document.getElementById('export-btn').addEventListener('click', exportCsv);

    document.getElementById('search-input').addEventListener('input', function (e) {
      searchText = e.target.value.trim().toLowerCase();
      renderTaskTable();
    });
    document.getElementById('milestone-filter').addEventListener('change', function (e) {
      milestoneFilter = e.target.value;
      renderTaskTable();
      renderSidebarMilestones();
    });
    document.getElementById('status-filter').addEventListener('change', function (e) {
      statusFilter = e.target.value;
      renderTaskTable();
    });
    document.getElementById('priority-filter').addEventListener('change', function (e) {
      priorityFilter = e.target.value;
      renderTaskTable();
    });
    document.getElementById('reset-filters').addEventListener('click', function () {
      searchText = ''; statusFilter = 'all'; priorityFilter = 'all'; milestoneFilter = 'all';
      document.getElementById('search-input').value = '';
      document.getElementById('status-filter').value = 'all';
      document.getElementById('priority-filter').value = 'all';
      document.getElementById('milestone-filter').value = 'all';
      renderTaskTable();
      renderSidebarMilestones();
    });
    document.getElementById('add-task-btn').addEventListener('click', openAddTaskModal);

    // theme: follow the system unless the user picks one here
    var themeBtn = document.getElementById('theme-btn');
    function applyTheme(mode) {
      if (mode === 'light' || mode === 'dark') document.documentElement.setAttribute('data-theme', mode);
      else document.documentElement.removeAttribute('data-theme');
    }
    function currentTheme() {
      var set = document.documentElement.getAttribute('data-theme');
      if (set) return set;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    try { applyTheme(localStorage.getItem('efficio_theme') || 'light'); } catch (e) { applyTheme('light'); }
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem('efficio_theme', next); } catch (e) {}
      sizeTaskEditors();
    });

    document.getElementById('exit-dev').addEventListener('click', exitDeveloperMode);

    // Everything comes from MongoDB; there is no local copy to fall back on.
    initAuth()
      .then(loadFromServer)
      .then(function () {
        setLive('live');
        document.getElementById('load-error').hidden = true;
        renderAll();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeTaskEditors);
      })
      .catch(function (err) {
        setLive('off');
        showLoadError(err);
      });

    // re-fit the inline editors when the column widths change
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        sizeTaskEditors();
      }, 120);
    });

  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
  else { boot(); }
})();
