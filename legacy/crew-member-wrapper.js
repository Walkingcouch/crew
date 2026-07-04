// CREW MEMBER APP INTEGRATION WRAPPER
(function() {
  
  // BUG FIX: Helper to get real worker identity from auth profile
  function getWorkerIdentity() {
    const profile = window.CrewAuth ? window.CrewAuth.getCurrentUser() : null;
    return {
      id: (profile && profile.email) || 'worker_001',
      name: (profile && profile.name) || 'Mike Rodriguez'
    };
  }

  // Load incoming jobs from shared data
  function loadIncomingJobs() {
    if (!window.CrewIntegration) return;
    
    const jobs = window.CrewIntegration.JobActions.getIncomingJobs();
    if (jobs.length === 0) return;
    
    const job = jobs[0];
    const jobCard = document.getElementById('incoming-job-card');
    
    if (jobCard) {
      // Update job details
      const serviceEl = jobCard.querySelector('[style*="font-weight:600"][style*="font-size:15px"]');
      if (serviceEl) serviceEl.textContent = job.type;
      
      const addressEl = jobCard.querySelector('[style*="📍"]');
      if (addressEl) addressEl.textContent = `📍 ${job.address} — ${job.distance || '2.1km'}`;
      
      const timeEls = jobCard.querySelectorAll('[style*="font-size:13px"]');
      if (timeEls[1]) timeEls[1].textContent = `📅 ${job.datetime} · ${job.duration || 60} min`;
      
      const priceEl = jobCard.querySelector('[style*="font-size:18px"]');
      if (priceEl) priceEl.textContent = `$${Number(job.price).toFixed(2)}`;
      
      console.log('✅ Loaded job from booking:', job.id);
    }
  }
  
  // Override decline function
  const originalDeclineJob = window.declineJob;
  window.declineJob = function() {
    if (window.CrewIntegration) {
      const jobs = window.CrewIntegration.JobActions.getIncomingJobs();
      if (jobs.length > 0) {
        const worker = getWorkerIdentity();
        window.CrewIntegration.JobActions.declineJob(jobs[0].id, worker.id, worker.name);
      }
    }
    if (originalDeclineJob) return originalDeclineJob.apply(this, arguments);
  };
  
  // Add accept function
  window.acceptCurrentJob = function() {
    if (!window.CrewIntegration) return;
    
    const jobs = window.CrewIntegration.JobActions.getIncomingJobs();
    if (jobs.length > 0) {
      const job = jobs[0];
      const worker = getWorkerIdentity();
      window.CrewIntegration.JobActions.acceptJob(job.id, worker.id, worker.name);
      if (window.showToast) showToast('✅', 'Job accepted! Added to your active jobs.');
      setTimeout(() => { if (window.goTo) goTo('s-cactivejob'); }, 800);
    }
  };
  
  // Toggle sync status
  window.toggleSyncStatus = function(badge) {
    if (!window.CrewIntegration) return;
    window.CrewIntegration.SyncStatus.toggleStatus(badge);
    if (window.showToast) {
      const isOnline = badge.classList.contains('online');
      showToast(isOnline ? '🟢' : '⚫', isOnline ? 'Command Center sync online' : 'Command Center sync offline');
    }
  };
  
  // Load jobs on init and refresh
  setTimeout(loadIncomingJobs, 1000);
  setInterval(loadIncomingJobs, 5000);
  
  // Listen for data updates
  window.addEventListener('crewDataUpdated', loadIncomingJobs);
  window.addEventListener('storage', function(e) {
    if (e.key === 'crewDataUpdate') loadIncomingJobs();
  });
  
  console.log('✅ Crew member app integration active');
})();
