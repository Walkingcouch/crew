// COMMAND CENTER INTEGRATION WRAPPER
(function() {

  // BUG FIX: Track which activity IDs have already been rendered to prevent
  // duplicate entries accumulating on every 3-second refresh tick.
  const _renderedActivityIds = new Set();
  
  function refreshActivityFeed() {
    if (!window.CrewIntegration) return;
    
    const data = window.CrewIntegration.getData();
    const feedContainer = document.querySelector('.activity-feed');
    
    if (!feedContainer || !data.activities || data.activities.length === 0) return;
    
    // Only inject activities we haven't rendered yet
    const newActivities = data.activities
      .slice(0, 15)
      .filter(activity => !_renderedActivityIds.has(activity.id));

    if (newActivities.length === 0) return;

    function escHtml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Build HTML for new activities only
    let newActivitiesHTML = '';
    newActivities.forEach(activity => {
      _renderedActivityIds.add(activity.id);
      const timeAgo = getTimeAgo(activity.timestamp);
      const iconClass = activity.type.includes('clock') ? 'clock-in' :
                       activity.type.includes('equipment') ? 'equipment' :
                       activity.type.includes('referral') ? 'referral' :
                       activity.type.includes('job') ? 'clock-in' : 'clock-in';

      newActivitiesHTML += `
        <div class="activity-item new" data-activity-id="${escHtml(activity.id)}" style="animation: slideIn 0.3s ease;">
          <div class="activity-icon ${iconClass}">${escHtml(activity.icon)}</div>
          <div class="activity-content">
            <div class="activity-title">${escHtml(activity.title)}</div>
            <div class="activity-description">${escHtml(activity.description)}</div>
          </div>
          <div class="activity-time">${escHtml(timeAgo)}</div>
        </div>
      `;
    });

    // Prepend only new items before existing demo/static items
    feedContainer.insertAdjacentHTML('afterbegin', newActivitiesHTML);
    
    console.log('📊 Activity feed updated:', newActivities.length, 'new activities');
  }
  
  function getTimeAgo(timestamp) {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now - then) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hr ago';
    return Math.floor(seconds / 86400) + ' days ago';
  }
  
  function updateMetrics() {
    if (!window.CrewIntegration) return;
    
    const data = window.CrewIntegration.getData();
    
    // Update active workers count
    const workers = data.workers || {};
    const activeCount = Object.values(workers).filter(w => w.status === 'clocked_in').length;
    
    document.querySelectorAll('.live-monitor-count').forEach(el => {
      el.textContent = `${activeCount} workers active`;
    });
    
    // Update job counts if elements exist
    const incomingCount = (data.jobs && data.jobs.incoming ? data.jobs.incoming.length : 0);
    const activeJobCount = (data.jobs && data.jobs.active ? data.jobs.active.length : 0);
    
    console.log('📊 Metrics updated - Active workers:', activeCount, 'Incoming jobs:', incomingCount);
  }
  
  // Listen for data updates from mobile app
  window.addEventListener('storage', function(e) {
    if (e.key === 'crewDataUpdate') {
      console.log('📲 Mobile app data update detected');
      refreshActivityFeed();
      updateMetrics();
    }
  });
  
  window.addEventListener('crewDataUpdated', function(e) {
    console.log('📲 Data updated in same window');
    refreshActivityFeed();
    updateMetrics();
  });
  
  // Refresh periodically
  setInterval(function() {
    refreshActivityFeed();
    updateMetrics();
  }, 3000);
  
  // Initial load
  setTimeout(function() {
    refreshActivityFeed();
    updateMetrics();
    console.log('✅ Command Center integration active');
  }, 1000);
  
})();
