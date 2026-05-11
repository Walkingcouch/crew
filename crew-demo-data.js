// ═══════════════════════════════════════════════════════════════════════════
// crew-demo-data.js  —  Demonstration profiles & content for the Crew Platform
// All demo names, addresses and service descriptions are prefixed [DEMO].
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var VERSION = '2026.05.04.v1';

  // ── Date helpers (anchored to 2026-05-04 AEST) ────────────────────────────
  var BASE_MS = new Date('2026-05-04T09:00:00Z').getTime(); // 7 pm AEST
  function dms(offsetDays, utcHour) {
    var ms = BASE_MS + offsetDays * 86400000;
    if (utcHour !== undefined) {
      var d = new Date(ms);
      d.setUTCHours(utcHour, 0, 0, 0);
      ms = d.getTime();
    }
    return new Date(ms).toISOString();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEMO PROFILES  —  one per platform role
  // ═══════════════════════════════════════════════════════════════════════════
  var PROFILES = {
    admin: {
      id: 'demo-admin-001', email: 'david.chen@demo.crew',
      name: '[DEMO] David Chen', full_name: '[DEMO] David Chen',
      role: 'admin', phone: '0400 001 001', avatar_initials: 'DC',
      org_id: 'demo-org-001', _demo: true
    },
    customer: {
      id: 'demo-cust-001', email: 'sarah.thompson@demo.crew',
      name: '[DEMO] Sarah Thompson', full_name: '[DEMO] Sarah Thompson',
      role: 'customer', phone: '0412 345 678', avatar_initials: 'ST',
      address: '42 Banksia St, Paddington NSW 2021',
      org_id: 'demo-org-001', _demo: true
    },
    crew_member: {
      id: 'demo-cm-001', email: 'mike.rodriguez@demo.crew',
      name: '[DEMO] Mike Rodriguez', full_name: '[DEMO] Mike Rodriguez',
      role: 'crew_member', phone: '0421 111 222', avatar_initials: 'MR',
      org_id: 'demo-org-001', _demo: true
    },
    crew_manager: {
      id: 'demo-mgr-001', email: 'jessica.park@demo.crew',
      name: '[DEMO] Jessica Park', full_name: '[DEMO] Jessica Park',
      role: 'crew_manager', phone: '0433 222 333', avatar_initials: 'JP',
      org_id: 'demo-org-001', _demo: true
    },
    field_worker: {
      id: 'demo-fw-001', email: 'tom.walsh@demo.crew',
      name: '[DEMO] Tom Walsh', full_name: '[DEMO] Tom Walsh',
      role: 'field_worker', phone: '0444 333 444', avatar_initials: 'TW',
      org_id: 'demo-org-001', _demo: true
    },
    supervisor: {
      id: 'demo-sup-001', email: 'emma.nguyen@demo.crew',
      name: '[DEMO] Emma Nguyen', full_name: '[DEMO] Emma Nguyen',
      role: 'supervisor', phone: '0455 444 555', avatar_initials: 'EN',
      org_id: 'demo-org-001', _demo: true
    },
    crewbase_admin: {
      id: 'demo-cba-001', email: 'alex.kumar@demo.crew',
      name: '[DEMO] Alex Kumar', full_name: '[DEMO] Alex Kumar',
      role: 'crewbase_admin', phone: '0466 555 666', avatar_initials: 'AK',
      org_id: 'demo-org-001', _demo: true
    },
    enterprise_team_leader: {
      id: 'demo-etl-001', email: 'rachel.green@demo.crew',
      name: '[DEMO] Rachel Green', full_name: '[DEMO] Rachel Green',
      role: 'crew_manager', phone: '0477 666 777', avatar_initials: 'RG',
      enterprise: true, org_id: 'demo-org-001', _demo: true
    },
    enterprise_team_member: {
      id: 'demo-etm-001', email: 'jordan.smith@demo.crew',
      name: '[DEMO] Jordan Smith', full_name: '[DEMO] Jordan Smith',
      role: 'crew_member', phone: '0488 777 888', avatar_initials: 'JS',
      enterprise: true, org_id: 'demo-org-001', _demo: true
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SHARED DATA  —  crewSharedData
  // ═══════════════════════════════════════════════════════════════════════════
  var SHARED = {
    lastUpdate: dms(0),

    // ── USERS (customers) ──────────────────────────────────────────────────
    users: {
      'sarah.thompson@demo.crew': {
        id: 'demo-cust-001', email: 'sarah.thompson@demo.crew',
        name: '[DEMO] Sarah Thompson', phone: '0412 345 678',
        role: 'customer', address: '42 Banksia St, Paddington NSW 2021',
        joinedAt: dms(-90), lastActive: dms(0), avatar_initials: 'ST'
      },
      'marcus.webb@demo.crew': {
        id: 'demo-cust-002', email: 'marcus.webb@demo.crew',
        name: '[DEMO] Marcus Webb', phone: '0421 987 654',
        role: 'customer', address: '17 Wattle Ave, Newtown NSW 2042',
        joinedAt: dms(-65), lastActive: dms(-1), avatar_initials: 'MW'
      },
      'priya.patel@demo.crew': {
        id: 'demo-cust-003', email: 'priya.patel@demo.crew',
        name: '[DEMO] Priya Patel', phone: '0435 123 456',
        role: 'customer', address: '8 Jacaranda Rd, Mosman NSW 2088',
        joinedAt: dms(-30), lastActive: dms(-2), avatar_initials: 'PP'
      },
      'liam.obrien@demo.crew': {
        id: 'demo-cust-004', email: 'liam.obrien@demo.crew',
        name: "[DEMO] Liam O'Brien", phone: '0448 234 567',
        role: 'customer', address: '55 Eucalyptus Dr, Balmain NSW 2041',
        joinedAt: dms(-45), lastActive: dms(-5), avatar_initials: 'LO'
      }
    },

    // ── WORKERS ───────────────────────────────────────────────────────────
    workers: {
      'mike.rodriguez@demo.crew': {
        id: 'mike.rodriguez@demo.crew', email: 'mike.rodriguez@demo.crew',
        name: '[DEMO] Mike Rodriguez', role: 'crew_member',
        status: 'clocked_in', phone: '0421 111 222',
        badges: ['background_checked','cert_iii','public_liability','top_rated'],
        rating: 4.9, totalReviews: 47, completedJobs: 127, retentionScore: 91,
        specialisations: ['mowing','edging','irrigation','yard'],
        clockInTime: '07:45 AM', joinedAt: dms(-365), avatar_initials: 'MR'
      },
      'jessica.park@demo.crew': {
        id: 'jessica.park@demo.crew', email: 'jessica.park@demo.crew',
        name: '[DEMO] Jessica Park', role: 'crew_manager',
        status: 'available', phone: '0433 222 333',
        badges: ['background_checked','cert_iii','white_card','first_aid','top_rated'],
        rating: 4.8, totalReviews: 63, completedJobs: 203, retentionScore: 94,
        specialisations: ['garden_design','landscaping','fertilising','yard'],
        joinedAt: dms(-480), avatar_initials: 'JP'
      },
      'chris.brown@demo.crew': {
        id: 'chris.brown@demo.crew', email: 'chris.brown@demo.crew',
        name: '[DEMO] Chris Brown', role: 'crew_member',
        status: 'on_job', phone: '0422 333 444',
        badges: ['background_checked','cert_iii'],
        rating: 4.6, totalReviews: 18, completedJobs: 48, retentionScore: 82,
        specialisations: ['mowing','edging','weeding'],
        joinedAt: dms(-180), avatar_initials: 'CB'
      },
      'tom.walsh@demo.crew': {
        id: 'tom.walsh@demo.crew', email: 'tom.walsh@demo.crew',
        name: '[DEMO] Tom Walsh', role: 'field_worker',
        status: 'clocked_in', phone: '0444 333 444',
        badges: ['background_checked','white_card','chainsaw_licence'],
        rating: 4.7, totalReviews: 29, completedJobs: 89, retentionScore: 88,
        specialisations: ['tree_trimming','chainsaw','site_clearing'],
        clockInTime: '06:30 AM', joinedAt: dms(-270), avatar_initials: 'TW'
      },
      'emma.nguyen@demo.crew': {
        id: 'emma.nguyen@demo.crew', email: 'emma.nguyen@demo.crew',
        name: '[DEMO] Emma Nguyen', role: 'supervisor',
        status: 'available', phone: '0455 444 555',
        badges: ['background_checked','cert_iv','first_aid','white_card'],
        rating: 4.9, totalReviews: 52, completedJobs: 156, retentionScore: 96,
        specialisations: ['supervision','safety','compliance'],
        joinedAt: dms(-420), avatar_initials: 'EN'
      },
      'rachel.green@demo.crew': {
        id: 'rachel.green@demo.crew', email: 'rachel.green@demo.crew',
        name: '[DEMO] Rachel Green', role: 'crew_manager',
        status: 'available', phone: '0477 666 777',
        badges: ['background_checked','cert_iv','first_aid','public_liability'],
        rating: 4.8, totalReviews: 24, completedJobs: 74, retentionScore: 90,
        specialisations: ['team_management','scheduling','client_liaison'],
        enterprise: true, joinedAt: dms(-240), avatar_initials: 'RG'
      },
      'jordan.smith@demo.crew': {
        id: 'jordan.smith@demo.crew', email: 'jordan.smith@demo.crew',
        name: '[DEMO] Jordan Smith', role: 'crew_member',
        status: 'available', phone: '0488 777 888',
        badges: ['background_checked','cert_iii'],
        rating: 4.5, totalReviews: 11, completedJobs: 31, retentionScore: 79,
        specialisations: ['mowing','cleaning','garden_maintenance'],
        enterprise: true, joinedAt: dms(-90), avatar_initials: 'JS'
      },
      'alex.kumar@demo.crew': {
        id: 'alex.kumar@demo.crew', email: 'alex.kumar@demo.crew',
        name: '[DEMO] Alex Kumar', role: 'crewbase_admin',
        status: 'available', phone: '0466 555 666',
        badges: ['background_checked','cert_iv','white_card','first_aid'],
        rating: 5.0, totalReviews: 0, completedJobs: 0, retentionScore: 100,
        specialisations: ['admin','compliance','reporting'],
        joinedAt: dms(-500), avatar_initials: 'AK'
      }
    },

    // ── JOBS ─────────────────────────────────────────────────────────────
    jobs: {
      incoming: [
        {
          id: 'job_demo_001', bookingId: 'booking_demo_001',
          type: '[DEMO] Lawn Mow & Edge — 600m²',
          address: '42 Banksia St, Paddington NSW 2021',
          distance: '1.8km', datetime: '2026-05-05 10:00 AM',
          duration: 90, price: 85.00,
          customer: '[DEMO] Sarah Thompson', customerPhone: '0412 345 678',
          status: 'pending',
          suggestedWorker: 'mike.rodriguez@demo.crew',
          suggestedWorkerName: '[DEMO] Mike Rodriguez',
          createdAt: dms(-1)
        },
        {
          id: 'job_demo_002', bookingId: 'booking_demo_002',
          type: '[DEMO] Hedge Trimming & Garden Tidy',
          address: '17 Wattle Ave, Newtown NSW 2042',
          distance: '3.2km', datetime: '2026-05-05 2:00 PM',
          duration: 120, price: 145.00,
          customer: '[DEMO] Marcus Webb', customerPhone: '0421 987 654',
          status: 'pending',
          suggestedWorker: 'jessica.park@demo.crew',
          suggestedWorkerName: '[DEMO] Jessica Park',
          createdAt: dms(-1)
        },
        {
          id: 'job_demo_003', bookingId: 'booking_demo_003',
          type: '[DEMO] Backyard Mulching & Soil Prep',
          address: '8 Jacaranda Rd, Mosman NSW 2088',
          distance: '5.7km', datetime: '2026-05-06 9:00 AM',
          duration: 180, price: 195.00,
          customer: '[DEMO] Priya Patel', customerPhone: '0435 123 456',
          status: 'pending',
          suggestedWorker: 'chris.brown@demo.crew',
          suggestedWorkerName: '[DEMO] Chris Brown',
          createdAt: dms(0)
        }
      ],
      active: [
        {
          id: 'job_demo_004', bookingId: 'booking_demo_004',
          type: '[DEMO] Irrigation System Installation',
          address: '91 Grevillea Dr, Lane Cove NSW 2066',
          distance: '7.3km', datetime: '2026-05-04 7:30 AM',
          duration: 240, price: 320.00,
          customer: "[DEMO] Liam O'Brien", customerPhone: '0448 234 567',
          status: 'accepted',
          assignedTo: 'mike.rodriguez@demo.crew',
          assignedWorker: '[DEMO] Mike Rodriguez',
          acceptedAt: dms(0, 21), createdAt: dms(-2)
        },
        {
          id: 'job_demo_005', bookingId: 'booking_demo_005',
          type: '[DEMO] Backyard Landscaping — Stage 2',
          address: '3 Bottlebrush Ct, Manly NSW 2095',
          distance: '9.1km', datetime: '2026-05-04 8:00 AM',
          duration: 360, price: 580.00,
          customer: '[DEMO] Marcus Webb', customerPhone: '0421 987 654',
          status: 'accepted',
          assignedTo: 'chris.brown@demo.crew',
          assignedWorker: '[DEMO] Chris Brown',
          acceptedAt: dms(0, 22), createdAt: dms(-3)
        }
      ],
      completed: [
        { id: 'job_demo_006', bookingId: 'booking_demo_006', type: '[DEMO] Spring Garden Clean-Up', address: '42 Banksia St, Paddington NSW 2021', price: 95.00, customer: '[DEMO] Sarah Thompson', status: 'completed', assignedWorker: '[DEMO] Mike Rodriguez', assignedTo: 'mike.rodriguez@demo.crew', completedAt: dms(-7, 5), duration: 120, photos: { before: true, after: true } },
        { id: 'job_demo_007', bookingId: 'booking_demo_007', type: '[DEMO] Lawn Mow & Edge', address: '17 Wattle Ave, Newtown NSW 2042', price: 85.00, customer: '[DEMO] Marcus Webb', status: 'completed', assignedWorker: '[DEMO] Jessica Park', assignedTo: 'jessica.park@demo.crew', completedAt: dms(-10, 6), duration: 90, photos: { before: true, after: true } },
        { id: 'job_demo_008', bookingId: 'booking_demo_008', type: '[DEMO] Tree Pruning & Removal', address: '55 Eucalyptus Dr, Balmain NSW 2041', price: 450.00, customer: "[DEMO] Liam O'Brien", status: 'completed', assignedWorker: '[DEMO] Tom Walsh', assignedTo: 'tom.walsh@demo.crew', completedAt: dms(-14, 4), duration: 300, photos: { before: true, after: true } },
        { id: 'job_demo_009', bookingId: 'booking_demo_009', type: '[DEMO] Fertilising & Weed Treatment', address: '8 Jacaranda Rd, Mosman NSW 2088', price: 120.00, customer: '[DEMO] Priya Patel', status: 'completed', assignedWorker: '[DEMO] Chris Brown', assignedTo: 'chris.brown@demo.crew', completedAt: dms(-18, 6), duration: 90, photos: { before: true, after: true } },
        { id: 'job_demo_010', bookingId: 'booking_demo_010', type: '[DEMO] Full Garden Makeover — Stage 1', address: '3 Bottlebrush Ct, Manly NSW 2095', price: 750.00, customer: '[DEMO] Marcus Webb', status: 'completed', assignedWorker: '[DEMO] Jessica Park', assignedTo: 'jessica.park@demo.crew', completedAt: dms(-21, 6), duration: 480, photos: { before: true, after: true } },
        { id: 'job_demo_011', bookingId: 'booking_demo_011', type: '[DEMO] Lawn Mow & Aeration', address: '42 Banksia St, Paddington NSW 2021', price: 110.00, customer: '[DEMO] Sarah Thompson', status: 'completed', assignedWorker: '[DEMO] Mike Rodriguez', assignedTo: 'mike.rodriguez@demo.crew', completedAt: dms(-28, 5), duration: 120, photos: { before: true, after: true } },
        { id: 'job_demo_012', bookingId: 'booking_demo_012', type: '[DEMO] Irrigation Check & Repair', address: '91 Grevillea Dr, Lane Cove NSW 2066', price: 180.00, customer: "[DEMO] Liam O'Brien", status: 'completed', assignedWorker: '[DEMO] Mike Rodriguez', assignedTo: 'mike.rodriguez@demo.crew', completedAt: dms(-35, 5), duration: 150, photos: { before: true, after: true } },
        { id: 'job_demo_013', bookingId: 'booking_demo_013', type: '[DEMO] Hedge Shaping & Rubbish Removal', address: '17 Wattle Ave, Newtown NSW 2042', price: 165.00, customer: '[DEMO] Marcus Webb', status: 'completed', assignedWorker: '[DEMO] Jordan Smith', assignedTo: 'jordan.smith@demo.crew', completedAt: dms(-42, 5), duration: 180, photos: { before: true, after: true } }
      ],
      declined: []
    },

    // ── BOOKINGS ──────────────────────────────────────────────────────────
    bookings: [
      { id: 'booking_demo_001', customerId: 'sarah.thompson@demo.crew', customerName: '[DEMO] Sarah Thompson', service: '[DEMO] Lawn Mow & Edge — 600m²', address: '42 Banksia St, Paddington NSW 2021', scheduledDate: '2026-05-05', scheduledTime: '10:00 AM', price: 85.00, status: 'pending_assignment', escrowId: 'esc_demo_001', createdAt: dms(-1) },
      { id: 'booking_demo_002', customerId: 'marcus.webb@demo.crew', customerName: '[DEMO] Marcus Webb', service: '[DEMO] Hedge Trimming & Garden Tidy', address: '17 Wattle Ave, Newtown NSW 2042', scheduledDate: '2026-05-05', scheduledTime: '2:00 PM', price: 145.00, status: 'pending_assignment', escrowId: 'esc_demo_002', createdAt: dms(-1) },
      { id: 'booking_demo_003', customerId: 'priya.patel@demo.crew', customerName: '[DEMO] Priya Patel', service: '[DEMO] Backyard Mulching & Soil Prep', address: '8 Jacaranda Rd, Mosman NSW 2088', scheduledDate: '2026-05-06', scheduledTime: '9:00 AM', price: 195.00, status: 'pending_assignment', escrowId: 'esc_demo_003', createdAt: dms(0) },
      { id: 'booking_demo_004', customerId: 'liam.obrien@demo.crew', customerName: "[DEMO] Liam O'Brien", service: '[DEMO] Irrigation System Installation', address: '91 Grevillea Dr, Lane Cove NSW 2066', scheduledDate: '2026-05-04', scheduledTime: '7:30 AM', price: 320.00, status: 'assigned', assignedTo: '[DEMO] Mike Rodriguez', escrowId: 'esc_demo_004', createdAt: dms(-2) },
      { id: 'booking_demo_005', customerId: 'marcus.webb@demo.crew', customerName: '[DEMO] Marcus Webb', service: '[DEMO] Backyard Landscaping — Stage 2', address: '3 Bottlebrush Ct, Manly NSW 2095', scheduledDate: '2026-05-04', scheduledTime: '8:00 AM', price: 580.00, status: 'assigned', assignedTo: '[DEMO] Chris Brown', escrowId: 'esc_demo_005', createdAt: dms(-3) },
      { id: 'booking_demo_006', customerId: 'sarah.thompson@demo.crew', customerName: '[DEMO] Sarah Thompson', service: '[DEMO] Spring Garden Clean-Up', address: '42 Banksia St, Paddington NSW 2021', scheduledDate: '2026-04-27', scheduledTime: '9:00 AM', price: 95.00, status: 'completed', completedAt: dms(-7, 5), escrowId: 'esc_demo_006', createdAt: dms(-9) }
    ],

    // ── ESCROW ────────────────────────────────────────────────────────────
    escrowAccounts: {
      'esc_demo_001': { id: 'esc_demo_001', bookingId: 'booking_demo_001', amount: 85.00, customerId: 'sarah.thompson@demo.crew', status: 'held', createdAt: dms(-1), disputeWindow: 12, releasedAt: null },
      'esc_demo_002': { id: 'esc_demo_002', bookingId: 'booking_demo_002', amount: 145.00, customerId: 'marcus.webb@demo.crew', status: 'held', createdAt: dms(-1), disputeWindow: 12, releasedAt: null },
      'esc_demo_003': { id: 'esc_demo_003', bookingId: 'booking_demo_003', amount: 195.00, customerId: 'priya.patel@demo.crew', status: 'held', createdAt: dms(0), disputeWindow: 12, releasedAt: null },
      'esc_demo_004': { id: 'esc_demo_004', bookingId: 'booking_demo_004', amount: 320.00, customerId: 'liam.obrien@demo.crew', status: 'held', createdAt: dms(-2), disputeWindow: 12, releasedAt: null },
      'esc_demo_005': { id: 'esc_demo_005', bookingId: 'booking_demo_005', amount: 580.00, customerId: 'marcus.webb@demo.crew', status: 'held', createdAt: dms(-3), disputeWindow: 12, releasedAt: null },
      'esc_demo_006': { id: 'esc_demo_006', bookingId: 'booking_demo_006', amount: 95.00, customerId: 'sarah.thompson@demo.crew', status: 'released', createdAt: dms(-9), disputeWindow: 12, releasedAt: dms(-6) }
    },

    // ── TIME ENTRIES ──────────────────────────────────────────────────────
    timeEntries: [
      { workerId: 'mike.rodriguez@demo.crew', workerName: '[DEMO] Mike Rodriguez', action: 'clock_in',  timestamp: dms(0, 21),   location: '91 Grevillea Dr, Lane Cove NSW 2066' },
      { workerId: 'chris.brown@demo.crew',    workerName: '[DEMO] Chris Brown',    action: 'clock_in',  timestamp: dms(0, 22),   location: '3 Bottlebrush Ct, Manly NSW 2095' },
      { workerId: 'tom.walsh@demo.crew',      workerName: '[DEMO] Tom Walsh',      action: 'clock_in',  timestamp: dms(0, 20),   location: '[DEMO] Lane Cove Tree Site' },
      { workerId: 'jessica.park@demo.crew',   workerName: '[DEMO] Jessica Park',   action: 'clock_in',  timestamp: dms(-1, 22),  location: '17 Wattle Ave, Newtown NSW 2042' },
      { workerId: 'jessica.park@demo.crew',   workerName: '[DEMO] Jessica Park',   action: 'clock_out', timestamp: dms(-1,  7),  hoursWorked: '8h 12m' },
      { workerId: 'mike.rodriguez@demo.crew', workerName: '[DEMO] Mike Rodriguez', action: 'clock_out', timestamp: dms(-1,  6),  hoursWorked: '7h 45m' },
      { workerId: 'mike.rodriguez@demo.crew', workerName: '[DEMO] Mike Rodriguez', action: 'clock_in',  timestamp: dms(-1, 21),  location: '[DEMO] Spring Garden Clean-Up Site' },
      { workerId: 'jordan.smith@demo.crew',   workerName: '[DEMO] Jordan Smith',   action: 'clock_in',  timestamp: dms(-1, 22),  location: '17 Wattle Ave, Newtown NSW 2042' },
      { workerId: 'jordan.smith@demo.crew',   workerName: '[DEMO] Jordan Smith',   action: 'clock_out', timestamp: dms(-1,  6),  hoursWorked: '6h 30m' }
    ],

    // ── EQUIPMENT ─────────────────────────────────────────────────────────
    equipment: {
      'equip_demo_001': { id: 'equip_demo_001', type: '[DEMO] John Deere Ride-On Mower (X350)',       status: 'checked_out', checkedOutBy: '[DEMO] Mike Rodriguez', checkedOutAt: dms(0, 21), location: '91 Grevillea Dr, Lane Cove' },
      'equip_demo_002': { id: 'equip_demo_002', type: '[DEMO] Husqvarna Hedge Trimmer (115iHD55)',    status: 'available',   checkedOutBy: null, checkedOutAt: null, location: '[DEMO] Depot — Bay 3' },
      'equip_demo_003': { id: 'equip_demo_003', type: '[DEMO] Stihl Chainsaw (MS 251)',               status: 'checked_out', checkedOutBy: '[DEMO] Tom Walsh',      checkedOutAt: dms(0, 20), location: '[DEMO] Lane Cove Tree Site' },
      'equip_demo_004': { id: 'equip_demo_004', type: '[DEMO] ECHO Backpack Blower (PB-580T)',        status: 'checked_out', checkedOutBy: '[DEMO] Chris Brown',    checkedOutAt: dms(0, 22), location: '3 Bottlebrush Ct, Manly' },
      'equip_demo_005': { id: 'equip_demo_005', type: '[DEMO] Honda Walk-Behind Mower (HRX217)',      status: 'maintenance', checkedOutBy: null, checkedOutAt: null, location: '[DEMO] Workshop — Awaiting Service' },
      'equip_demo_006': { id: 'equip_demo_006', type: '[DEMO] Hunter Pro-C Irrigation Controller Kit', status: 'checked_out', checkedOutBy: '[DEMO] Mike Rodriguez', checkedOutAt: dms(0, 21), location: '91 Grevillea Dr, Lane Cove' }
    },

    // ── REFERRALS ─────────────────────────────────────────────────────────
    referrals: [
      { id: 'ref_demo_001', referredBy: '[DEMO] Mike Rodriguez', candidateName: '[DEMO] Ryan Mitchell',   candidatePhone: '0499 111 222', candidateEmail: 'ryan.mitchell@demo.crew',   role: 'crew_member',  status: 'applied',      submittedAt: dms(-5),  source: 'mobile_app' },
      { id: 'ref_demo_002', referredBy: '[DEMO] Jessica Park',   candidateName: '[DEMO] Aisha Okonkwo',   candidatePhone: '0499 333 444', candidateEmail: 'aisha.okonkwo@demo.crew',   role: 'crew_member',  status: 'interviewing', submittedAt: dms(-14), source: 'mobile_app' },
      { id: 'ref_demo_003', referredBy: '[DEMO] Tom Walsh',      candidateName: '[DEMO] Brendan Fogarty', candidatePhone: '0499 555 666', candidateEmail: 'brendan.fogarty@demo.crew', role: 'field_worker', status: 'offered',      submittedAt: dms(-28), source: 'mobile_app' }
    ],

    // ── REVIEWS ───────────────────────────────────────────────────────────
    reviews: [
      { id: 'rev_demo_001', bookingId: 'booking_demo_006', workerId: 'mike.rodriguez@demo.crew', type: 'customer_to_worker', reviewerName: '[DEMO] Sarah Thompson',   reviewerEmail: 'sarah.thompson@demo.crew', rating: 5, comment: '[DEMO] Mike was fantastic — arrived on time, did a thorough job and left the yard spotless. Will book again!', verified: true, createdAt: dms(-6) },
      { id: 'rev_demo_002', bookingId: 'booking_demo_007', workerId: 'jessica.park@demo.crew',   type: 'customer_to_worker', reviewerName: '[DEMO] Marcus Webb',       reviewerEmail: 'marcus.webb@demo.crew',    rating: 5, comment: '[DEMO] Jessica clearly knows her stuff. The hedges look perfect and she gave great advice on the garden design.', verified: true, createdAt: dms(-9) },
      { id: 'rev_demo_003', bookingId: 'booking_demo_008', workerId: 'tom.walsh@demo.crew',      type: 'customer_to_worker', reviewerName: "[DEMO] Liam O'Brien",      reviewerEmail: 'liam.obrien@demo.crew',    rating: 4, comment: '[DEMO] Great work on the trees — everything cleaned up perfectly. A little later than expected but quality was excellent.', verified: true, createdAt: dms(-13) },
      { id: 'rev_demo_004', bookingId: 'booking_demo_009', workerId: 'chris.brown@demo.crew',    type: 'customer_to_worker', reviewerName: '[DEMO] Priya Patel',       reviewerEmail: 'priya.patel@demo.crew',    rating: 4, comment: '[DEMO] Chris did a solid job with the weed treatment. Lawn is already looking healthier.', verified: true, createdAt: dms(-17) },
      { id: 'rev_demo_005', bookingId: 'booking_demo_006', customerId: 'sarah.thompson@demo.crew', type: 'worker_to_customer', reviewerName: '[DEMO] Mike Rodriguez', reviewerEmail: 'mike.rodriguez@demo.crew', rating: 5, comment: '[DEMO] Great customer — clear communication, easy access to property and always prepared.', verified: true, createdAt: dms(-6) }
    ],

    // ── RECURRING PLANS ───────────────────────────────────────────────────
    recurringPlans: [
      { id: 'plan_demo_001', customerId: 'sarah.thompson@demo.crew', customerName: '[DEMO] Sarah Thompson', service: '[DEMO] Fortnightly Lawn Mow & Edge',      address: '42 Banksia St, Paddington NSW 2021', frequency: 'fortnightly', preferredWorker: 'mike.rodriguez@demo.crew', price: 85.00,  discount: 0.10, status: 'active', nextJobDate: '2026-05-19', createdAt: dms(-60), totalJobsCompleted: 4,  autoRenew: true },
      { id: 'plan_demo_002', customerId: 'marcus.webb@demo.crew',    customerName: '[DEMO] Marcus Webb',    service: '[DEMO] Weekly Garden Maintenance',       address: '17 Wattle Ave, Newtown NSW 2042',    frequency: 'weekly',       preferredWorker: 'jessica.park@demo.crew', price: 145.00, discount: 0.15, status: 'active', nextJobDate: '2026-05-06', createdAt: dms(-90), totalJobsCompleted: 12, autoRenew: true },
      { id: 'plan_demo_003', customerId: 'priya.patel@demo.crew',    customerName: '[DEMO] Priya Patel',    service: '[DEMO] Monthly Full Garden Service',     address: '8 Jacaranda Rd, Mosman NSW 2088',    frequency: 'monthly',      preferredWorker: null,                     price: 280.00, discount: 0.05, status: 'active', nextJobDate: '2026-06-04', createdAt: dms(-30), totalJobsCompleted: 1,  autoRenew: true },
      { id: 'plan_demo_004', customerId: 'liam.obrien@demo.crew',    customerName: "[DEMO] Liam O'Brien",   service: '[DEMO] Fortnightly Lawn Mow & Edge',    address: '55 Eucalyptus Dr, Balmain NSW 2041',  frequency: 'fortnightly',  preferredWorker: null,                     price: 90.00,  discount: 0.10, status: 'active', nextJobDate: '2026-05-14', createdAt: dms(-45), totalJobsCompleted: 2,  autoRenew: true }
    ],

    // ── GROUP BOOKINGS ────────────────────────────────────────────────────
    groupBookings: [
      {
        id: 'grp_demo_001', organiserName: '[DEMO] Sarah Thompson',
        service: '[DEMO] Lawn Mow & Edge', date: '2026-05-12',
        members: [
          { name: '[DEMO] Sarah Thompson', address: '42 Banksia St, Paddington', status: 'confirmed' },
          { name: '[DEMO] Marcus Webb',    address: '17 Wattle Ave, Newtown',    status: 'confirmed' },
          { name: '[DEMO] Priya Patel',   address: '8 Jacaranda Rd, Mosman',    status: 'confirmed' }
        ],
        maxMembers: 6, minForDiscount: 2, discount: 0.10,
        status: 'discount_active', inviteCode: 'DEMO42', createdAt: dms(-3)
      }
    ],

    // ── DISPUTES ─────────────────────────────────────────────────────────
    disputes: [
      {
        id: 'disp_demo_001', bookingId: 'booking_demo_011',
        customerId: 'sarah.thompson@demo.crew',
        reason: '[DEMO] Lawn was missed in back corner near fence — photo evidence attached',
        evidence: '[DEMO] Photo submitted via app',
        status: 'resolved_customer', openedAt: dms(-27), windowHrs: 12,
        resolvedAt: dms(-26), refundAmount: 15.00
      }
    ],

    // ── LOYALTY POINTS ────────────────────────────────────────────────────
    loyaltyPoints: {
      'sarah.thompson@demo.crew': 450,
      'marcus.webb@demo.crew':    1240,
      'priya.patel@demo.crew':    80,
      'liam.obrien@demo.crew':    320
    },

    // ── CARBON LOG ────────────────────────────────────────────────────────
    carbonLog: [
      { jobId: 'job_demo_006', distanceKm: 3,  durationHrs: 1.5, emitted: 0.6, offset: 0.5, net: 0.1, loggedAt: dms(-7) },
      { jobId: 'job_demo_007', distanceKm: 5,  durationHrs: 1.5, emitted: 1.1, offset: 0.5, net: 0.6, loggedAt: dms(-10) },
      { jobId: 'job_demo_008', distanceKm: 8,  durationHrs: 5.0, emitted: 1.7, offset: 0.5, net: 1.2, loggedAt: dms(-14) },
      { jobId: 'job_demo_009', distanceKm: 6,  durationHrs: 1.5, emitted: 1.3, offset: 0.5, net: 0.8, loggedAt: dms(-18) },
      { jobId: 'job_demo_010', distanceKm: 10, durationHrs: 8.0, emitted: 2.1, offset: 0.5, net: 1.6, loggedAt: dms(-21) }
    ],

    // ── PHOTO PROOFS ──────────────────────────────────────────────────────
    photoProofs: {
      'job_demo_006': { jobId: 'job_demo_006', workerId: 'mike.rodriguez@demo.crew', workerName: '[DEMO] Mike Rodriguez', before: 2, after: 3, uploadedAt: dms(-7) },
      'job_demo_007': { jobId: 'job_demo_007', workerId: 'jessica.park@demo.crew',  workerName: '[DEMO] Jessica Park',   before: 3, after: 4, uploadedAt: dms(-10) },
      'job_demo_008': { jobId: 'job_demo_008', workerId: 'tom.walsh@demo.crew',     workerName: '[DEMO] Tom Walsh',      before: 4, after: 5, uploadedAt: dms(-14) },
      'job_demo_009': { jobId: 'job_demo_009', workerId: 'chris.brown@demo.crew',   workerName: '[DEMO] Chris Brown',    before: 2, after: 2, uploadedAt: dms(-18) },
      'job_demo_010': { jobId: 'job_demo_010', workerId: 'jessica.park@demo.crew',  workerName: '[DEMO] Jessica Park',   before: 5, after: 6, uploadedAt: dms(-21) }
    },

    // ── CUSTOMER WORK REQUESTS ────────────────────────────────────────────
    customerWorkRequests: [
      {
        id: 'req-demo-001', customerName: '[DEMO] Priya Patel',
        customerNumber: 'CUST-3847', customerPhone: '0435 123 456',
        service: '[DEMO] Retaining Wall & Terracing',
        address: '8 Jacaranda Rd, Mosman NSW 2088',
        message: "[DEMO] Looking for a quote on a small retaining wall at the back of the garden — about 6m long, 1.2m high. Happy to discuss materials.",
        time: '2 hours ago', status: 'pending', submittedAt: dms(0, 21)
      },
      {
        id: 'req-demo-002', customerName: "[DEMO] Liam O'Brien",
        customerNumber: 'CUST-2194', customerPhone: '0448 234 567',
        service: '[DEMO] Lawn Renovation — Full Reseed',
        address: '55 Eucalyptus Dr, Balmain NSW 2041',
        message: "[DEMO] Front lawn is patchy after a rough summer. Keen to get it fully reseeded and top-dressed. What's the timing like for this time of year?",
        time: 'Yesterday', status: 'quoted', submittedAt: dms(-1, 4)
      }
    ],

    // ── CC → CUSTOMER MESSAGES ────────────────────────────────────────────
    customerMessages: [
      {
        reqId: 'req-demo-002', from: '[DEMO] Command Centre',
        type: 'quote_sent',
        text: "[DEMO] TQ-DEMO-2847 — Quote for Lawn Renovation has been sent to your app. $320 inc. GST.",
        timestamp: dms(-1, 6)
      }
    ],

    // ── PENDING QUOTES ────────────────────────────────────────────────────
    pendingQuotes: [
      {
        id: 'TQ-DEMO-2847', reqId: 'req-demo-002',
        status: 'pending_approval',
        customerName: "[DEMO] Liam O'Brien",
        address: '55 Eucalyptus Dr, Balmain NSW 2041',
        date: '2026-05-10', time: '9:00 AM', total: 320.00,
        lineItems: [
          { desc: '[DEMO] Full Lawn Reseed (140m²)',     qty: 1, rate: 220.00 },
          { desc: '[DEMO] Top Dressing (1.5 tonnes)',    qty: 1, rate: 100.00 }
        ],
        notes: '[DEMO] Best done in Autumn/Winter for strong root development. Materials included.',
        createdAt: dms(-1, 5)
      }
    ],

    // ── ACTIVITIES (most recent first) ────────────────────────────────────
    activities: [
      { id: 'act_d_001', type: 'clock_in',       icon: '⏰', title: '[DEMO] Mike Rodriguez clocked in',           description: '91 Grevillea Dr, Lane Cove · Via Mobile App',                                                    timestamp: dms(0, 21),  timeAgo: '2 hours ago'  },
      { id: 'act_d_002', type: 'clock_in',       icon: '⏰', title: '[DEMO] Chris Brown clocked in',             description: '3 Bottlebrush Ct, Manly · Via Mobile App',                                                       timestamp: dms(0, 22),  timeAgo: '1 hour ago'   },
      { id: 'act_d_003', type: 'clock_in',       icon: '⏰', title: '[DEMO] Tom Walsh clocked in',               description: '[DEMO] Lane Cove Tree Site · Via Mobile App',                                                    timestamp: dms(0, 20),  timeAgo: '3 hours ago'  },
      { id: 'act_d_004', type: 'work_request',   icon: '💬', title: '[DEMO] Priya Patel sent a work request',    description: '[DEMO] Retaining Wall & Terracing · Mosman',                                                     timestamp: dms(0, 21),  timeAgo: '2 hours ago'  },
      { id: 'act_d_005', type: 'booking_created',icon: '📅', title: '[DEMO] New customer booking',               description: '[DEMO] Backyard Mulching — Priya Patel · 2026-05-06 · AI match: Chris Brown',                   timestamp: dms(0, 22),  timeAgo: '1 hour ago'   },
      { id: 'act_d_006', type: 'booking_created',icon: '📅', title: '[DEMO] New customer booking',               description: '[DEMO] Lawn Mow & Edge — Sarah Thompson · 2026-05-05 · AI match: Mike Rodriguez',               timestamp: dms(-1, 8),  timeAgo: 'Yesterday'    },
      { id: 'act_d_007', type: 'booking_created',icon: '📅', title: '[DEMO] New customer booking',               description: '[DEMO] Hedge Trimming — Marcus Webb · 2026-05-05 · AI match: Jessica Park',                     timestamp: dms(-1, 7),  timeAgo: 'Yesterday'    },
      { id: 'act_d_008', type: 'escrow_created', icon: '🔒', title: '[DEMO] Payment held in escrow',             description: '$85.00 held pending job completion · Booking booking_demo_001',                                  timestamp: dms(-1, 8),  timeAgo: 'Yesterday'    },
      { id: 'act_d_009', type: 'quote_sent',     icon: '📋', title: '[DEMO] Quote TQ-DEMO-2847 sent',            description: "[DEMO] Lawn Renovation — Liam O'Brien — $320.00 inc. GST",                                       timestamp: dms(-1, 5),  timeAgo: 'Yesterday'    },
      { id: 'act_d_010', type: 'ai_match',       icon: '🤖', title: '[DEMO] AI matched JOB to Mike Rodriguez',  description: '[DEMO] Lawn Mow & Edge 600m² · Score: 87 · 4.9★ · 127 jobs',                                     timestamp: dms(-1, 8),  timeAgo: 'Yesterday'    },
      { id: 'act_d_011', type: 'job_completed',  icon: '✅', title: '[DEMO] Mike Rodriguez completed job',       description: '[DEMO] Spring Garden Clean-Up · Paddington · Photos uploaded · 12hr dispute window open',         timestamp: dms(-7, 5),  timeAgo: '7 days ago'   },
      { id: 'act_d_012', type: 'review_submitted',icon:'⭐', title: '[DEMO] Sarah Thompson left a 5★ review',   description: 'Mike was fantastic — arrived on time, did a thorough job and left the yard spotless.',             timestamp: dms(-6),     timeAgo: '6 days ago'   },
      { id: 'act_d_013', type: 'payment_released',icon:'💰', title: '[DEMO] Payment released to Mike Rodriguez', description: '$95.00 · +95 CrewPoints earned',                                                                 timestamp: dms(-6),     timeAgo: '6 days ago'   },
      { id: 'act_d_014', type: 'job_completed',  icon: '✅', title: '[DEMO] Jessica Park completed job',         description: '[DEMO] Lawn Mow & Edge · Newtown · Photos uploaded',                                             timestamp: dms(-10, 6), timeAgo: '10 days ago'  },
      { id: 'act_d_015', type: 'review_submitted',icon:'⭐', title: '[DEMO] Marcus Webb left a 5★ review',      description: "Jessica clearly knows her stuff. The hedges look perfect and gave great advice on garden design.", timestamp: dms(-9),     timeAgo: '9 days ago'   },
      { id: 'act_d_016', type: 'job_completed',  icon: '✅', title: '[DEMO] Tom Walsh completed job',            description: '[DEMO] Tree Pruning & Removal · Balmain · Photos uploaded',                                      timestamp: dms(-14, 4), timeAgo: '14 days ago'  },
      { id: 'act_d_017', type: 'referral_submitted',icon:'👥',title:'[DEMO] Mike Rodriguez submitted referral', description: 'Candidate: [DEMO] Ryan Mitchell',                                                                timestamp: dms(-5, 0),  timeAgo: '5 days ago'   },
      { id: 'act_d_018', type: 'group_booking',  icon: '🏘️', title: '[DEMO] Sarah Thompson started group booking',description: '[DEMO] Lawn Mow & Edge · 2026-05-12 · Code: DEMO42',                                          timestamp: dms(-3),     timeAgo: '3 days ago'   },
      { id: 'act_d_019', type: 'recurring_created',icon:'🔄',title:"[DEMO] Marcus Webb set up weekly service",  description: '[DEMO] Weekly Garden Maintenance · 15% discount · Same crew every time',                         timestamp: dms(-90),    timeAgo: '3 months ago' },
      { id: 'act_d_020', type: 'badge_awarded',  icon: '🏅', title: '[DEMO] Badge awarded: Top Rated',          description: 'Worker: [DEMO] Jessica Park',                                                                    timestamp: dms(-30),    timeAgo: '1 month ago'  },
      { id: 'act_d_021', type: 'carbon_log',     icon: '🌱', title: '[DEMO] Carbon logged for job',             description: '0.6kg emitted · 0.5kg offset · Net: 0.1kg',                                                     timestamp: dms(-7),     timeAgo: '7 days ago'   },
      { id: 'act_d_022', type: 'dispute_resolved',icon:'✅', title: '[DEMO] Dispute resolved: resolved_customer',description: 'Refund: $15.00 · Booking booking_demo_011',                                                     timestamp: dms(-26),    timeAgo: '26 days ago'  },
      { id: 'act_d_023', type: 'equipment_checkout',icon:'🛠️',title:'[DEMO] Mike Rodriguez checked out equipment',description:'[DEMO] John Deere Ride-On Mower · 91 Grevillea Dr, Lane Cove',                                 timestamp: dms(0, 21),  timeAgo: '2 hours ago'  },
      { id: 'act_d_024', type: 'equipment_checkout',icon:'🛠️',title:'[DEMO] Tom Walsh checked out equipment',   description:'[DEMO] Stihl Chainsaw (MS 251) · Lane Cove Tree Site',                                           timestamp: dms(0, 20),  timeAgo: '3 hours ago'  }
    ],

    // ── MESSAGING ─────────────────────────────────────────────────────────
    messaging: {
      channels: {
        'general': {
          id: 'general', name: 'General', icon: '💬', type: 'public', members: [],
          messages: [
            { id: 'msg_g_001', channelId: 'general', text: '[DEMO] Morning team! Quick heads-up — traffic is heavy on the M1 near Lane Cove. Budget an extra 20 mins if heading that way.', senderId: 'jessica.park@demo.crew', senderName: '[DEMO] Jessica Park', senderRole: 'crew_manager', timestamp: dms(0, 21), attachments: [], mentions: [], reactions: {} },
            { id: 'msg_g_002', channelId: 'general', text: '[DEMO] Thanks Jess! Already on site, made it through fine. Starting irrigation install now. 🛠️', senderId: 'mike.rodriguez@demo.crew', senderName: '[DEMO] Mike Rodriguez', senderRole: 'crew_member', timestamp: dms(0, 22), attachments: [], mentions: [], reactions: {} },
            { id: 'msg_g_003', channelId: 'general', text: "[DEMO] Anyone free Saturday morning? Got a quote request in Balmain that's too big for one person.", senderId: 'jessica.park@demo.crew', senderName: '[DEMO] Jessica Park', senderRole: 'crew_manager', timestamp: dms(-1, 4), attachments: [], mentions: [], reactions: {} },
            { id: 'msg_g_004', channelId: 'general', text: '[DEMO] I can do Saturday — what time?', senderId: 'chris.brown@demo.crew', senderName: '[DEMO] Chris Brown', senderRole: 'crew_member', timestamp: dms(-1, 4), attachments: [], mentions: [], reactions: {} },
            { id: 'msg_g_005', channelId: 'general', text: "[DEMO] 8am start. I'll put it through the scheduler. Cheers Chris! 👍", senderId: 'jessica.park@demo.crew', senderName: '[DEMO] Jessica Park', senderRole: 'crew_manager', timestamp: dms(-1, 5), attachments: [], mentions: [], reactions: {} },
            { id: 'msg_g_006', channelId: 'general', text: '[DEMO] Reminder: All timesheets for last fortnight need to be submitted by COB Friday. Payroll cut-off is strict this cycle.', senderId: 'rachel.green@demo.crew', senderName: '[DEMO] Rachel Green', senderRole: 'crew_manager', timestamp: dms(-2, 23), attachments: [], mentions: [], reactions: {} }
          ],
          createdAt: dms(-180)
        },
        'urgent': {
          id: 'urgent', name: 'Urgent', icon: '🚨', type: 'public', members: [],
          messages: [
            { id: 'msg_u_001', channelId: 'urgent', text: '[DEMO] ⚠️ Mower breakdown at Manly site — John Deere has a flat. Need a replacement or swap ASAP. Job is 2 hours in.', senderId: 'chris.brown@demo.crew', senderName: '[DEMO] Chris Brown', senderRole: 'crew_member', timestamp: dms(-3, 0), attachments: [], mentions: [], reactions: {} },
            { id: 'msg_u_002', channelId: 'urgent', text: '[DEMO] On it — spare mower is in the van, heading to you now. ETA 25 mins.', senderId: 'jessica.park@demo.crew', senderName: '[DEMO] Jessica Park', senderRole: 'crew_manager', timestamp: dms(-3, 0), attachments: [], mentions: [], reactions: {} },
            { id: 'msg_u_003', channelId: 'urgent', text: '[DEMO] Resolved ✅ — Replacement on site, job complete. Flat tyre sent for repair.', senderId: 'jessica.park@demo.crew', senderName: '[DEMO] Jessica Park', senderRole: 'crew_manager', timestamp: dms(-3, 3), attachments: [], mentions: [], reactions: {} }
          ],
          createdAt: dms(-180)
        },
        'equipment': {
          id: 'equipment', name: 'Equipment', icon: '🛠️', type: 'public', members: [],
          messages: [
            { id: 'msg_e_001', channelId: 'equipment', text: '[DEMO] Honda HRX217 is in the workshop — blades need replacing and air filter is blocked. Back in service Thursday.', senderId: 'emma.nguyen@demo.crew', senderName: '[DEMO] Emma Nguyen', senderRole: 'supervisor', timestamp: dms(-2, 22), attachments: [], mentions: [], reactions: {} },
            { id: 'msg_e_002', channelId: 'equipment', text: "[DEMO] Noted. I'll work around it with the Deere this week. Thanks for the heads up Emma.", senderId: 'mike.rodriguez@demo.crew', senderName: '[DEMO] Mike Rodriguez', senderRole: 'crew_member', timestamp: dms(-2, 22), attachments: [], mentions: [], reactions: {} },
            { id: 'msg_e_003', channelId: 'equipment', text: "[DEMO] Chainsaw (MS 251) is fuelled up and in Bay 2. Tom, it's ready for your 6:30 start.", senderId: 'alex.kumar@demo.crew', senderName: '[DEMO] Alex Kumar', senderRole: 'crewbase_admin', timestamp: dms(-1, 7), attachments: [], mentions: [], reactions: {} },
            { id: 'msg_e_004', channelId: 'equipment', text: '[DEMO] Perfect — grabbed it this morning. All good. 🪚', senderId: 'tom.walsh@demo.crew', senderName: '[DEMO] Tom Walsh', senderRole: 'field_worker', timestamp: dms(0, 20), attachments: [], mentions: [], reactions: {} }
          ],
          createdAt: dms(-180)
        },
        'safety': {
          id: 'safety', name: 'Safety', icon: '⛑️', type: 'public', members: [],
          messages: [
            { id: 'msg_s_001', channelId: 'safety', text: '[DEMO] Reminder to all crew: Heat index is high this week. Mandatory hydration breaks every 45 mins. No exceptions.', senderId: 'emma.nguyen@demo.crew', senderName: '[DEMO] Emma Nguyen', senderRole: 'supervisor', timestamp: dms(-4, 21), attachments: [], mentions: [], reactions: {} },
            { id: 'msg_s_002', channelId: 'safety', text: '[DEMO] Near-miss incident at Lane Cove site — slippery path after morning dew. Cones placed, reported via app. All good now.', senderId: 'tom.walsh@demo.crew', senderName: '[DEMO] Tom Walsh', senderRole: 'field_worker', timestamp: dms(-2, 22), attachments: [], mentions: [], reactions: {} },
            { id: 'msg_s_003', channelId: 'safety', text: "[DEMO] Thanks Tom — logged. Make sure the SWMS is updated before next visit. I'll review it this afternoon.", senderId: 'emma.nguyen@demo.crew', senderName: '[DEMO] Emma Nguyen', senderRole: 'supervisor', timestamp: dms(-2, 23), attachments: [], mentions: [], reactions: {} }
          ],
          createdAt: dms(-180)
        },
        'enterprise-ops': {
          id: 'enterprise-ops', name: 'Enterprise Ops', icon: '🏢', type: 'public', members: [],
          messages: [
            { id: 'msg_eo_001', channelId: 'enterprise-ops', text: "[DEMO] Team — Q2 KPI targets are uploaded in the scheduler. Rachel, can you review Jordan's onboarding checklist before end of week?", senderId: 'rachel.green@demo.crew', senderName: '[DEMO] Rachel Green', senderRole: 'crew_manager', timestamp: dms(-5, 23), attachments: [], mentions: [], reactions: {} },
            { id: 'msg_eo_002', channelId: 'enterprise-ops', text: "[DEMO] On it! I'll have it done by Wednesday. Also — my Cert III renewal is booked for the 15th.", senderId: 'jordan.smith@demo.crew', senderName: '[DEMO] Jordan Smith', senderRole: 'crew_member', timestamp: dms(-5, 23), attachments: [], mentions: [], reactions: {} },
            { id: 'msg_eo_003', channelId: 'enterprise-ops', text: '[DEMO] Great work this month everyone. 3 five-star reviews, zero incidents, 98% on-time rate. Keep it up! 🏆', senderId: 'rachel.green@demo.crew', senderName: '[DEMO] Rachel Green', senderRole: 'crew_manager', timestamp: dms(-3), attachments: [], mentions: [], reactions: {} }
          ],
          createdAt: dms(-180)
        }
      },
      directMessages: {},
      conversations: {
        'jessica.park@demo.crew_mike.rodriguez@demo.crew': {
          id: 'jessica.park@demo.crew_mike.rodriguez@demo.crew',
          participants: ['jessica.park@demo.crew', 'mike.rodriguez@demo.crew'],
          messages: [
            { id: 'dm_001', conversationId: 'jessica.park@demo.crew_mike.rodriguez@demo.crew', text: "[DEMO] Mike — can you swing by the Mosman job after Lane Cove? They've asked about a quote for the back garden.", senderId: 'jessica.park@demo.crew', senderName: '[DEMO] Jessica Park', recipientId: 'mike.rodriguez@demo.crew', timestamp: dms(0, 23), attachments: [], read: false },
            { id: 'dm_002', conversationId: 'jessica.park@demo.crew_mike.rodriguez@demo.crew', text: "[DEMO] Yeah no worries — should be done here by midday. I'll head over around 1pm. Want me to take photos for the quote?", senderId: 'mike.rodriguez@demo.crew', senderName: '[DEMO] Mike Rodriguez', recipientId: 'jessica.park@demo.crew', timestamp: dms(0, 23), attachments: [], read: true },
            { id: 'dm_003', conversationId: 'jessica.park@demo.crew_mike.rodriguez@demo.crew', text: "[DEMO] Yes please! Front and back, and measure the retaining wall area if you can. Priya mentioned 6m long, 1.2m high.", senderId: 'jessica.park@demo.crew', senderName: '[DEMO] Jessica Park', recipientId: 'mike.rodriguez@demo.crew', timestamp: dms(0, 23), attachments: [], read: false }
          ],
          createdAt: dms(0)
        },
        'emma.nguyen@demo.crew_tom.walsh@demo.crew': {
          id: 'emma.nguyen@demo.crew_tom.walsh@demo.crew',
          participants: ['emma.nguyen@demo.crew', 'tom.walsh@demo.crew'],
          messages: [
            { id: 'dm_004', conversationId: 'emma.nguyen@demo.crew_tom.walsh@demo.crew', text: '[DEMO] Tom, your PTW for the Lane Cove chainsaw work is approved. Valid until 4pm today. Have a safe one.', senderId: 'emma.nguyen@demo.crew', senderName: '[DEMO] Emma Nguyen', recipientId: 'tom.walsh@demo.crew', timestamp: dms(0, 20), attachments: [], read: true },
            { id: 'dm_005', conversationId: 'emma.nguyen@demo.crew_tom.walsh@demo.crew', text: '[DEMO] Cheers Emma. SWMS completed and signed. Starting now. 🪚', senderId: 'tom.walsh@demo.crew', senderName: '[DEMO] Tom Walsh', recipientId: 'emma.nguyen@demo.crew', timestamp: dms(0, 20), attachments: [], read: true }
          ],
          createdAt: dms(0)
        },
        'david.chen@demo.crew_jessica.park@demo.crew': {
          id: 'david.chen@demo.crew_jessica.park@demo.crew',
          participants: ['david.chen@demo.crew', 'jessica.park@demo.crew'],
          messages: [
            { id: 'dm_006', conversationId: 'david.chen@demo.crew_jessica.park@demo.crew', text: "[DEMO] Jess — Marcus Webb's Stage 2 landscaping is shaping up to be a big upsell opportunity. Can you put together a Stage 3 proposal after today's job?", senderId: 'david.chen@demo.crew', senderName: '[DEMO] David Chen', recipientId: 'jessica.park@demo.crew', timestamp: dms(-1, 4), attachments: [], read: true },
            { id: 'dm_007', conversationId: 'david.chen@demo.crew_jessica.park@demo.crew', text: "[DEMO] Absolutely! I'll scope it out and have a proposal to you by EOD Thursday. The garden has a lot of potential.", senderId: 'jessica.park@demo.crew', senderName: '[DEMO] Jessica Park', recipientId: 'david.chen@demo.crew', timestamp: dms(-1, 5), attachments: [], read: true }
          ],
          createdAt: dms(-1)
        },
        'rachel.green@demo.crew_jordan.smith@demo.crew': {
          id: 'rachel.green@demo.crew_jordan.smith@demo.crew',
          participants: ['rachel.green@demo.crew', 'jordan.smith@demo.crew'],
          messages: [
            { id: 'dm_008', conversationId: 'rachel.green@demo.crew_jordan.smith@demo.crew', text: "[DEMO] Jordan — your 3-month performance review is scheduled for Friday at 2pm. Really positive feedback from clients so far.", senderId: 'rachel.green@demo.crew', senderName: '[DEMO] Rachel Green', recipientId: 'jordan.smith@demo.crew', timestamp: dms(-2, 4), attachments: [], read: true },
            { id: 'dm_009', conversationId: 'rachel.green@demo.crew_jordan.smith@demo.crew', text: "[DEMO] Thanks Rachel! Looking forward to it. I've been keeping notes on areas I want to improve.", senderId: 'jordan.smith@demo.crew', senderName: '[DEMO] Jordan Smith', recipientId: 'rachel.green@demo.crew', timestamp: dms(-2, 5), attachments: [], read: true }
          ],
          createdAt: dms(-2)
        }
      },
      unreadCounts: {
        'mike.rodriguez@demo.crew': { 'general': 1, 'safety': 1 },
        'tom.walsh@demo.crew':      { 'general': 2, 'equipment': 1 },
        'chris.brown@demo.crew':    { 'general': 1, 'safety': 2 },
        'jessica.park@demo.crew':   { 'safety': 1 },
        'david.chen@demo.crew':     { 'urgent': 1 },
        'jordan.smith@demo.crew':   { 'enterprise-ops': 1 }
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // INSTALL
  // ═══════════════════════════════════════════════════════════════════════════
  function install() {
    localStorage.setItem('crewSharedData', JSON.stringify(SHARED));
    localStorage.setItem('crewDataUpdate', Date.now().toString());
    localStorage.setItem('crewDemoProfiles', JSON.stringify(PROFILES));

    localStorage.setItem('crewDemoInstalled', VERSION);
    console.log('%c✅ [DEMO] Crew Demo Data ' + VERSION + ' installed — 9 profiles · 11 jobs · 5 channels · 4 conversations', 'color:#2D6A4F;font-weight:bold;font-size:13px');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH BYPASS  —  demo profiles skip Supabase session check
  // ═══════════════════════════════════════════════════════════════════════════
  function patchAuth() {
    function tryPatch() {
      if (typeof window.crewAuth === 'undefined' || typeof window.crewAuth.require !== 'function') return false;
      if (window.crewAuth._demoPatchApplied) return true;

      var _orig = window.crewAuth.require;
      window.crewAuth.require = function (allowedRoles) {
        var profile = null;
        try { profile = JSON.parse(localStorage.getItem('crewUserProfile') || 'null'); } catch (e) {}
        if (!profile || !profile._demo) return _orig.apply(this, arguments);

        // admin role bypasses everything; others must match
        var roles = allowedRoles || [];
        var ok = !roles.length ||
          profile.role === 'admin' ||
          roles.some(function (r) { return r === profile.role; });

        if (ok) {
          // Minimal UI injection so app renders correctly
          var badge = document.getElementById('user-badge-name') || document.getElementById('user-name') || document.getElementById('userName');
          if (badge) badge.textContent = profile.name;
          return Promise.resolve(profile);
        }
        return Promise.reject(new Error('[DEMO] Role mismatch — use CrewDemo.switchRole()'));
      };

      window.crewAuth._demoPatchApplied = true;
      window.CrewAuth = window.crewAuth; // keep PascalCase alias in sync
      return true;
    }

    if (!tryPatch()) {
      var attempts = 0;
      var iv = setInterval(function () {
        if (tryPatch() || ++attempts > 120) clearInterval(iv);
      }, 50);
    }
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API  —  window.CrewDemo
  // ═══════════════════════════════════════════════════════════════════════════
  window.CrewDemo = {
    version: VERSION,
    profiles: PROFILES,

    install: install,

    reset: function () {
      localStorage.removeItem('crewDemoInstalled');
      localStorage.removeItem('crewUserProfile');
      install();
      patchAuth();
      window.dispatchEvent(new CustomEvent('crewDataUpdated', { detail: SHARED }));
      console.log('[DEMO] Data reset to factory state');
    },

    // Switch active role — refreshes the page with the new profile
    switchRole: function (role) {
      var p = PROFILES[role];
      if (!p) { console.warn('[DEMO] Unknown role:', role, '— options:', Object.keys(PROFILES).join(', ')); return; }
      localStorage.setItem('crewUserProfile', JSON.stringify(p));
      location.reload();
    },

  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN
  // ═══════════════════════════════════════════════════════════════════════════
  if (localStorage.getItem('crewDemoInstalled') !== VERSION) install();

  // Clear any stale demo-auto-login so real users reach auth.html instead.
  (function () {
    try {
      var p = JSON.parse(localStorage.getItem('crewUserProfile') || 'null');
      if (p && p._demo && !localStorage.getItem('crewDemoActive')) {
        localStorage.removeItem('crewUserProfile');
      }
    } catch (e) {}
  }());

  patchAuth();

}());
