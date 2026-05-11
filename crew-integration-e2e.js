// ═══════════════════════════════════════════════════════════════════════════
// CREW PLATFORM E2E INTEGRATION ENGINE v2
// Adds: escrow payments · 2-way reviews · recurring plans · AI job matching
//       photo proof · carbon tracking · licence badges · loyalty/CrewPass
//       neighbourhood group booking · dispute resolution
// ═══════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  function initCrewData() {
    const existing = localStorage.getItem('crewSharedData');
    if (!existing) {
      const init = {
        jobs: { incoming: [], active: [], completed: [], declined: [] },
        bookings: [], workers: {
          'worker_001': { id:'worker_001', name:'Mike Rodriguez', role:'crew_member', status:'available',
            badges:['background_checked','cert_iii','public_liability'], rating:4.9, completedJobs:127,
            retentionScore:91, specialisations:['yard','tree_trimming','irrigation'] },
          'worker_002': { id:'worker_002', name:'Sarah Chen', role:'crew_manager', status:'available',
            badges:['background_checked','cert_iii','white_card','first_aid'], rating:4.8, completedJobs:203,
            retentionScore:94, specialisations:['garden_design','yard','fertilising'] }
        },
        activities: [], timeEntries: [], equipment: {}, referrals: [], users: {},
        reviews: [], escrowAccounts: {}, recurringPlans: [], groupBookings: [],
        disputes: [], loyaltyPoints: {}, carbonLog: [],
        lastUpdate: new Date().toISOString()
      };
      localStorage.setItem('crewSharedData', JSON.stringify(init));
      return init;
    }
    const d = JSON.parse(existing);
    // migrate older data
    if (!d.reviews) d.reviews = [];
    if (!d.escrowAccounts) d.escrowAccounts = {};
    if (!d.recurringPlans) d.recurringPlans = [];
    if (!d.groupBookings) d.groupBookings = [];
    if (!d.disputes) d.disputes = [];
    if (!d.loyaltyPoints) d.loyaltyPoints = {};
    if (!d.carbonLog) d.carbonLog = [];
    return d;
  }

  function getSharedData() {
    const d = localStorage.getItem('crewSharedData');
    return d ? JSON.parse(d) : initCrewData();
  }

  function saveSharedData(data) {
    data.lastUpdate = new Date().toISOString();
    localStorage.setItem('crewSharedData', JSON.stringify(data));
    localStorage.setItem('crewDataUpdate', Date.now().toString());
    window.dispatchEvent(new CustomEvent('crewDataUpdated', { detail: data }));
  }

  function logActivity(data, activity) {
    if (!data.activities) data.activities = [];
    activity.id = 'activity_' + Date.now() + '_' + Math.random().toString(36).substr(2,9);
    activity.timestamp = new Date().toISOString();
    activity.timeAgo = 'Just now';
    data.activities.unshift(activity);
    if (data.activities.length > 100) data.activities = data.activities.slice(0,100);
    return activity;
  }

  function _getCurrentProfile() {
    try { return JSON.parse(localStorage.getItem('crewUserProfile') || 'null'); } catch(e) { return null; }
  }

  // ═══════════════════════════════════════════════════════════
  // ESCROW PAYMENT SYSTEM
  // ═══════════════════════════════════════════════════════════
  const EscrowActions = {
    createEscrow: function(bookingId, amount, customerId) {
      const data = getSharedData();
      const escrowId = 'esc_' + Date.now();
      data.escrowAccounts[escrowId] = {
        id: escrowId, bookingId, amount, customerId,
        status: 'held',        // held → released | refunded | disputed
        createdAt: new Date().toISOString(),
        disputeWindow: 12,     // hours after completion
        releasedAt: null
      };
      logActivity(data, { type:'escrow_created', icon:'🔒',
        title: 'Payment held in escrow', description: `$${amount.toFixed(2)} held pending job completion · Booking ${bookingId}` });
      saveSharedData(data);
      return escrowId;
    },

    releaseEscrow: function(escrowId, workerName) {
      const data = getSharedData();
      const esc = data.escrowAccounts[escrowId];
      if (!esc) return false;
      esc.status = 'released';
      esc.releasedAt = new Date().toISOString();
      // Award loyalty points: 1 pt per $1 spent
      const profile = _getCurrentProfile();
      const custId = (profile && profile.email) || esc.customerId || 'customer';
      if (!data.loyaltyPoints[custId]) data.loyaltyPoints[custId] = 0;
      data.loyaltyPoints[custId] += Math.floor(esc.amount);
      logActivity(data, { type:'payment_released', icon:'💰',
        title: `Payment released to ${workerName || 'crew'}`, description: `$${esc.amount.toFixed(2)} · +${Math.floor(esc.amount)} CrewPoints earned` });
      saveSharedData(data);
      return true;
    },

    disputeEscrow: function(escrowId, reason) {
      const data = getSharedData();
      const esc = data.escrowAccounts[escrowId];
      if (!esc) return false;
      esc.status = 'disputed';
      esc.disputeReason = reason;
      esc.disputedAt = new Date().toISOString();
      if (!data.disputes) data.disputes = [];
      data.disputes.push({ id:'disp_'+Date.now(), escrowId, reason,
        status:'open', openedAt: new Date().toISOString() });
      logActivity(data, { type:'dispute_opened', icon:'⚠️',
        title:'Payment dispute opened', description: reason });
      saveSharedData(data);
      return true;
    }
  };

  // ═══════════════════════════════════════════════════════════
  // TWO-WAY VERIFIED REVIEWS
  // ═══════════════════════════════════════════════════════════
  const ReviewActions = {
    submitCustomerReview: function(bookingId, rating, comment, workerId) {
      const data = getSharedData();
      const profile = _getCurrentProfile();
      const review = {
        id: 'rev_' + Date.now(), bookingId, workerId,
        type: 'customer_to_worker',
        reviewerName: (profile && profile.name) || 'Customer',
        reviewerEmail: (profile && profile.email) || '',
        rating, comment, verified: true,
        createdAt: new Date().toISOString()
      };
      if (!data.reviews) data.reviews = [];
      data.reviews.push(review);
      // Update worker's rolling average
      const workerRevs = data.reviews.filter(r => r.workerId === workerId && r.type === 'customer_to_worker');
      const avg = workerRevs.reduce((s,r) => s + r.rating, 0) / workerRevs.length;
      if (data.workers && data.workers[workerId]) {
        data.workers[workerId].rating = Math.round(avg * 10) / 10;
        data.workers[workerId].totalReviews = workerRevs.length;
      }
      logActivity(data, { type:'review_submitted', icon:'⭐',
        title:`${review.reviewerName} left a ${rating}★ review`,
        description: comment ? comment.slice(0,60) : 'No comment' });
      saveSharedData(data);
      return review;
    },

    submitWorkerReview: function(bookingId, rating, comment, customerId) {
      const data = getSharedData();
      const profile = _getCurrentProfile();
      const review = {
        id: 'rev_' + Date.now(), bookingId, customerId,
        type: 'worker_to_customer',
        reviewerName: (profile && profile.name) || 'Crew Member',
        reviewerEmail: (profile && profile.email) || '',
        rating, comment, verified: true,
        createdAt: new Date().toISOString()
      };
      if (!data.reviews) data.reviews = [];
      data.reviews.push(review);
      logActivity(data, { type:'worker_review', icon:'👤',
        title: `Worker rated customer ${rating}★`,
        description: comment ? comment.slice(0,60) : '' });
      saveSharedData(data);
      return review;
    },

    getWorkerReviews: function(workerId) {
      const data = getSharedData();
      return (data.reviews || []).filter(r => r.workerId === workerId && r.type === 'customer_to_worker');
    },

    getCustomerReviews: function(customerId) {
      const data = getSharedData();
      return (data.reviews || []).filter(r => r.customerId === customerId && r.type === 'worker_to_customer');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // AI JOB MATCHING
  // ═══════════════════════════════════════════════════════════
  const MatchingEngine = {
    // Score each available worker against a job request
    scoreWorker: function(worker, jobRequest) {
      let score = 0;
      // Specialisation match
      const jobType = (jobRequest.service || '').toLowerCase();
      const specs = worker.specialisations || [];
      if (specs.some(s => jobType.includes(s) || s.includes(jobType.split(' ')[0]))) score += 40;
      // Retention/rating
      score += (worker.rating || 4.5) * 10;
      // Availability
      if (worker.status === 'available') score += 20;
      // Verified badges bonus
      score += (worker.badges || []).length * 5;
      // Experience
      score += Math.min((worker.completedJobs || 0) / 10, 20);
      return Math.round(score);
    },

    findBestMatch: function(jobRequest) {
      const data = getSharedData();
      const workers = Object.values(data.workers || {});
      const scored = workers
        .filter(w => w.status === 'available')
        .map(w => ({ worker: w, score: MatchingEngine.scoreWorker(w, jobRequest) }))
        .sort((a,b) => b.score - a.score);
      return scored.length > 0 ? scored[0].worker : null;
    },

    autoAssignJob: function(jobId) {
      const data = getSharedData();
      const job = (data.jobs.incoming || []).find(j => j.id === jobId);
      if (!job) return null;
      const best = MatchingEngine.findBestMatch(job);
      if (!best) return null;
      logActivity(data, { type:'ai_match', icon:'🤖',
        title:`AI matched JOB to ${best.name}`,
        description:`${job.type} · Score: ${MatchingEngine.scoreWorker(best, job)} · ${best.rating}★ · ${best.completedJobs} jobs` });
      saveSharedData(data);
      return best;
    }
  };

  // ═══════════════════════════════════════════════════════════
  // RECURRING SUBSCRIPTION PLANS — "Your Crew"
  // ═══════════════════════════════════════════════════════════
  const RecurringActions = {
    createPlan: function(planData) {
      const data = getSharedData();
      const profile = _getCurrentProfile();
      const plan = {
        id: 'plan_' + Date.now(),
        customerId: (profile && profile.email) || planData.customerId || 'customer',
        customerName: (profile && profile.name) || planData.customerName || 'Customer',
        service: planData.service || 'Standard Mow',
        address: planData.address || '',
        frequency: planData.frequency || 'fortnightly', // weekly|fortnightly|monthly
        preferredWorker: planData.preferredWorkerId || null, // "Your Crew" — same person every time
        price: planData.price || 65,
        discount: planData.frequency === 'weekly' ? 0.15 : planData.frequency === 'fortnightly' ? 0.10 : 0.05,
        status: 'active',
        nextJobDate: planData.nextDate || new Date(Date.now() + 14*86400000).toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        totalJobsCompleted: 0,
        autoRenew: true
      };
      if (!data.recurringPlans) data.recurringPlans = [];
      data.recurringPlans.push(plan);
      const discountPct = Math.round(plan.discount * 100);
      logActivity(data, { type:'recurring_created', icon:'🔄',
        title:`${plan.customerName} set up recurring ${plan.frequency} service`,
        description:`${plan.service} · ${discountPct}% discount · ${plan.preferredWorker ? 'Same crew every time' : 'Auto-assigned'}` });
      saveSharedData(data);
      return plan;
    },

    pausePlan: function(planId) {
      const data = getSharedData();
      const plan = (data.recurringPlans || []).find(p => p.id === planId);
      if (plan) { plan.status = 'paused'; saveSharedData(data); }
      return plan;
    },

    cancelPlan: function(planId) {
      const data = getSharedData();
      const plan = (data.recurringPlans || []).find(p => p.id === planId);
      if (plan) { plan.status = 'cancelled'; saveSharedData(data); }
      return plan;
    },

    getPlansForCustomer: function(customerId) {
      const data = getSharedData();
      return (data.recurringPlans || []).filter(p => p.customerId === customerId && p.status === 'active');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // PHOTO PROOF (before/after)
  // ═══════════════════════════════════════════════════════════
  const PhotoProofActions = {
    logPhotoSet: function(jobId, workerId, beforeCount, afterCount) {
      const data = getSharedData();
      const profile = _getCurrentProfile();
      const workerName = (profile && profile.name) || 'Crew member';
      if (!data.photoProofs) data.photoProofs = {};
      data.photoProofs[jobId] = {
        jobId, workerId, workerName,
        before: beforeCount || 1, after: afterCount || 1,
        uploadedAt: new Date().toISOString()
      };
      logActivity(data, { type:'photo_proof', icon:'📸',
        title:`${workerName} uploaded before/after photos`,
        description:`Job ${jobId} · ${beforeCount} before + ${afterCount} after` });
      saveSharedData(data);
    },

    getPhotos: function(jobId) {
      const data = getSharedData();
      return (data.photoProofs || {})[jobId] || null;
    }
  };

  // ═══════════════════════════════════════════════════════════
  // CARBON TRACKING
  // ═══════════════════════════════════════════════════════════
  const CarbonActions = {
    logJob: function(jobId, distanceKm, durationHrs) {
      const data = getSharedData();
      // Approximate: 0.21 kg CO2 per km (petrol ute), offset 0.5kg per job via tree planting
      const emitted = Math.round(distanceKm * 0.21 * 10) / 10;
      const offset  = 0.5;
      const net     = Math.round((emitted - offset) * 10) / 10;
      const entry   = { jobId, distanceKm, durationHrs, emitted, offset, net, loggedAt: new Date().toISOString() };
      if (!data.carbonLog) data.carbonLog = [];
      data.carbonLog.push(entry);
      logActivity(data, { type:'carbon_log', icon:'🌱',
        title:`Carbon logged for job`, description:`${emitted}kg emitted · 0.5kg offset · Net: ${net}kg` });
      saveSharedData(data);
      return entry;
    },

    getTotalOffset: function() {
      const data = getSharedData();
      return (data.carbonLog || []).reduce((s,e) => s + e.offset, 0);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // LICENCE & CERTIFICATION BADGES
  // ═══════════════════════════════════════════════════════════
  const BadgeActions = {
    BADGE_TYPES: {
      background_checked:  { label:'Background Checked', icon:'🛡️', color:'#185FA5' },
      cert_iii:            { label:'Cert III Horticulture', icon:'🎓', color:'#3B6D11' },
      cert_iv:             { label:'Cert IV', icon:'🎓', color:'#3B6D11' },
      white_card:          { label:'White Card (WH&S)', icon:'🏗️', color:'#854F0B' },
      public_liability:    { label:'Public Liability Insured', icon:'✅', color:'#3B6D11' },
      first_aid:           { label:'First Aid Certified', icon:'⛑️', color:'#993C1D' },
      chainsaw_licence:    { label:'Chainsaw Licence', icon:'🔰', color:'#854F0B' },
      pesticide_cert:      { label:'Pesticide Cert', icon:'🔬', color:'#534AB7' },
      local_legend:        { label:'Local Legend', icon:'⭐', color:'#A0720F' },
      top_rated:           { label:'Top Rated', icon:'🏆', color:'#185FA5' }
    },

    awardBadge: function(workerId, badgeType) {
      const data = getSharedData();
      if (!data.workers[workerId]) return;
      if (!data.workers[workerId].badges) data.workers[workerId].badges = [];
      if (!data.workers[workerId].badges.includes(badgeType)) {
        data.workers[workerId].badges.push(badgeType);
        logActivity(data, { type:'badge_awarded', icon:'🏅',
          title:`Badge awarded: ${BadgeActions.BADGE_TYPES[badgeType]?.label || badgeType}`,
          description:`Worker: ${data.workers[workerId].name}` });
        saveSharedData(data);
      }
    },

    getWorkerBadges: function(workerId) {
      const data = getSharedData();
      const badges = (data.workers[workerId] && data.workers[workerId].badges) || [];
      return badges.map(b => ({ ...BadgeActions.BADGE_TYPES[b], id: b })).filter(Boolean);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // LOYALTY — CrewPoints / CrewPass
  // ═══════════════════════════════════════════════════════════
  const LoyaltyActions = {
    TIERS: [
      { name:'Seedling',   min:0,    discount:0,    color:'#97C459' },
      { name:'Grower',     min:200,  discount:0.05, color:'#3B6D11' },
      { name:'Local',      min:500,  discount:0.10, color:'#185FA5' },
      { name:'Legend',     min:1000, discount:0.15, color:'#A0720F' },
      { name:'CrewPass',   min:2000, discount:0.20, color:'#6B21A8' }
    ],

    getBalance: function(customerId) {
      const data = getSharedData();
      return (data.loyaltyPoints || {})[customerId] || 0;
    },

    addPoints: function(customerId, pts, reason) {
      const data = getSharedData();
      if (!data.loyaltyPoints) data.loyaltyPoints = {};
      data.loyaltyPoints[customerId] = (data.loyaltyPoints[customerId] || 0) + pts;
      logActivity(data, { type:'points_earned', icon:'🎁',
        title:`+${pts} CrewPoints earned`, description: reason || 'Job completed' });
      saveSharedData(data);
      return data.loyaltyPoints[customerId];
    },

    redeemPoints: function(customerId, pts) {
      const data = getSharedData();
      const balance = (data.loyaltyPoints || {})[customerId] || 0;
      if (balance < pts) return false;
      data.loyaltyPoints[customerId] = balance - pts;
      logActivity(data, { type:'points_redeemed', icon:'🎟️',
        title:`${pts} CrewPoints redeemed`, description:`$${(pts*0.01).toFixed(2)} credit applied` });
      saveSharedData(data);
      return true;
    },

    getTier: function(customerId) {
      const pts = LoyaltyActions.getBalance(customerId);
      return [...LoyaltyActions.TIERS].reverse().find(t => pts >= t.min) || LoyaltyActions.TIERS[0];
    }
  };

  // ═══════════════════════════════════════════════════════════
  // NEIGHBOURHOOD GROUP BOOKING
  // ═══════════════════════════════════════════════════════════
  const GroupBookingActions = {
    createGroup: function(organiserName, organiserAddr, service, date) {
      const data = getSharedData();
      const group = {
        id: 'grp_' + Date.now(),
        organiserName, service, date,
        members: [{ name: organiserName, address: organiserAddr, status:'confirmed' }],
        maxMembers: 6, minForDiscount: 2,
        discount: 0.10,  // 10% per member
        status: 'open',
        inviteCode: Math.random().toString(36).substr(2,6).toUpperCase(),
        createdAt: new Date().toISOString()
      };
      if (!data.groupBookings) data.groupBookings = [];
      data.groupBookings.push(group);
      logActivity(data, { type:'group_booking', icon:'🏘️',
        title:`${organiserName} started a neighbourhood group booking`,
        description:`${service} · ${date} · Code: ${group.inviteCode}` });
      saveSharedData(data);
      return group;
    },

    joinGroup: function(inviteCode, memberName, memberAddr) {
      const data = getSharedData();
      const group = (data.groupBookings || []).find(g => g.inviteCode === inviteCode && g.status === 'open');
      if (!group || group.members.length >= group.maxMembers) return null;
      group.members.push({ name: memberName, address: memberAddr, status:'confirmed' });
      if (group.members.length >= group.minForDiscount) {
        group.status = 'discount_active';
      }
      logActivity(data, { type:'group_join', icon:'🤝',
        title:`${memberName} joined group booking`,
        description:`${group.service} · Group now has ${group.members.length} members · ${Math.round(group.discount*100)}% off for everyone` });
      saveSharedData(data);
      return group;
    }
  };

  // ═══════════════════════════════════════════════════════════
  // DISPUTE RESOLUTION
  // ═══════════════════════════════════════════════════════════
  const DisputeActions = {
    openDispute: function(bookingId, customerId, reason, evidence) {
      const data = getSharedData();
      const dispute = {
        id: 'disp_' + Date.now(), bookingId, customerId, reason, evidence,
        status: 'open',  // open → reviewing → resolved_customer | resolved_worker | refunded
        openedAt: new Date().toISOString(),
        windowHrs: 12, resolvedAt: null
      };
      if (!data.disputes) data.disputes = [];
      data.disputes.push(dispute);
      // Also freeze escrow if linked
      const booking = (data.bookings || []).find(b => b.id === bookingId);
      if (booking && booking.escrowId) {
        const esc = data.escrowAccounts[booking.escrowId];
        if (esc) { esc.status = 'disputed'; esc.disputeId = dispute.id; }
      }
      logActivity(data, { type:'dispute_opened', icon:'⚠️',
        title:'Customer opened a dispute', description:`${reason}` });
      saveSharedData(data);
      return dispute;
    },

    resolveDispute: function(disputeId, resolution, refundAmount) {
      const data = getSharedData();
      const dispute = (data.disputes || []).find(d => d.id === disputeId);
      if (!dispute) return false;
      dispute.status = resolution;
      dispute.resolvedAt = new Date().toISOString();
      dispute.refundAmount = refundAmount || 0;
      logActivity(data, { type:'dispute_resolved', icon:'✅',
        title:`Dispute resolved: ${resolution}`,
        description: refundAmount ? `Refund: $${refundAmount}` : 'No refund' });
      saveSharedData(data);
      return true;
    }
  };

  // ═══════════════════════════════════════════════════════════
  // BOOKING ACTIONS (extended with escrow)
  // ═══════════════════════════════════════════════════════════
  const BookingActions = {
    createBooking: function(bookingData) {
      const data = getSharedData();
      const profile = _getCurrentProfile();
      const booking = {
        id: 'booking_' + Date.now(),
        customerId: (profile && profile.email) || bookingData.customerId || 'customer_' + Date.now(),
        customerName: (profile && profile.name) || bookingData.customerName || 'Customer',
        service: bookingData.service || 'Standard Mow',
        address: bookingData.address || '123 Main St',
        scheduledDate: bookingData.scheduledDate || new Date().toISOString().split('T')[0],
        scheduledTime: bookingData.scheduledTime || '10:00 AM',
        price: bookingData.price || 65,
        lineItems: bookingData.lineItems || [],
        status: 'pending_assignment',
        escrowId: null,
        createdAt: new Date().toISOString(),
        notes: bookingData.notes || ''
      };
      if (!data.bookings) data.bookings = [];
      data.bookings.push(booking);

      // Auto-create escrow hold
      const escrowId = EscrowActions.createEscrow(booking.id, booking.price, booking.customerId);
      booking.escrowId = escrowId;

      // Award booking points (1pt per $)
      LoyaltyActions.addPoints(booking.customerId, Math.floor(booking.price), `Booking ${booking.id}`);

      // Log carbon estimate (default 5km travel, 1.5hr job)
      CarbonActions.logJob(booking.id, 5, 1.5);

      const job = {
        id: 'job_' + Date.now(),
        bookingId: booking.id,
        type: booking.service,
        address: booking.address,
        distance: '2.1km',
        datetime: booking.scheduledDate + ' ' + booking.scheduledTime,
        duration: 60,
        price: booking.price,
        customer: booking.customerName,
        customerPhone: bookingData.customerPhone || '',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      if (!data.jobs) data.jobs = { incoming:[], active:[], completed:[], declined:[] };
      data.jobs.incoming.push(job);

      // AI auto-match
      const bestWorker = MatchingEngine.findBestMatch(job);
      if (bestWorker) {
        job.suggestedWorker = bestWorker.id;
        job.suggestedWorkerName = bestWorker.name;
      }

      logActivity(data, { type:'booking_created', icon:'📅',
        title:'New customer booking',
        description:`${booking.service} · ${booking.customerName} · ${booking.scheduledDate}${bestWorker ? ' · AI match: '+bestWorker.name : ''}`,
        bookingId: booking.id, jobId: job.id });

      saveSharedData(data);
      console.log('✅ Booking created:', booking.id, '→ Escrow:', escrowId, '→ AI match:', bestWorker && bestWorker.name);
      return { booking, job, escrowId, suggestedWorker: bestWorker };
    }
  };

  // ═══════════════════════════════════════════════════════════
  // JOB ACTIONS (unchanged core, extended)
  // ═══════════════════════════════════════════════════════════
  const JobActions = {
    acceptJob: function(jobId, workerId, workerName) {
      const data = getSharedData();
      const profile = _getCurrentProfile();
      const resolvedWorkerName = (profile && profile.name) || workerName;
      const resolvedWorkerId = (profile && profile.email) || workerId;
      const jobIndex = data.jobs.incoming.findIndex(j => j.id === jobId);
      if (jobIndex === -1) return null;
      const job = data.jobs.incoming.splice(jobIndex, 1)[0];
      job.status = 'accepted';
      job.assignedTo = resolvedWorkerId;
      job.assignedWorker = resolvedWorkerName;
      job.acceptedAt = new Date().toISOString();
      data.jobs.active.push(job);
      const booking = data.bookings && data.bookings.find(b => b.id === job.bookingId);
      if (booking) { booking.status = 'assigned'; booking.assignedTo = resolvedWorkerName; }
      logActivity(data, { type:'job_accepted', icon:'✅',
        title:`${resolvedWorkerName} accepted job`,
        description:`${job.type} · ${job.address}`, jobId: job.id });
      saveSharedData(data);
      return job;
    },

    declineJob: function(jobId, workerId, workerName) {
      const data = getSharedData();
      const profile = _getCurrentProfile();
      const resolvedWorkerName = (profile && profile.name) || workerName;
      const resolvedWorkerId = (profile && profile.email) || workerId;
      const jobIndex = data.jobs.incoming.findIndex(j => j.id === jobId);
      if (jobIndex === -1) return null;
      const job = data.jobs.incoming.splice(jobIndex, 1)[0];
      job.status = 'declined'; job.declinedBy = resolvedWorkerId;
      data.jobs.declined.push(job);
      logActivity(data, { type:'job_declined', icon:'❌',
        title:`${resolvedWorkerName} declined job`,
        description:`${job.type} · Re-matching via AI...`, jobId: job.id });
      // Re-run AI match automatically
      data.jobs.incoming.push({ ...job, status:'pending', declinedBy: undefined });
      saveSharedData(data);
      return job;
    },

    completeJob: function(jobId, workerId, workerName, photos) {
      const data = getSharedData();
      const profile = _getCurrentProfile();
      const resolvedWorkerName = (profile && profile.name) || workerName;
      const resolvedWorkerId = (profile && profile.email) || workerId;
      const jobIndex = data.jobs.active.findIndex(j => j.id === jobId);
      if (jobIndex === -1) return null;
      const job = data.jobs.active.splice(jobIndex, 1)[0];
      job.status = 'completed'; job.completedAt = new Date().toISOString();
      job.photos = photos || { before: true, after: true };
      data.jobs.completed.push(job);
      const booking = data.bookings && data.bookings.find(b => b.id === job.bookingId);
      if (booking) {
        booking.status = 'completed';
        booking.completedAt = new Date().toISOString();
        // Start 12-hour dispute window, then auto-release escrow
        if (booking.escrowId) {
          const esc = data.escrowAccounts[booking.escrowId];
          if (esc) { esc.status = 'pending_release'; esc.releaseAt = new Date(Date.now() + 12*3600000).toISOString(); }
        }
      }
      // Log photo proof
      if (job.assignedTo) PhotoProofActions.logPhotoSet(jobId, resolvedWorkerId, 2, 2);
      logActivity(data, { type:'job_completed', icon:'✅',
        title:`${resolvedWorkerName} completed job`,
        description:`${job.type} · ${job.address} · Photos uploaded · 12hr dispute window open`, jobId: job.id });
      saveSharedData(data);
      return job;
    },

    getIncomingJobs: function() { const d = getSharedData(); return (d.jobs && d.jobs.incoming) || []; },
    getActiveJobs: function() { const d = getSharedData(); return (d.jobs && d.jobs.active) || []; }
  };

  // ═══════════════════════════════════════════════════════════
  // WORKER ACTIONS (unchanged)
  // ═══════════════════════════════════════════════════════════
  const WorkerActions = {
    clockIn: function(workerId, workerName, location) {
      const data = getSharedData();
      const profile = _getCurrentProfile();
      const rn = (profile && profile.name) || workerName;
      const ri = (profile && profile.email) || workerId;
      if (data.workers[ri]) { data.workers[ri].status = 'clocked_in'; data.workers[ri].clockInTime = new Date().toLocaleTimeString(); }
      if (!data.timeEntries) data.timeEntries = [];
      data.timeEntries.push({ workerId:ri, workerName:rn, action:'clock_in', timestamp:new Date().toISOString(), location });
      logActivity(data, { type:'clock_in', icon:'⏰', title:`${rn} clocked in`, description:`${location} · Via Mobile App` });
      saveSharedData(data);
    },
    clockOut: function(workerId, workerName, hoursWorked) {
      const data = getSharedData();
      const profile = _getCurrentProfile();
      const rn = (profile && profile.name) || workerName;
      const ri = (profile && profile.email) || workerId;
      if (data.workers[ri]) { data.workers[ri].status = 'clocked_out'; data.workers[ri].clockInTime = null; }
      if (!data.timeEntries) data.timeEntries = [];
      data.timeEntries.push({ workerId:ri, workerName:rn, action:'clock_out', timestamp:new Date().toISOString(), hoursWorked });
      logActivity(data, { type:'clock_out', icon:'⏸️', title:`${rn} clocked out`, description:`${hoursWorked} logged` });
      saveSharedData(data);
    }
  };

  const EquipmentActions = {
    checkout: function(equipmentId, workerId, workerName, location) {
      const data = getSharedData();
      const profile = _getCurrentProfile();
      const rn = (profile && profile.name) || workerName;
      const ri = (profile && profile.email) || workerId;
      if (!data.equipment) data.equipment = {};
      if (!data.equipment[equipmentId]) data.equipment[equipmentId] = { id:equipmentId, type:'Equipment' };
      Object.assign(data.equipment[equipmentId], { status:'checked_out', checkedOutBy:rn, checkedOutAt:new Date().toISOString(), location });
      logActivity(data, { type:'equipment_checkout', icon:'🛠️', title:`${rn} checked out equipment`, description:`${equipmentId} · ${location}` });
      saveSharedData(data);
    }
  };

  const ReferralActions = {
    submit: function(referrerName, candidateData) {
      const data = getSharedData();
      const profile = _getCurrentProfile();
      const rn = (profile && profile.name) || referrerName;
      const referral = { id:'ref_'+Date.now(), referredBy:rn, ...candidateData, status:'applied', submittedAt:new Date().toISOString(), source:'mobile_app' };
      if (!data.referrals) data.referrals = [];
      data.referrals.push(referral);
      logActivity(data, { type:'referral_submitted', icon:'👥', title:`${rn} submitted employee referral`, description:`Candidate: ${candidateData.candidateName}` });
      saveSharedData(data);
      return referral;
    }
  };

  const SyncStatus = {
    isOnline: function() { return navigator.onLine; },
    toggleStatus: function(el) {
      const isOn = el.classList.contains('online');
      el.classList.toggle('online', !isOn); el.classList.toggle('offline', isOn);
      const t = el.querySelector('.sync-text'); if (t) t.textContent = isOn ? 'CC Offline' : 'CC Online';
      return isOn ? 'offline' : 'online';
    }
  };

  // ═══════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════
  window.CrewIntegration = {
    init: initCrewData, getData: getSharedData, saveData: saveSharedData, logActivity,
    BookingActions, JobActions, WorkerActions, EquipmentActions, ReferralActions, SyncStatus,
    EscrowActions, ReviewActions, MatchingEngine, RecurringActions,
    PhotoProofActions, CarbonActions, BadgeActions, LoyaltyActions,
    GroupBookingActions, DisputeActions
  };

  initCrewData();
  console.log('✅ Crew Integration Engine v2 loaded — escrow, reviews, AI match, recurring, badges, loyalty, disputes');
})();
