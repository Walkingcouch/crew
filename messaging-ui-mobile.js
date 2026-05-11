// ═══════════════════════════════════════════════════════════════════════════
// CREW MESSAGING UI - MOBILE APP VERSION
// ═══════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // Inject chat UI into existing messages screen
  function enhanceMessagesScreen() {
    const messagesScreen = document.getElementById('s-messages');
    if (!messagesScreen) {
      console.warn('Messages screen not found');
      return;
    }

    // Avoid injecting twice
    if (document.getElementById('channel-list')) return;

    // Add channel list to messages screen
    const channelListHTML = `
      <div style="padding: 0 16px; margin-bottom: 20px;">
        <h3 style="font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 16px;">Channels</h3>
        <div id="channel-list" style="display: flex; flex-direction: column; gap: 10px;">
          <!-- Channels populated here -->
        </div>
      </div>
      
      <div style="padding: 0 16px; margin-bottom: 20px;">
        <h3 style="font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 16px;">Direct Messages</h3>
        <div id="dm-list" style="display: flex; flex-direction: column; gap: 10px;">
          <!-- DMs populated here -->
        </div>
      </div>
    `;

    // Find the scrollable body in messages screen
    const messagesBody = messagesScreen.querySelector('.sb-body');
    if (messagesBody) {
      // Prepend channel list
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = channelListHTML;
      messagesBody.insertBefore(tempDiv, messagesBody.firstChild);
    }
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Render channel list
  function renderChannels() {
    const channelList = document.getElementById('channel-list');
    // BUG FIX: Only run if the element exists (i.e. messages screen is active)
    if (!channelList || !window.CrewMessaging) return;

    const channels = window.CrewMessaging.Channels.getAllChannels();
    
    channelList.innerHTML = '';
    
    channels.forEach(function(channel) {
      const unreadCount = window.CrewMessaging.Notifications.getUnreadByChannel(channel.id);
      const lastMessage = channel.messages && channel.messages.length > 0 ? 
        channel.messages[channel.messages.length - 1] : null;
      
      const channelCard = document.createElement('div');
      channelCard.style.cssText = `
        background: var(--surface);
        border-radius: 12px;
        padding: 14px;
        border: 1px solid var(--border);
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
      `;
      
      channelCard.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 24px;">${escHtml(channel.icon)}</div>
          <div style="flex: 1;">
            <div style="font-size: 15px; font-weight: 600; color: var(--text);">
              ${escHtml(channel.name)}
              ${unreadCount > 0 ? `<span style="background: var(--red); color: white; font-size: 11px; padding: 2px 6px; border-radius: 10px; margin-left: 6px;">${escHtml(unreadCount)}</span>` : ''}
            </div>
            ${lastMessage ? `
              <div style="font-size: 12px; color: var(--text-3); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escHtml(lastMessage.senderName)}: ${escHtml(lastMessage.text)}
              </div>
            ` : `
              <div style="font-size: 12px; color: var(--text-3); margin-top: 4px;">No messages yet</div>
            `}
          </div>
        </div>
      `;
      
      channelCard.onclick = function() { openChannel(channel.id); };
      
      channelCard.addEventListener('mouseenter', function() {
        this.style.boxShadow = 'var(--shadow)';
      });
      
      channelCard.addEventListener('mouseleave', function() {
        this.style.boxShadow = 'none';
      });
      
      channelList.appendChild(channelCard);
    });
  }

  // Render direct messages
  function renderDirectMessages() {
    const dmList = document.getElementById('dm-list');
    // BUG FIX: Only run if the element exists
    if (!dmList || !window.CrewMessaging) return;

    const contacts = window.CrewMessaging.Contacts.getAllContacts();
    const user = window.CrewAuth ? window.CrewAuth.getCurrentUser() : null;
    
    if (!user) return;
    
    // Filter out current user
    const otherContacts = contacts.filter(function(c) { return c.email !== user.email; }).slice(0, 5);
    
    dmList.innerHTML = '';
    
    if (otherContacts.length === 0) {
      dmList.innerHTML = '<div style="font-size: 13px; color: var(--text-3); padding: 10px;">No contacts available</div>';
      return;
    }
    
    otherContacts.forEach(function(contact) {
      const dmCard = document.createElement('div');
      dmCard.style.cssText = `
        background: var(--surface);
        border-radius: 12px;
        padding: 14px;
        border: 1px solid var(--border);
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 12px;
      `;
      
      const initials = contact.name.split(' ').map(function(n) { return n[0]; }).join('').substring(0, 2).toUpperCase();
      const roleColor = contact.role === 'customer' ? '#3A86FF' :
                       (contact.role && contact.role.includes('crew')) ? '#2D6A4F' : '#666';
      
      dmCard.innerHTML = `
        <div style="width: 40px; height: 40px; border-radius: 50%; background: ${escHtml(roleColor)}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px;">
          ${escHtml(initials)}
        </div>
        <div style="flex: 1;">
          <div style="font-size: 14px; font-weight: 600; color: var(--text);">${escHtml(contact.name)}</div>
          <div style="font-size: 12px; color: var(--text-3);">${escHtml((contact.role || '').replace('_', ' '))}</div>
        </div>
      `;
      
      dmCard.onclick = function() { openDirectMessage(contact); };
      
      dmCard.addEventListener('mouseenter', function() {
        this.style.boxShadow = 'var(--shadow)';
      });
      
      dmCard.addEventListener('mouseleave', function() {
        this.style.boxShadow = 'none';
      });
      
      dmList.appendChild(dmCard);
    });
  }

  // Open channel chat
  function openChannel(channelId) {
    const channel = window.CrewMessaging.Channels.getChannel(channelId);
    if (!channel) return;
    
    // Mark as read
    window.CrewMessaging.Channels.markChannelAsRead(channelId);
    
    if (window.showToast) {
      showToast(channel.icon, `Opening ${channel.name} channel`);
    }
    
    console.log('Opening channel:', channel.name);
  }

  // Open direct message
  function openDirectMessage(contact) {
    if (window.showToast) {
      showToast('💬', `Opening chat with ${contact.name}`);
    }
    
    console.log('Opening DM with:', contact.name);
  }

  // BUG FIX: Only refresh UI if the messaging screen elements actually exist in DOM.
  // Previously the interval ran unconditionally every 5 seconds, causing wasted queries
  // and errors when the messages screen wasn't active.
  function refreshMessagingUI() {
    if (!document.getElementById('channel-list')) return;
    renderChannels();
    renderDirectMessages();
  }

  // Listen for messaging updates
  window.addEventListener('crewMessagingUpdated', refreshMessagingUI);
  window.addEventListener('storage', function(e) {
    if (e.key === 'crewMessagingUpdate') {
      refreshMessagingUI();
    }
  });

  // Initialize when DOM is ready
  function init() {
    setTimeout(function() {
      enhanceMessagesScreen();
      refreshMessagingUI();
      console.log('✅ Messaging UI initialized');
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Refresh every 5 seconds (only acts when messages screen is visible)
  setInterval(refreshMessagingUI, 5000);

})();
