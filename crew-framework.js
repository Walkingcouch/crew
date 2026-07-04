/**
 * crew-framework.js  v2
 * Shared utility layer for all Crew apps.
 *
 * Provides:
 *  - Supabase client singleton
 *  - Auth guard (redirect to login if no session)
 *  - Session expiry listener (auto-redirect)
 *  - User profile helpers
 *  - Sign-out
 *  - Cross-app navigation
 *  - Toast notifications (info / success / error / warning)
 *  - User badge with sign-out
 *  - PWA install prompt
 *  - Service worker registration
 *  - Offline indicator banner
 *  - Real-time notification bell (reads `notifications` table)
 *  - Global unhandled-rejection handler
 */

(function (global) {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────── */
  var SUPABASE_URL  = (global.CREW_CONFIG && global.CREW_CONFIG.url)  || 'https://ggocdbsspynihtqlgozv.supabase.co';
  var SUPABASE_ANON = (global.CREW_CONFIG && global.CREW_CONFIG.anon) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnb2NkYnNzcHluaWh0cWxnb3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2Nzk1NzUsImV4cCI6MjA5MjI1NTU3NX0.jUlzuNmhqprLlKy-iM3qSNTnhtg6FUgwRKWMy2Y3kWA';

  var ROLE_ROUTES = {
    customer:       'Crew_App_Customer_Role.html',
    crew_member:    'Crew_App_Crew_Member.html',
    crew_manager:   'Crew_App_Crew_Manager.html',
    admin:          'Command_Center_Desktop.html',
    field_worker:   'CrewBase_Field_Worker_App.html',
    supervisor:     'CrewBase_Supervisor_App.html',
    crewbase_admin: 'CrewBase_Dashboard.html',
    user:           'Crew_App_Crew_Member.html',
    worker:         'Crew_App_Crew_Member.html'
  };

  /* ── Supabase client (singleton) ─────────────────────────────── */
  var _db = null;
  function getDB() {
    if (_db) return _db;
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      _db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: {
          persistSession:     true,
          autoRefreshToken:   true,
          detectSessionInUrl: true,
          flowType:           'pkce',
          storageKey:         'crew-auth-token',
          debug:              false
        },
        global: {
          headers: { 'x-application-name': 'crew-platform' }
        }
      });
      _attachSessionListener();
    }
    return _db;
  }

  /* ── Session expiry listener ─────────────────────────────────── */
  var _sessionListenerAttached = false;
  function _attachSessionListener() {
    if (_sessionListenerAttached || !_db) return;
    _sessionListenerAttached = true;
    _db.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT' && !_isDemoMode()) {
        var next = encodeURIComponent(global.location.pathname + global.location.search);
        global.location.href = '/auth.html?next=' + next;
      }
    });
  }

  /* ── Privileged-role helper ────────────────────────────────────── */
  /* admin and crewbase_admin bypass role gates identically, in both
     production and demo mode. Used everywhere a role check happens so the
     two modes can never drift out of parity with each other again. */
  function isPrivileged(role) {
    return role === 'admin' || role === 'crewbase_admin';
  }

  /* ── Auth guard ──────────────────────────────────────────────── */
  function _isDemoMode() {
    try {
      var ca = JSON.parse(localStorage.getItem('crew_auth') || 'null');
      return ca && ca.exp > Date.now();
    } catch (_) { return false; }
  }

  function _getDemoProfile() {
    try { return JSON.parse(localStorage.getItem('crewUserProfile') || 'null'); } catch (_) { return null; }
  }

  async function requireAuth(options) {
    options = options || {};

    // Demo mode: gate password valid, use crewUserProfile instead of Supabase
    if (_isDemoMode()) {
      var dp = _getDemoProfile();
      if (dp && dp.role) {
        if (options.requiredRole && dp.role !== options.requiredRole && !isPrivileged(dp.role)) {
          global.location.href = ROLE_ROUTES[dp.role] || '/auth.html';
          return;
        }
        return dp;
      }
      // Gate passed but no role selected yet, go to role picker
      global.location.href = '/auth.html?next=' + encodeURIComponent(global.location.pathname + global.location.search);
      return;
    }

    var db = getDB();
    if (!db) return;

    try {
      var result = await db.auth.getSession();
      var session = result && result.data && result.data.session;

      if (!session) {
        var next = encodeURIComponent(global.location.pathname + global.location.search);
        global.location.href = '/auth.html?next=' + next;
        return;
      }

      if (options.requiredRole) {
        var profile = await getProfileWithRetry(session.user.id);
        if (!profile) { _handleMissingProfile(); return; }
        var role = profile.role;
        if (role !== options.requiredRole && !isPrivileged(role)) {
          global.location.href = ROLE_ROUTES[role] || '/auth.html';
          return;
        }
      }

      _injectUserBadge(session.user);
      _initNotificationBell(session.user.id);
      _maybeShowPushPrompt();
      return session;
    } catch (e) {
      console.warn('[CrewFramework] Auth check failed:', e.message);
    }
  }

  /* ── Profile helpers ─────────────────────────────────────────── */
  async function getProfile(userId) {
    var db = getDB();
    if (!db) return null;
    try {
      var result = await db
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      return result && result.data;
    } catch (e) {
      return null;
    }
  }

  /* Retry getProfile up to 3 times over ~3 seconds. Covers the handle_new_user
     trigger race on first OAuth sign-in, where the session exists a moment
     before the profiles row has been created. */
  function _sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  async function getProfileWithRetry(userId, attempts, delayMs) {
    attempts = attempts || 3;
    delayMs = delayMs || 1000;
    for (var i = 0; i < attempts; i++) {
      var profile = await getProfile(userId);
      if (profile) return profile;
      if (i < attempts - 1) await _sleep(delayMs);
    }
    return null;
  }

  function _handleMissingProfile() {
    toast("We couldn't finish setting up your account. Please sign in again or contact support.", 'error', 6000);
    setTimeout(function () { global.location.href = '/auth.html'; }, 2500);
  }

  async function getCurrentUser() {
    var db = getDB();
    if (!db) return null;
    try {
      var result = await db.auth.getSession();
      var session = result && result.data && result.data.session;
      if (!session) return null;
      var profile = await getProfile(session.user.id);
      return Object.assign({}, session.user, profile || {});
    } catch (e) {
      return null;
    }
  }

  /* ── Sign out ────────────────────────────────────────────────── */
  async function signOut() {
    var db = getDB();
    if (db) {
      try { await db.auth.signOut(); } catch (e) { /* ignore */ }
    }
    global.location.href = '/auth.html';
  }

  /* ── Navigation ──────────────────────────────────────────────── */
  function goToApp(role) {
    var dest = ROLE_ROUTES[role] || '/auth.html';
    global.location.href = dest;
  }

  function goHome() {
    global.location.href = '/index.html';
  }

  /* ── Toast notifications ─────────────────────────────────────── */
  var _toastQueue = [];
  var _toastBusy  = false;

  function toast(message, type, duration) {
    type     = type     || 'info';
    duration = duration || 3500;
    _toastQueue.push({ message: message, type: type, duration: duration });
    if (!_toastBusy) _drainToastQueue();
  }

  function _drainToastQueue() {
    if (!_toastQueue.length) { _toastBusy = false; return; }
    _toastBusy = true;
    var item = _toastQueue.shift();
    _showToast(item.message, item.type, item.duration, _drainToastQueue);
  }

  function _showToast(message, type, duration, onDone) {
    var existing = document.getElementById('crew-toast');
    if (existing) existing.remove();

    var colors = {
      success: '#1a4d33',
      error:   '#b91c1c',
      warning: '#c47b0a',
      info:    '#231f1a'
    };
    var bg = colors[type] || colors.info;

    var el = document.createElement('div');
    el.id = 'crew-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.style.cssText = [
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%)',
      'background:' + bg,
      'color:#fff;padding:12px 22px;border-radius:50px',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',
      'font-size:13px;font-weight:600;z-index:99999',
      'box-shadow:0 4px 20px rgba(0,0,0,.28)',
      'pointer-events:none;opacity:0;transition:opacity .2s',
      'white-space:nowrap;max-width:90vw;text-overflow:ellipsis;overflow:hidden'
    ].join(';');
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.style.opacity = '1'; });
    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () {
        if (el.parentNode) el.remove();
        if (onDone) onDone();
      }, 220);
    }, duration);
  }

  /* ── User badge ──────────────────────────────────────────────── */
  function _injectUserBadge(user) {
    if (!user) return;
    if (document.getElementById('crew-user-badge')) return;

    var display = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name))
                  || user.email
                  || 'User';

    var badge = document.createElement('div');
    badge.id = 'crew-user-badge';
    badge.style.cssText = [
      'position:fixed;bottom:16px;left:16px;z-index:9998',
      'background:rgba(26,77,51,.92);color:#fff',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',
      'font-size:11px;font-weight:600;padding:7px 14px;border-radius:50px',
      'display:flex;align-items:center;gap:8px;backdrop-filter:blur(8px)',
      'box-shadow:0 2px 12px rgba(0,0,0,.2);cursor:pointer',
      'user-select:none;max-width:220px'
    ].join(';');

    var dot = document.createElement('span');
    dot.style.cssText = 'width:7px;height:7px;border-radius:50%;background:#4db37c;flex-shrink:0';

    var name = document.createElement('span');
    name.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    name.textContent = '✓ ' + display;

    badge.appendChild(dot);
    badge.appendChild(name);
    badge.title = 'Signed in as ' + (user.email || display) + ', click to sign out';
    badge.addEventListener('click', function () {
      if (confirm('Sign out of Crew?')) signOut();
    });

    document.body.appendChild(badge);
  }

  /* ── Notification bell ───────────────────────────────────────── */
  var _notifUserId   = null;
  var _notifCount    = 0;
  var _notifSub      = null;
  var _bellEl        = null;

  function _initNotificationBell(userId) {
    if (!userId) return;
    _notifUserId = userId;

    if (!document.getElementById('crew-notif-bell')) {
      _bellEl = document.createElement('div');
      _bellEl.id = 'crew-notif-bell';
      _bellEl.setAttribute('role', 'button');
      _bellEl.setAttribute('aria-label', 'Notifications');
      _bellEl.style.cssText = [
        'position:fixed;bottom:16px;right:16px;z-index:9998',
        'background:rgba(26,77,51,.92);color:#fff;cursor:pointer',
        'width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center',
        'font-size:18px;box-shadow:0 2px 12px rgba(0,0,0,.2);backdrop-filter:blur(8px)',
        'user-select:none;transition:transform .15s'
      ].join(';');
      _bellEl.innerHTML = '&#x1F514;';
      _bellEl.addEventListener('click', _toggleNotifPanel);
      document.body.appendChild(_bellEl);
    }

    _loadUnreadCount(userId);
    _subscribeNotifications(userId);
  }

  async function _loadUnreadCount(userId) {
    var db = getDB();
    if (!db) return;
    try {
      var res = await db
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);
      _setNotifBadge(res.count || 0);
    } catch (e) { /* silent */ }
  }

  function _setNotifBadge(n) {
    _notifCount = n;
    if (!_bellEl) return;
    var badge = document.getElementById('crew-notif-badge');
    if (n > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.id = 'crew-notif-badge';
        badge.style.cssText = [
          'position:absolute;top:-3px;right:-3px;background:#b91c1c;color:#fff',
          'font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:9px',
          'display:flex;align-items:center;justify-content:center;padding:0 4px',
          'font-family:-apple-system,sans-serif'
        ].join(';');
        _bellEl.style.position = 'fixed';
        _bellEl.appendChild(badge);
      }
      badge.textContent = n > 99 ? '99+' : String(n);
    } else if (badge) {
      badge.remove();
    }
  }

  function _subscribeNotifications(userId) {
    var db = getDB();
    if (!db || _notifSub) return;
    try {
      _notifSub = db
        .channel('crew-notifs-' + userId)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'user_id=eq.' + userId
        }, function (payload) {
          _setNotifBadge(_notifCount + 1);
          var n = payload.new;
          if (n && n.title) {
            toast(n.title + (n.body ? ': ' + n.body : ''),
                  n.type === 'alert' ? 'error' : n.type === 'warning' ? 'warning' : 'info',
                  4000);
          }
        })
        .subscribe();
    } catch (e) { /* realtime not available */ }
  }

  /* Unsubscribe the notifications channel when the page is being unloaded or
     hidden for navigation, so we don't leak an open Realtime socket per tab. */
  global.addEventListener('pagehide', function () {
    if (_notifSub) {
      try { _notifSub.unsubscribe(); } catch (e) { /* ignore */ }
      _notifSub = null;
    }
  });

  /* Retry a Supabase write once with a short backoff on failure. Used for
     notification mark-read writes, which are non-critical but shouldn't
     silently drop on a single flaky request. */
  async function _writeWithRetry(fn, retries, delayMs) {
    retries = retries === undefined ? 1 : retries;
    delayMs = delayMs || 600;
    try {
      var result = await fn();
      if (result && result.error && retries > 0) {
        await _sleep(delayMs);
        return _writeWithRetry(fn, retries - 1, delayMs * 2);
      }
      return result;
    } catch (e) {
      if (retries > 0) {
        await _sleep(delayMs);
        return _writeWithRetry(fn, retries - 1, delayMs * 2);
      }
      throw e;
    }
  }

  function _toggleNotifPanel() {
    var panel = document.getElementById('crew-notif-panel');
    if (panel) { panel.remove(); return; }
    _openNotifPanel();
  }

  async function _openNotifPanel() {
    var db = getDB();
    if (!db || !_notifUserId) return;

    var panel = document.createElement('div');
    panel.id = 'crew-notif-panel';
    panel.style.cssText = [
      'position:fixed;bottom:70px;right:16px;z-index:9999;width:320px;max-width:calc(100vw - 32px)',
      'background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18)',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',
      'overflow:hidden;animation:crewSlideUp .2s ease'
    ].join(';');

    if (!document.getElementById('crew-notif-style')) {
      var s = document.createElement('style');
      s.id = 'crew-notif-style';
      s.textContent = '@keyframes crewSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}';
      document.head.appendChild(s);
    }

    var header = document.createElement('div');
    header.style.cssText = 'padding:14px 16px;background:#1a4d33;color:#fff;display:flex;align-items:center;justify-content:space-between';
    header.innerHTML = '<span style="font-weight:700;font-size:14px">Notifications</span>' +
      '<button id="crew-mark-read" style="background:rgba(255,255,255,.2);border:none;color:#fff;font-size:11px;font-weight:600;padding:4px 10px;border-radius:50px;cursor:pointer">Mark all read</button>';

    var list = document.createElement('div');
    list.style.cssText = 'max-height:320px;overflow-y:auto;';

    var loading = document.createElement('div');
    loading.style.cssText = 'padding:24px;text-align:center;color:#8a8a8a;font-size:13px';
    loading.textContent = 'Loading…';
    list.appendChild(loading);

    panel.appendChild(header);
    panel.appendChild(list);
    document.body.appendChild(panel);

    document.addEventListener('click', function _outside(e) {
      if (!panel.contains(e.target) && e.target !== _bellEl) {
        panel.remove();
        document.removeEventListener('click', _outside);
      }
    }, true);

    try {
      var res = await db
        .from('notifications')
        .select('*')
        .eq('user_id', _notifUserId)
        .order('created_at', { ascending: false })
        .limit(20);

      list.innerHTML = '';
      var notifs = (res && res.data) || [];
      if (!notifs.length) {
        list.innerHTML = '<div style="padding:24px;text-align:center;color:#8a8a8a;font-size:13px">🎉 All caught up!</div>';
      } else {
        notifs.forEach(function (n) {
          var item = document.createElement('div');
          item.style.cssText = [
            'padding:12px 16px;border-bottom:1px solid #f0efed;cursor:pointer',
            'background:' + (n.read ? '#fff' : '#f2faf5')
          ].join(';');
          item.innerHTML = '<div style="font-size:13px;font-weight:' + (n.read ? '400' : '600') + ';color:#1a1a1a;margin-bottom:2px">' + _escHtml(n.title) + '</div>' +
            (n.body ? '<div style="font-size:12px;color:#6b6460;line-height:1.5">' + _escHtml(n.body) + '</div>' : '') +
            '<div style="font-size:11px;color:#aaa;margin-top:4px">' + _timeAgo(n.created_at) + '</div>';
          item.addEventListener('click', async function () {
            if (!n.read) {
              await _writeWithRetry(function () {
                return db.from('notifications').update({ read: true }).eq('id', n.id);
              });
              item.style.background = '#fff';
              _setNotifBadge(Math.max(0, _notifCount - 1));
            }
            if (n.link && n.link.startsWith('/') && !n.link.startsWith('//')) {
              global.location.href = n.link;
            }
          });
          list.appendChild(item);
        });
      }

      header.querySelector('#crew-mark-read').addEventListener('click', async function () {
        await _writeWithRetry(function () {
          return db.from('notifications').update({ read: true }).eq('user_id', _notifUserId).eq('read', false);
        });
        _setNotifBadge(0);
        panel.remove();
        toast('All notifications marked as read.', 'success');
      });
    } catch (e) {
      list.innerHTML = '<div style="padding:24px;text-align:center;color:#b91c1c;font-size:13px">Could not load notifications.</div>';
    }
  }

  function _escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _timeAgo(iso) {
    if (!iso) return '';
    var diff = Date.now() - new Date(iso).getTime();
    var s = Math.floor(diff / 1000);
    if (s < 60)  return 'just now';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return Math.floor(s/86400) + 'd ago';
  }

  /* ── Offline indicator ───────────────────────────────────────── */
  function _initOfflineIndicator() {
    function show() {
      if (document.getElementById('crew-offline-bar')) return;
      var bar = document.createElement('div');
      bar.id = 'crew-offline-bar';
      bar.style.cssText = [
        'position:fixed;top:0;left:0;right:0;z-index:999999',
        'background:#c47b0a;color:#fff;text-align:center',
        'font-family:-apple-system,sans-serif;font-size:13px;font-weight:600',
        'padding:8px 16px;letter-spacing:.01em'
      ].join(';');
      bar.textContent = "⚠️  You're offline, some features may not be available.";
      document.body.prepend(bar);
    }
    function hide() {
      var bar = document.getElementById('crew-offline-bar');
      if (bar) bar.remove();
      toast('Back online.', 'success', 2500);
    }
    global.addEventListener('offline', show);
    global.addEventListener('online',  hide);
    if (!global.navigator.onLine) show();
  }

  /* ── Global unhandled rejection handler ──────────────────────── */
  /* Only redirect to login for a genuine Supabase auth failure: a real
     401/invalid-JWT status or a known Supabase Auth/PostgREST error code.
     A rejection that merely mentions the word "auth" in its message (very
     common in unrelated errors) must not force a sign-out. */
  var AUTH_ERROR_CODES = {
    'PGRST301': true,
    'invalid_grant': true,
    'refresh_token_not_found': true,
    'invalid_token': true,
    'session_not_found': true
  };

  function _isGenuineAuthError(reason) {
    if (!reason) return false;
    if (reason.status === 401) return true;
    var code = reason.code || (reason.error && reason.error.code);
    if (code && AUTH_ERROR_CODES[code]) return true;
    return false;
  }

  function _initErrorHandler() {
    global.addEventListener('unhandledrejection', function (e) {
      if (_isGenuineAuthError(e.reason)) {
        toast('Your session has expired. Please sign in again.', 'error', 5000);
        setTimeout(function () { global.location.href = '/auth.html'; }, 5500);
      } else {
        console.error('[CrewFramework] Unhandled rejection:', e.reason);
      }
    });
  }

  /* ── PWA install prompt ──────────────────────────────────────── */
  var _deferredInstall = null;
  global.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    _deferredInstall = e;
    var btn = document.getElementById('crew-install-btn');
    if (btn) btn.style.display = 'flex';
  });

  function promptInstall() {
    if (!_deferredInstall) {
      toast('Already installed, or not supported on this browser.', 'info');
      return;
    }
    _deferredInstall.prompt();
    _deferredInstall.userChoice.then(function (result) {
      if (result.outcome === 'accepted') {
        toast('Crew installed!', 'success');
        var btn = document.getElementById('crew-install-btn');
        if (btn) btn.style.display = 'none';
      }
      _deferredInstall = null;
    });
  }

  /* ── Service worker registration ─────────────────────────────── */
  /* Update detection lives entirely here, not in the service worker: a new
     worker reaching the 'installed' state only means "an update is ready"
     when this page is already controlled by a PREVIOUS worker. On a
     brand-new user's very first visit there is no existing controller, so
     the update bar must never show in that case. */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function (registration) {
        registration.addEventListener('updatefound', function () {
          var installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', function () {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              _showUpdateBar();
            }
          });
        });
      })
      .catch(function (err) {
        console.warn('[CrewFramework] SW registration failed:', err);
      });
  }

  function _showUpdateBar() {
    if (document.getElementById('crew-update-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'crew-update-bar';
    bar.style.cssText = [
      'position:fixed;top:0;left:0;right:0;z-index:999999',
      'background:#1a4d33;color:#fff;display:flex;align-items:center;justify-content:center;gap:16px',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',
      'font-size:13px;font-weight:600;padding:10px 16px'
    ].join(';');
    var msg = document.createElement('span');
    msg.textContent = 'A new version of Crew is available.';
    var btn = document.createElement('button');
    btn.textContent = 'Reload';
    btn.style.cssText = 'padding:5px 14px;background:#fff;color:#1a4d33;border:none;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;';
    btn.addEventListener('click', function () { global.location.reload(); });
    bar.appendChild(msg);
    bar.appendChild(btn);
    document.body.prepend(bar);
  }

  /* ── Web Push subscription ───────────────────────────────────── */
  var PUSH_PROMPT_DISMISSED_KEY = 'crew-push-prompt-dismissed';

  function _urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = global.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  async function _authHeader() {
    var db = getDB();
    if (!db) return null;
    var result = await db.auth.getSession();
    var session = result && result.data && result.data.session;
    return session ? { Authorization: 'Bearer ' + session.access_token } : null;
  }

  async function _postSubscription(subscription) {
    var auth = await _authHeader();
    if (!auth) return;
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, auth),
        body: JSON.stringify({ subscription: subscription.toJSON ? subscription.toJSON() : subscription })
      });
    } catch (e) { console.warn('[CrewFramework] push subscribe upload failed:', e.message); }
  }

  async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in global)) {
      toast('Push notifications are not supported on this browser.', 'info');
      return false;
    }
    try {
      var configRes = await fetch('/api/config');
      var config = await configRes.json();
      if (!config.vapidPublicKey) { toast('Push notifications are not configured yet.', 'info'); return false; }

      var registration = await navigator.serviceWorker.ready;
      var subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlBase64ToUint8Array(config.vapidPublicKey)
      });
      await _postSubscription(subscription);
      return true;
    } catch (e) {
      console.warn('[CrewFramework] push subscribe failed:', e.message);
      return false;
    }
  }

  async function unsubscribeFromPush() {
    if (!('serviceWorker' in navigator)) return;
    try {
      var registration = await navigator.serviceWorker.ready;
      var subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;
      var endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      var auth = await _authHeader();
      if (auth) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, auth),
          body: JSON.stringify({ endpoint: endpoint })
        });
      }
      toast('Job alerts turned off for this device.', 'info');
    } catch (e) { console.warn('[CrewFramework] push unsubscribe failed:', e.message); }
  }

  async function isPushSubscribed() {
    if (!('serviceWorker' in navigator)) return false;
    try {
      var registration = await navigator.serviceWorker.ready;
      var subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    } catch (e) { return false; }
  }

  /* Small in-app prompt card, shown at most once per session, and only ever
     requesting browser permission on an explicit tap — never unsolicited. */
  function _maybeShowPushPrompt() {
    if (!('Notification' in global) || !('serviceWorker' in navigator) || !('PushManager' in global)) return;
    if (Notification.permission !== 'default') return;
    if (sessionStorage.getItem(PUSH_PROMPT_DISMISSED_KEY)) return;
    if (document.getElementById('crew-push-prompt')) return;

    var card = document.createElement('div');
    card.id = 'crew-push-prompt';
    card.style.cssText = [
      'position:fixed;bottom:16px;left:16px;right:16px;max-width:360px;margin:0 auto;z-index:9997',
      'background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18)',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',
      'padding:16px;display:flex;align-items:flex-start;gap:12px'
    ].join(';');
    card.innerHTML = '<span style="font-size:24px;flex-shrink:0">🔔</span>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:13px;font-weight:700;color:#1a1a1a;margin-bottom:2px">Get job alerts even when the app is closed</div>' +
        '<div style="font-size:12px;color:#6b6460;margin-bottom:10px">Turn on notifications so you never miss a match.</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button id="crew-push-enable" style="background:#1a4d33;color:#fff;border:none;border-radius:50px;padding:7px 16px;font-size:12px;font-weight:600;cursor:pointer">Enable</button>' +
          '<button id="crew-push-dismiss" style="background:none;color:#6b6460;border:none;padding:7px 10px;font-size:12px;font-weight:600;cursor:pointer">Not now</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(card);

    function dismiss() { sessionStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, '1'); card.remove(); }
    card.querySelector('#crew-push-dismiss').addEventListener('click', dismiss);
    card.querySelector('#crew-push-enable').addEventListener('click', async function () {
      var permission = await Notification.requestPermission();
      dismiss();
      if (permission === 'granted') {
        var ok = await subscribeToPush();
        if (ok) toast('Job alerts turned on.', 'success');
      }
    });
  }

  /* Re-subscription: if the push service rotates a subscription's endpoint
     (rare, but does happen), the service worker re-subscribes itself and
     posts the new subscription here so we can upload it. See sw.js's
     'pushsubscriptionchange' handler. */
  function _listenForResubscription() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', function (event) {
      if (event.data && event.data.type === 'PUSH_RESUBSCRIBED' && event.data.subscription) {
        _postSubscription(event.data.subscription);
      }
    });
  }

  /* ── Auto-init on DOMContentLoaded ──────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    registerSW();
    _initOfflineIndicator();
    _initErrorHandler();
    _listenForResubscription();
  });

  /* ── Public API ──────────────────────────────────────────────── */
  global.CrewFramework = {
    requireAuth:    requireAuth,
    getProfile:     getProfile,
    getCurrentUser: getCurrentUser,
    signOut:        signOut,
    goToApp:        goToApp,
    goHome:         goHome,
    toast:          toast,
    promptInstall:  promptInstall,
    registerSW:     registerSW,
    getDB:          getDB,
    ROLE_ROUTES:    ROLE_ROUTES,
    subscribeToPush:     subscribeToPush,
    unsubscribeFromPush: unsubscribeFromPush,
    isPushSubscribed:    isPushSubscribed
  };

  /* ── Backwards-compat shims (app pages expect crewUI / crewAuth / crewNav) ── */

  global.crewUI = {
    toast:       toast,
    hideLoading: function () { /* apps manage their own loading states */ },
    showError:   function (msg) { toast(msg, 'error', 5000); }
  };

  global.crewAuth = {
    // Sync read of the cached profile (set by auth.html on login).
    // Used by messaging-integration.js and crew-member-wrapper.js.
    getCurrentUser: function () {
      try { return JSON.parse(localStorage.getItem('crewUserProfile') || 'null'); } catch (e) { return null; }
    },
    require: function (allowedRoles) {
      return new Promise(function (resolve, reject) {
        // Demo mode: gate password valid, use crewUserProfile instead of Supabase
        if (_isDemoMode()) {
          var dp = _getDemoProfile();
          if (dp && dp.role) {
            var roles = allowedRoles || [];
            var ok = !roles.length || roles.some(function (r) {
              return r === dp.role || (r === 'user' && dp.role === 'crew_member');
            }) || isPrivileged(dp.role);
            if (ok) { resolve(dp); return; }
            // Role mismatch: redirect to the correct app for this user
            global.location.href = ROLE_ROUTES[dp.role] || '/auth.html';
            resolve(null); return;
          }
          // Gate passed but no role selected yet
          global.location.href = '/auth.html?next=' + encodeURIComponent(global.location.pathname + global.location.search);
          resolve(null); return;
        }

        // Production: check real Supabase session
        var db = getDB();
        if (!db) { resolve(null); return; }
        db.auth.getSession().then(function (result) {
          var session = result && result.data && result.data.session;
          if (!session) {
            var next = encodeURIComponent(global.location.pathname + global.location.search);
            global.location.href = '/auth.html?next=' + next;
            resolve(null);
            return;
          }
          getProfileWithRetry(session.user.id).then(function (profile) {
            if (!profile) { _handleMissingProfile(); resolve(null); return; }
            var roles = allowedRoles || [];
            // 'user' is a legacy alias for crew_member
            var ok = !roles.length || roles.some(function (r) {
              return r === profile.role ||
                     (r === 'user' && profile.role === 'crew_member');
            }) || isPrivileged(profile.role);
            if (!ok) {
              global.location.href = ROLE_ROUTES[profile.role] || '/auth.html';
              resolve(null);
              return;
            }
            _injectUserBadge(session.user);
            _initNotificationBell(session.user.id);
            _maybeShowPushPrompt();
            resolve(profile);
          }).catch(reject);
        }).catch(reject);
      });
    }
  };

  // PascalCase alias: messaging-integration.js and crew-member-wrapper.js call window.CrewAuth
  global.CrewAuth = global.crewAuth;

  global.crewNav = {
    wireBackButtons: function () { /* apps use their own goBack() navigation */ }
  };

}(window));
