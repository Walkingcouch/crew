/**
 * active-jobs-panel.js
 * Self-contained panel for displaying active job postings.
 *
 * Usage:
 *   ActiveJobsPanel.mount('#container');
 *   ActiveJobsPanel.mount(el, { statuses: ['active','pending'], limit: 20, onJobClick: fn });
 *
 * Requires crew-framework.js to be loaded first (uses CrewFramework.getDB and CrewAuth).
 */
(function (global) {
  'use strict';

  var STATUS = {
    active:      { label: 'Active',      border: 'var(--green)',  bg: 'rgba(22,163,74,0.1)',   color: '#16a34a' },
    in_progress: { label: 'In Progress', border: 'var(--green)',  bg: 'rgba(22,163,74,0.1)',   color: '#16a34a' },
    scheduled:   { label: 'Scheduled',   border: 'var(--blue)',   bg: 'rgba(59,130,246,0.1)',  color: 'var(--blue)' },
    pending:     { label: 'Pending',     border: 'var(--amber)',  bg: 'rgba(196,123,10,0.1)',  color: 'var(--amber)' },
    completed:   { label: 'Completed',   border: 'var(--border)', bg: 'rgba(0,0,0,0.04)',      color: 'var(--text-3)' },
    cancelled:   { label: 'Cancelled',   border: 'var(--err)',    bg: 'rgba(185,28,28,0.1)',   color: 'var(--err)' }
  };

  var DEFAULT_STATUSES = ['active', 'in_progress', 'pending', 'scheduled'];

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _initials(name) {
    return (name || '?').split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2) || '?';
  }

  function _formatDate(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    var now = new Date();
    var time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return 'Today ' + time;
    if (d.toDateString() === new Date(now.getTime() + 86400000).toDateString()) return 'Tomorrow ' + time;
    return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + time;
  }

  function _renderSkeleton() {
    var rows = '';
    for (var i = 0; i < 4; i++) {
      rows += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:14px;">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:var(--border);flex-shrink:0;animation:ajp-skeleton 1.4s ease infinite;"></div>' +
        '<div style="flex:1;display:flex;flex-direction:column;gap:7px;">' +
        '<div style="height:13px;background:var(--border);border-radius:4px;width:52%;animation:ajp-skeleton 1.4s ease infinite;"></div>' +
        '<div style="height:11px;background:var(--border);border-radius:4px;width:78%;animation:ajp-skeleton 1.4s ease infinite;"></div>' +
        '</div></div>';
    }
    return '<div style="display:flex;flex-direction:column;gap:10px;">' + rows + '</div>';
  }

  function _renderEmpty() {
    return '<div style="text-align:center;padding:48px 24px;">' +
      '<div style="font-size:40px;margin-bottom:12px;">📋</div>' +
      '<div style="font-size:15px;font-weight:600;color:var(--text-2);margin-bottom:6px;">No active jobs</div>' +
      '<div style="font-size:13px;color:var(--text-3);">Active and pending jobs will appear here.</div>' +
      '</div>';
  }

  function _renderError(msg) {
    return '<div style="text-align:center;padding:32px 24px;color:var(--err);">' +
      '<div style="font-size:13px;">' + _esc(msg) + '</div>' +
      '</div>';
  }

  function _renderJobRow(job) {
    var cfg = STATUS[job.status] || STATUS.pending;
    var customerName = (job.customers && job.customers.name) || '—';
    var workerName   = job.workers && job.workers.name;
    var initials     = (job.workers && job.workers.avatar_initials) || (workerName ? _initials(workerName) : '?');
    var price        = job.price ? '$' + parseFloat(job.price).toFixed(0) : null;
    var dateStr      = _formatDate(job.scheduled_at);

    var meta = [job.address, dateStr, price].filter(Boolean).join(' · ');

    return '<div data-job-id="' + _esc(job.id) + '" class="ajp-row" style="' +
      'background:var(--surface);border:1px solid var(--border);border-left:4px solid ' + cfg.border + ';' +
      'border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:14px;' +
      'cursor:pointer;transition:box-shadow .15s,transform .15s;">' +

      '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--green),var(--blue));' +
      'display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;flex-shrink:0;">' +
      _esc(initials) + '</div>' +

      '<div style="flex:1;min-width:0;">' +
      '<div style="font-size:14px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
      _esc(job.service_type || 'Job') +
      '<span style="font-weight:400;color:var(--text-2);"> — ' + _esc(customerName) + '</span></div>' +
      (meta ? '<div style="font-size:12px;color:var(--text-3);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(meta) + '</div>' : '') +
      (workerName ? '<div style="font-size:11px;color:var(--text-3);margin-top:2px;">Worker: ' + _esc(workerName) + '</div>' : '') +
      '</div>' +

      '<div style="background:' + cfg.bg + ';color:' + cfg.color + ';font-size:11px;font-weight:700;' +
      'padding:3px 9px;border-radius:20px;white-space:nowrap;flex-shrink:0;">' + cfg.label + '</div>' +
      '</div>';
  }

  function _injectStyles() {
    if (document.getElementById('ajp-styles')) return;
    var s = document.createElement('style');
    s.id = 'ajp-styles';
    s.textContent = '@keyframes ajp-skeleton{0%,100%{opacity:1}50%{opacity:.45}}' +
      '.ajp-row:hover{box-shadow:var(--sh-md,0 4px 12px rgba(0,0,0,.08));transform:translateY(-1px);}';
    document.head.appendChild(s);
  }

  async function _load(container, options) {
    var list    = container.querySelector('.ajp-list');
    var countEl = container.querySelector('.ajp-count');
    list.innerHTML = _renderSkeleton();

    try {
      var db = global.CrewFramework && global.CrewFramework.getDB();
      if (!db) throw new Error('CrewFramework not ready — ensure crew-framework.js is loaded before active-jobs-panel.js');

      var statuses = options.statuses || DEFAULT_STATUSES;
      var limit    = options.limit || 20;

      var user  = global.CrewAuth && global.CrewAuth.getCurrentUser && global.CrewAuth.getCurrentUser();
      var orgId = user && user.org_id;

      var q = db.from('jobs')
        .select('id, service_type, status, address, scheduled_at, price, customers(name), workers(name, avatar_initials)')
        .in('status', statuses)
        .order('scheduled_at', { ascending: true })
        .limit(limit);

      if (orgId) q = q.eq('org_id', orgId);

      var result = await q;
      if (result.error) throw result.error;

      var jobs = result.data || [];

      if (!jobs.length) {
        list.innerHTML = _renderEmpty();
        if (countEl) countEl.textContent = '0';
        return jobs;
      }

      list.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;">' +
        jobs.map(_renderJobRow).join('') +
        '</div>';

      if (countEl) countEl.textContent = String(jobs.length);

      if (options.onJobClick) {
        list.querySelectorAll('.ajp-row').forEach(function (row) {
          row.addEventListener('click', function () {
            var job = jobs.find(function (j) { return String(j.id) === row.dataset.jobId; });
            if (job) options.onJobClick(job);
          });
        });
      }

      return jobs;
    } catch (err) {
      list.innerHTML = _renderError((err && err.message) || 'Could not load jobs.');
      if (countEl) countEl.textContent = '0';
      return [];
    }
  }

  function mount(target, options) {
    var container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) return null;

    options = options || {};
    _injectStyles();

    container.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<span style="font-size:15px;font-weight:700;color:var(--text);">Active Jobs</span>' +
          '<span class="ajp-count" style="background:rgba(22,163,74,0.1);color:#16a34a;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">…</span>' +
        '</div>' +
        '<button class="ajp-refresh" style="padding:5px 12px;background:rgba(0,0,0,0.04);border:1px solid var(--border);border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;color:var(--text-2);">↻ Refresh</button>' +
      '</div>' +
      '<div class="ajp-list"></div>';

    _load(container, options);

    var refreshBtn = container.querySelector('.ajp-refresh');
    function _onRefresh() { _load(container, options); }
    refreshBtn.addEventListener('click', _onRefresh);

    // Realtime — auto-refresh the panel when any job row changes
    var _channel = null;
    if (options.realtime !== false) {
      var db = global.CrewFramework && global.CrewFramework.getDB();
      if (db) {
        _channel = db.channel('ajp-jobs-changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, function () {
            _load(container, options);
          })
          .subscribe();
      }
    }

    return {
      refresh: function () { return _load(container, options); },
      unmount: function () {
        refreshBtn.removeEventListener('click', _onRefresh);
        if (_channel) {
          var db = global.CrewFramework && global.CrewFramework.getDB();
          if (db) db.removeChannel(_channel);
          _channel = null;
        }
      }
    };
  }

  global.ActiveJobsPanel = { mount: mount };
}(window));
