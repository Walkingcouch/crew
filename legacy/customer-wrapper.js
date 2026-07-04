// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER APP INTEGRATION WRAPPER — Full bi-directional sync
// ═══════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  function getProfile() {
    try { return JSON.parse(localStorage.getItem('crewUserProfile') || 'null'); } catch(e) { return null; }
  }
  function getData() {
    try { return JSON.parse(localStorage.getItem('crewSharedData') || '{}'); } catch(e) { return {}; }
  }
  function saveData(d) {
    localStorage.setItem('crewSharedData', JSON.stringify(d));
    localStorage.setItem('crewDataUpdate', Date.now().toString());
  }

  // Intercept goTo for booking & quote approval
  const _origGoTo = window.goTo;
  window.goTo = function(screenId) {
    const currentScreen = document.querySelector('.screen:not(.hidden)');
    const fromQuoteScreen = currentScreen && currentScreen.id === 's-customquote';

    if (screenId === 's-confirm') {
      if (fromQuoteScreen) {
        _approveLatestPendingQuote();
      } else if (window.CrewIntegration && window.CrewIntegration.BookingActions) {
        const profile = getProfile();
        window.CrewIntegration.BookingActions.createBooking({
          customerName:  (profile && profile.name)  || 'Customer',
          customerPhone: (profile && profile.phone) || '',
          service: 'Standard Mow',
          address: '42 Banksia St, Paddington',
          scheduledDate: new Date(Date.now() + 4*86400000).toISOString().split('T')[0],
          scheduledTime: '10:00', price: 65
        });
      }
    }
    return _origGoTo.apply(this, arguments);
  };

  function _approveLatestPendingQuote() {
    const profile = getProfile();
    const data = getData();
    if (!data.pendingQuotes || !data.pendingQuotes.length) return;
    const quote = [...data.pendingQuotes].reverse().find(q => q.status === 'pending_approval');
    if (!quote || !window.CrewIntegration) return;

    window.CrewIntegration.BookingActions.createBooking({
      customerName:  quote.customerName || (profile && profile.name) || 'Customer',
      customerPhone: (profile && profile.phone) || '',
      service: quote.lineItems && quote.lineItems[0] ? quote.lineItems[0].desc : 'Custom Job',
      address: quote.address || '',
      scheduledDate: quote.date || new Date(Date.now() + 4*86400000).toISOString().split('T')[0],
      scheduledTime: quote.time || '09:00',
      price: quote.total || 0,
      notes: 'Quote ' + quote.id + ' approved. ' + (quote.notes || ''),
      lineItems: quote.lineItems || []
    });

    quote.status = 'approved';
    quote.approvedAt = new Date().toISOString();
    if (!data.customerMessages) data.customerMessages = [];
    data.customerMessages.push({
      reqId: quote.reqId, from: (profile && profile.name) || 'Customer',
      type: 'quote_approved', quoteId: quote.id,
      text: 'I\'ve approved quote ' + quote.id + ' for $' + (quote.total || 0).toFixed(2) + '. Ready to confirm!',
      timestamp: new Date().toISOString()
    });
    saveData(data);
    console.log('Quote approved:', quote.id);
  }

  // Poll for CC → customer messages (declines, quotes)
  let _lastCheck = 0;
  const _shown = new Set();
  function pollMessages() {
    if (Date.now() - _lastCheck < 4000) return;
    _lastCheck = Date.now();
    const data = getData();
    (data.customerMessages || []).forEach(function(msg) {
      const key = (msg.timestamp || '') + (msg.text || '').slice(0, 20);
      if (_shown.has(key)) return;
      _shown.add(key);
      if (msg.type === 'decline') {
        _toast('❌', msg.text || 'Your work request was declined');
      } else if (msg.type === 'quote_sent' || (msg.text && msg.text.includes('TQ-'))) {
        _toast('📋', 'New quote received — check your Messages');
      }
    });
  }

  function _toast(icon, text) {
    if (window.showToast) { window.showToast(icon, text); return; }
    const b = document.createElement('div');
    b.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:white;border-radius:10px;padding:14px 18px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:9999;max-width:320px;font-size:13px;';
    b.textContent = icon + ' ' + text;
    document.body.appendChild(b);
    setTimeout(function(){ if(b.parentNode) b.parentNode.removeChild(b); }, 5000);
  }

  // Submit work request to CC from customer app
  window.submitWorkRequestToCC = function(serviceType, description, address) {
    const profile = getProfile();
    const data = getData();
    if (!data.customerWorkRequests) data.customerWorkRequests = [];
    const req = {
      id: 'req-' + Date.now(),
      customerName: (profile && profile.name) || 'Customer',
      customerNumber: 'CUST-' + Math.floor(Math.random()*9000+1000),
      customerPhone: (profile && profile.phone) || '',
      service: serviceType || 'General Service',
      address: address || '',
      message: description || '',
      time: 'Just now',
      status: 'pending',
      submittedAt: new Date().toISOString()
    };
    data.customerWorkRequests.push(req);
    if (!data.activities) data.activities = [];
    data.activities.unshift({
      id: 'activity_' + Date.now(), type: 'work_request', icon: '💬',
      title: req.customerName + ' sent a work request',
      description: req.service + ' · ' + req.address,
      timestamp: new Date().toISOString(), timeAgo: 'Just now'
    });
    saveData(data);
    return req;
  };

  setInterval(pollMessages, 4000);
  console.log('✅ Customer app integration active');
})();
