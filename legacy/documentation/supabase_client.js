// ═══════════════════════════════════════════════════════════════════════════
// CREW PLATFORM — SUPABASE CLIENT  v2.1
// supabase_client.js  —  include in every HTML file before other scripts
//
// Live credentials — Crew project (ggocdbsspynihtqlgozv)
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL  = 'https://ggocdbsspynihtqlgozv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnb2NkYnNzcHluaWh0cWxnb3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2Nzk1NzUsImV4cCI6MjA5MjI1NTU3NX0.jUlzuNmhqprLlKy-iM3qSNTnhtg6FUgwRKWMy2Y3kWA';

// ── Schema mapping ─────────────────────────────────────────────────────────
// Your live Supabase DB uses `profiles` as the user table.
// The platform code uses `users` internally.
// PROFILE_TABLE bridges both — all queries use this constant.
const PROFILE_TABLE = 'profiles';

// Column aliases: live DB column → platform field name
// profiles.full_name  → name
// profiles.phone_number → phone
// profiles.company_name → company_name (new field)
// profiles.avatar_url → avatar_url (new field)

// ── Load Supabase JS v2 from CDN ───────────────────────────────────────────
(function () {
  if (window.crewDB) return;
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  script.crossOrigin = 'anonymous';
  script.onload = function () {
    window.crewDB = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
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
    window._crewDBReady = true;
    document.dispatchEvent(new Event('crewDBReady'));
  };
  script.onerror = function () {
    console.error('❌ Failed to load Supabase JS. Check network/CDN.');
  };
  document.head.appendChild(script);
})();

// Promise that resolves when crewDB is available
function crewReady() {
  return new Promise(function (resolve) {
    if (window._crewDBReady && window.crewDB) return resolve(window.crewDB);
    document.addEventListener('crewDBReady', function () { resolve(window.crewDB); }, { once: true });
  });
}

// ── AUTH HELPERS ───────────────────────────────────────────────────────────
var CrewAuth = {

  // Sign in with email + password
  signIn: async function (email, password) {
    var db = await crewReady();
    var res = await db.auth.signInWithPassword({ email, password });
    if (res.error) throw res.error;
    return await CrewAuth._loadProfile(res.data.user.id);
  },

  // Magic link / email OTP sign-in has been removed platform-wide. Auth is
  // Google, Apple (behind AUTH_APPLE_ENABLED) or email + password only, via
  // auth.html and auth/callback.html — see AUTH_SETUP.md.

  // Google OAuth sign in
  signInWithGoogle: async function () {
    var db = await crewReady();
    var res = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' }
    });
    if (res.error) throw res.error;
  },

  // Apple OAuth sign in (behind AUTH_APPLE_ENABLED, see /api/config)
  signInWithApple: async function () {
    var db = await crewReady();
    var res = await db.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin + '/auth/callback' }
    });
    if (res.error) throw res.error;
  },

  // Sign up with email + password — creates profile row
  signUp: async function (email, password, fullName, phone) {
    var db = await crewReady();
    var res = await db.auth.signUp({ email, password });
    if (res.error) throw res.error;
    // Profile row is created by DB trigger (on_auth_user_created)
    // but we upsert extra fields here to be safe
    await CrewAuth._upsertProfile(res.data.user.id, {
      email, full_name: fullName, phone: phone || null,
      role: 'customer', avatar_initials: CrewAuth._initials(fullName)
    });
    return res.data.user;
  },

  // Upsert profile row into `profiles` table
  _upsertProfile: async function (userId, fields) {
    var db = await crewReady();
    var payload = Object.assign({ id: userId }, fields);
    // Map platform field names → live DB column names
    if (payload.name && !payload.full_name) payload.full_name = payload.name;
    // Remove platform-only aliases before sending to DB
    delete payload.name;
    var { error } = await db.from(PROFILE_TABLE).upsert(payload, { onConflict: 'id' });
    if (error) console.warn('Profile upsert:', error.message);
  },

  // Load profile from `profiles` and normalise field names
  _loadProfile: async function (userId) {
    var db = await crewReady();
    var { data, error } = await db.from(PROFILE_TABLE).select('*').eq('id', userId).single();
    if (error) throw error;
    // Normalise to platform field names
    var profile = CrewAuth._normalise(data);
    localStorage.setItem('crewUserProfile', JSON.stringify(profile));
    return profile;
  },

  // Normalise profiles row → platform user object
  _normalise: function (row) {
    if (!row) return null;
    return {
      id:               row.id,
      email:            row.email,
      name:             row.full_name || row.name || row.email,
      full_name:        row.full_name,
      role:             row.role || 'customer',
      phone:            row.phone || row.phone_number,
      company_name:     row.company_name,
      avatar_url:       row.avatar_url,
      avatar_initials:  row.avatar_initials || CrewAuth._initials(row.full_name || row.email),
      bio:              row.bio,
      // org_id maps to teams in live schema — use team membership instead
      org_id:           row.org_id || 'a1b2c3d4-0000-0000-0000-000000000001',
      // Map role to platform routing roles
      platform_role:    CrewAuth._mapRole(row.role)
    };
  },

  // Map DB role → platform routing role
  _mapRole: function (role) {
    var map = {
      admin:          'admin',
      user:           'crew_member',
      crew_manager:   'crew_manager',
      crew_member:    'crew_member',
      customer:       'customer',
      field_worker:   'field_worker',
      supervisor:     'supervisor',
      crewbase_admin: 'crewbase_admin'
    };
    return map[role] || 'crew_member';
  },

  // Get current user from localStorage (fast, cached)
  getCurrentUser: function () {
    try { return JSON.parse(localStorage.getItem('crewUserProfile') || 'null'); }
    catch (e) { return null; }
  },

  // Get live session from Supabase
  getSession: async function () {
    var db = await crewReady();
    var { data } = await db.auth.getSession();
    return data.session;
  },

  // Auth guard — redirect to auth.html if not signed in
  requireAuth: async function (allowedRoles) {
    var db = await crewReady();
    var { data } = await db.auth.getSession();
    if (!data.session) { window.location.href = 'auth.html'; return null; }
    var user = CrewAuth.getCurrentUser();
    if (!user) { user = await CrewAuth._loadProfile(data.session.user.id); }
    if (allowedRoles && !allowedRoles.includes(user.role) && !allowedRoles.includes(user.platform_role)) {
      window.location.href = 'auth.html?error=unauthorized';
      return null;
    }
    return user;
  },

  // Update profile fields (phone_number, company_name, etc.)
  updateProfile: async function (fields) {
    var db = await crewReady();
    var user = CrewAuth.getCurrentUser();
    if (!user) throw new Error('Not signed in');
    // Map platform names → DB column names
    var dbFields = {};
    if (fields.name)         dbFields.full_name     = fields.name;
    if (fields.full_name)    dbFields.full_name     = fields.full_name;
    if (fields.phone)        dbFields.phone  = fields.phone;
    if (fields.phone_number) dbFields.phone  = fields.phone_number;
    if (fields.company_name) dbFields.company_name  = fields.company_name;
    if (fields.bio)          dbFields.bio           = fields.bio;
    if (fields.avatar_url)   dbFields.avatar_url    = fields.avatar_url;
    var { error } = await db.from(PROFILE_TABLE).update(dbFields).eq('id', user.id);
    if (error) throw error;
    // Refresh local cache
    return await CrewAuth._loadProfile(user.id);
  },

  // Sign out
  signOut: async function () {
    var db = await crewReady();
    await db.auth.signOut();
    localStorage.removeItem('crewUserProfile');
    window.location.href = 'auth.html';
  },

  // Route to correct app by role
  routeByRole: function (role) {
    var routes = {
      customer:       'Crew_App_Customer_Role.html',
      crew_member:    'Crew_App_Crew_Member.html',
      crew_manager:   'Crew_App_Crew_Manager.html',
      admin:          'Command_Center_Desktop.html',
      field_worker:   'CrewBase_Field_Worker_App.html',
      supervisor:     'CrewBase_Supervisor_App.html',
      crewbase_admin: 'CrewBase_Dashboard.html'
    };
    window.location.href = routes[role] || 'index.html';
  },

  _initials: function (name) {
    return (name || 'U').split(/[\s@]/).filter(Boolean).map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
  }
};

// ── DATA HELPERS ───────────────────────────────────────────────────────────
var CrewData = {

  getOrgId: function () {
    var u = CrewAuth.getCurrentUser();
    return u ? (u.org_id || null) : null;
  },

  getUserId: function () {
    var u = CrewAuth.getCurrentUser();
    return u ? u.id : null;
  },

  // ── TEAMS (maps to platform "organisations") ──────────────────────────
  getMyTeams: async function () {
    var db = await crewReady();
    var userId = CrewData.getUserId();
    // Get teams via team_members junction table
    var { data, error } = await db
      .from('team_members')
      .select('member_role, teams(id, name, description, created_by)')
      .eq('profile_id', userId);
    if (error) throw error;
    return (data || []).map(function (tm) {
      return Object.assign({}, tm.teams, { member_role: tm.member_role });
    });
  },

  getAllTeams: async function () {
    var db = await crewReady();
    var { data, error } = await db.from('teams').select('*, profiles(full_name, email)').order('name');
    if (error) throw error;
    return data;
  },

  createTeam: async function (name, description) {
    var db = await crewReady();
    var userId = CrewData.getUserId();
    var { data, error } = await db.from('teams').insert({ name, description, created_by: userId }).select().single();
    if (error) throw error;
    // Auto-add creator as admin member
    await db.from('team_members').insert({ team_id: data.id, profile_id: userId, member_role: 'admin' });
    return data;
  },

  // ── TEAM MEMBERS ──────────────────────────────────────────────────────
  getTeamMembers: async function (teamId) {
    var db = await crewReady();
    var { data, error } = await db
      .from('team_members')
      .select('member_role, joined_at, profiles(id, full_name, email, avatar_url, role, company_name)')
      .eq('team_id', teamId);
    if (error) throw error;
    return (data || []).map(function (tm) {
      return Object.assign({}, CrewAuth._normalise(tm.profiles), { member_role: tm.member_role, joined_at: tm.joined_at });
    });
  },

  addTeamMember: async function (teamId, profileId, memberRole) {
    var db = await crewReady();
    var { data, error } = await db.from('team_members').insert({
      team_id: teamId, profile_id: profileId, member_role: memberRole || 'member'
    }).select().single();
    if (error) throw error;
    return data;
  },

  // ── ALL PROFILES (admin only) ─────────────────────────────────────────
  getAllProfiles: async function () {
    var db = await crewReady();
    var { data, error } = await db.from(PROFILE_TABLE).select('*').order('full_name');
    if (error) throw error;
    return (data || []).map(CrewAuth._normalise);
  },

  // ── ACTIVITY LOG ──────────────────────────────────────────────────────
  getActivity: async function (teamId, limit) {
    var db = await crewReady();
    var { data, error } = await db
      .from('activity_log')
      .select('*, profiles(full_name, avatar_url)')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(limit || 50);
    if (error) throw error;
    return data;
  },

  postActivity: async function (teamId, content, activityType) {
    var db = await crewReady();
    var userId = CrewData.getUserId();
    var { data, error } = await db.from('activity_log').insert({
      team_id: teamId, profile_id: userId,
      content: content, activity_type: activityType || 'message'
    }).select().single();
    if (error) throw error;
    return data;
  },

  // ── JOBS (Crew marketplace) ───────────────────────────────────────────
  getJobs: async function (status) {
    var db = await crewReady();
    var q = db.from('jobs').select('*, customers(name, phone), workers(name, avatar_initials)').order('scheduled_at', { ascending: true });
    var orgId = CrewData.getOrgId();
    if (orgId) q = q.eq('org_id', orgId);
    if (status) q = q.eq('status', status);
    var { data, error } = await q;
    if (error) throw error;
    return data;
  },

  createJob: async function (jobData) {
    var db = await crewReady();
    var { data, error } = await db.from('jobs').insert(Object.assign({ org_id: CrewData.getOrgId() }, jobData)).select().single();
    if (error) throw error;
    return data;
  },

  updateJob: async function (id, updates) {
    var db = await crewReady();
    var { data, error } = await db.from('jobs').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ── WORKERS ───────────────────────────────────────────────────────────
  getWorkers: async function (status) {
    var db = await crewReady();
    var q = db.from('workers').select('*').order('name');
    var orgId = CrewData.getOrgId();
    if (orgId) q = q.eq('org_id', orgId);
    if (status) q = q.eq('status', status);
    var { data, error } = await q;
    if (error) throw error;
    return data;
  },

  updateWorkerGPS: async function (workerId, lat, lng) {
    var db = await crewReady();
    return db.from('workers').update({
      gps_lat: lat, gps_lng: lng, gps_updated_at: new Date().toISOString()
    }).eq('id', workerId);
  },

  // ── CUSTOMERS ─────────────────────────────────────────────────────────
  getCustomers: async function () {
    var db = await crewReady();
    var q = db.from('customers').select('*').order('name');
    var orgId = CrewData.getOrgId();
    if (orgId) q = q.eq('org_id', orgId);
    var { data, error } = await q;
    if (error) throw error;
    return data;
  },

  // ── INVOICES ──────────────────────────────────────────────────────────
  getInvoices: async function (status) {
    var db = await crewReady();
    var q = db.from('invoices').select('*, customers(name), jobs(service_type, address)').order('created_at', { ascending: false });
    var orgId = CrewData.getOrgId();
    if (orgId) q = q.eq('org_id', orgId);
    if (status) q = q.eq('status', status);
    var { data, error } = await q;
    if (error) throw error;
    return data;
  },

  // ── INCIDENTS ─────────────────────────────────────────────────────────
  createIncident: async function (incidentData) {
    var db = await crewReady();
    var { data, error } = await db.from('incidents').insert(
      Object.assign({ org_id: CrewData.getOrgId() }, incidentData)
    ).select().single();
    if (error) throw error;
    return data;
  },

  getIncidents: async function () {
    var db = await crewReady();
    var q = db.from('incidents').select('*, workers(name)').order('created_at', { ascending: false });
    var orgId = CrewData.getOrgId();
    if (orgId) q = q.eq('org_id', orgId);
    var { data, error } = await q;
    if (error) throw error;
    return data;
  },

  // ── TIME ENTRIES ──────────────────────────────────────────────────────
  clockIn: async function (workerId, jobId, lat, lng) {
    var db = await crewReady();
    var { data, error } = await db.from('time_entries').insert({
      org_id: CrewData.getOrgId(), worker_id: workerId, job_id: jobId || null,
      clock_in: new Date().toISOString(), clock_in_lat: lat, clock_in_lng: lng
    }).select().single();
    if (error) throw error;
    return data;
  },

  clockOut: async function (entryId, lat, lng) {
    var db = await crewReady();
    var clockOut = new Date().toISOString();
    var { data: entry } = await db.from('time_entries').select('clock_in').eq('id', entryId).single();
    var totalHours = entry ? (new Date(clockOut) - new Date(entry.clock_in)) / 3600000 : null;
    var { data, error } = await db.from('time_entries').update({
      clock_out: clockOut, clock_out_lat: lat, clock_out_lng: lng, total_hours: totalHours
    }).eq('id', entryId).select().single();
    if (error) throw error;
    return data;
  },

  // ── MESSAGES ──────────────────────────────────────────────────────────
  getMessages: async function (channel) {
    var db = await crewReady();
    var q = db.from('messages').select('*').eq('channel', channel).order('created_at', { ascending: true }).limit(100);
    var orgId = CrewData.getOrgId();
    if (orgId) q = q.eq('org_id', orgId);
    var { data, error } = await q;
    if (error) throw error;
    return data;
  },

  sendMessage: async function (channel, content) {
    var db = await crewReady();
    var user = CrewAuth.getCurrentUser();
    var { data, error } = await db.from('messages').insert({
      org_id: CrewData.getOrgId(), channel, content,
      sender_id: user ? user.id : null,
      sender_name: user ? (user.name || user.full_name) : 'Unknown'
    }).select().single();
    if (error) throw error;
    return data;
  },

  // ── FORM SUBMISSIONS ──────────────────────────────────────────────────
  submitForm: async function (formType, formCode, dataJson, workerId, jobId, photoUrl, aiConfidence) {
    var db = await crewReady();
    var { data, error } = await db.from('form_submissions').insert({
      org_id: CrewData.getOrgId(), form_type: formType, form_code: formCode,
      data_json: dataJson, worker_id: workerId || null, job_id: jobId || null,
      photo_url: photoUrl || null, ai_confidence: aiConfidence || null,
      status: 'submitted'
    }).select().single();
    if (error) throw error;
    return data;
  },

  // ── STORAGE (crew-assets bucket) ──────────────────────────────────────
  uploadAsset: async function (file, folder) {
    var db = await crewReady();
    var userId = CrewData.getUserId();
    var path = userId + '/' + (folder ? folder + '/' : '') + Date.now() + '-' + file.name;
    var { data, error } = await db.storage.from('crew-assets').upload(path, file, { upsert: false });
    if (error) throw error;
    var { data: urlData } = db.storage.from('crew-assets').getPublicUrl(path);
    return urlData.publicUrl;
  },

  uploadFormPhoto: async function (file, formType) {
    var db = await crewReady();
    var orgId = CrewData.getOrgId() || CrewData.getUserId();
    var path = orgId + '/forms/' + formType + '/' + Date.now() + '-' + file.name;
    var { data, error } = await db.storage.from('form-photos').upload(path, file, { upsert: false });
    if (error) throw error;
    var { data: urlData } = db.storage.from('form-photos').getPublicUrl(path);
    return urlData.publicUrl;
  },

  uploadJobPhoto: async function (file, jobId) {
    var db = await crewReady();
    var orgId = CrewData.getOrgId() || CrewData.getUserId();
    var path = orgId + '/jobs/' + jobId + '/' + Date.now() + '-' + file.name;
    var { data, error } = await db.storage.from('job-photos').upload(path, file, { upsert: false });
    if (error) throw error;
    var { data: urlData } = db.storage.from('job-photos').getPublicUrl(path);
    return urlData.publicUrl;
  },

  // ── ANALYTICS ─────────────────────────────────────────────────────────
  getJobStats: async function () {
    var db = await crewReady();
    var orgId = CrewData.getOrgId();
    var queries = [
      db.from('jobs').select('status, price').eq('org_id', orgId),
      db.from('invoices').select('status, total').eq('org_id', orgId),
      db.from('workers').select('status').eq('org_id', orgId)
    ];
    var [jobs, invoices, workers] = await Promise.all(queries);
    var completedJobs = (jobs.data || []).filter(function (j) { return j.status === 'completed'; });
    var revenue = (invoices.data || [])
      .filter(function (i) { return i.status === 'paid'; })
      .reduce(function (s, i) { return s + parseFloat(i.total || 0); }, 0);
    var activeWorkers = (workers.data || []).filter(function (w) { return w.status === 'active'; }).length;
    return {
      totalJobs: (jobs.data || []).length,
      completedJobs: completedJobs.length,
      revenue: revenue,
      activeWorkers: activeWorkers
    };
  }
};

// ── REALTIME HELPERS ───────────────────────────────────────────────────────
var CrewRealtime = {
  subscriptions: {},

  onJobChange: async function (callback) {
    var db = await crewReady();
    var orgId = CrewData.getOrgId();
    var sub = db.channel('jobs-' + orgId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: 'org_id=eq.' + orgId }, callback)
      .subscribe();
    CrewRealtime.subscriptions['jobs'] = sub;
    return sub;
  },

  onMessage: async function (channel, callback) {
    var db = await crewReady();
    var orgId = CrewData.getOrgId();
    var sub = db.channel('msg-' + orgId + '-' + channel)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
          filter: 'org_id=eq.' + orgId + '&channel=eq.' + channel }, callback)
      .subscribe();
    CrewRealtime.subscriptions['msg-' + channel] = sub;
    return sub;
  },

  onActivityLog: async function (teamId, callback) {
    var db = await crewReady();
    var sub = db.channel('activity-' + teamId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log',
          filter: 'team_id=eq.' + teamId }, callback)
      .subscribe();
    CrewRealtime.subscriptions['activity-' + teamId] = sub;
    return sub;
  },

  onGPSUpdate: async function (callback) {
    var db = await crewReady();
    var orgId = CrewData.getOrgId();
    var sub = db.channel('gps-' + orgId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workers',
          filter: 'org_id=eq.' + orgId }, callback)
      .subscribe();
    CrewRealtime.subscriptions['gps'] = sub;
    return sub;
  },

  unsubscribeAll: async function () {
    var db = await crewReady();
    await db.removeAllChannels();
    CrewRealtime.subscriptions = {};
  }
};

// ── Expose globals ─────────────────────────────────────────────────────────
window.crewReady     = crewReady;
window.CrewAuth      = CrewAuth;
window.CrewData      = CrewData;
window.CrewRealtime  = CrewRealtime;
