// ═══════════════════════════════════════════════════════════════════════════
// CREW PLATFORM - MESSAGING & COMMUNICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // Initialize messaging data structure
  // BUG FIX: Always read existing crewSharedData first and merge into it,
  // never start from {} which would wipe existing jobs/workers/activities.
  function initMessagingData() {
    let data = {};
    try {
      data = JSON.parse(localStorage.getItem('crewSharedData') || '{}');
    } catch (e) {
      data = {};
    }
    
    if (!data.messaging) {
      data.messaging = {
        channels: {
          'general': {
            id: 'general',
            name: 'General',
            icon: '💬',
            type: 'public',
            members: [],
            messages: [],
            createdAt: new Date().toISOString()
          },
          'urgent': {
            id: 'urgent',
            name: 'Urgent',
            icon: '🚨',
            type: 'public',
            members: [],
            messages: [],
            createdAt: new Date().toISOString()
          },
          'equipment': {
            id: 'equipment',
            name: 'Equipment',
            icon: '🛠️',
            type: 'public',
            members: [],
            messages: [],
            createdAt: new Date().toISOString()
          }
        },
        directMessages: {},
        conversations: {},
        unreadCounts: {}
      };
      
      localStorage.setItem('crewSharedData', JSON.stringify(data));
    }
    
    return data;
  }

  // Get messaging data
  function getMessagingData() {
    try {
      const data = JSON.parse(localStorage.getItem('crewSharedData') || '{}');
      return data.messaging || { channels: {}, directMessages: {}, conversations: {} };
    } catch (e) {
      return { channels: {}, directMessages: {}, conversations: {} };
    }
  }

  // Save messaging data
  function saveMessagingData(messagingData) {
    let data = {};
    try {
      data = JSON.parse(localStorage.getItem('crewSharedData') || '{}');
    } catch (e) {
      data = {};
    }
    data.messaging = messagingData;
    data.lastUpdate = new Date().toISOString();
    localStorage.setItem('crewSharedData', JSON.stringify(data));
    localStorage.setItem('crewMessagingUpdate', Date.now().toString());
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('crewMessagingUpdated', { detail: messagingData }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANNEL MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  const ChannelActions = {
    // Get all channels
    getAllChannels: function() {
      const messaging = getMessagingData();
      return Object.values(messaging.channels || {});
    },

    // Get channel by ID
    getChannel: function(channelId) {
      const messaging = getMessagingData();
      return (messaging.channels && messaging.channels[channelId]) || null;
    },

    // Create new channel
    createChannel: function(channelData) {
      const messaging = getMessagingData();
      
      const channel = {
        id: channelData.id || 'channel_' + Date.now(),
        name: channelData.name,
        icon: channelData.icon || '💬',
        type: channelData.type || 'public',
        members: channelData.members || [],
        messages: [],
        createdAt: new Date().toISOString(),
        createdBy: channelData.createdBy
      };
      
      if (!messaging.channels) messaging.channels = {};
      messaging.channels[channel.id] = channel;
      saveMessagingData(messaging);
      
      console.log('✅ Channel created:', channel.name);
      return channel;
    },

    // Send message to channel
    sendChannelMessage: function(channelId, message) {
      const messaging = getMessagingData();
      if (!messaging.channels) messaging.channels = {};
      const channel = messaging.channels[channelId];
      
      if (!channel) {
        console.error('Channel not found:', channelId);
        return null;
      }

      const user = window.CrewAuth ? window.CrewAuth.getCurrentUser() : null;

      // FIX: If the caller explicitly passes senderRole/senderName/senderId,
      // always honour those values. Only fall back to the logged-in user's
      // identity when the caller hasn't specified — this allows customer
      // messages to be stored with senderRole:'customer' even when an admin
      // is the one calling this function during backfill.
      const messageObj = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        channelId: channelId,
        text: message.text,
        senderId:   message.senderId   || (user ? user.email : 'system'),
        senderName: message.senderName || (user ? user.name  : 'System'),
        senderRole: message.senderRole || (user ? user.role  : 'system'),
        timestamp: new Date().toISOString(),
        attachments: message.attachments || [],
        mentions: message.mentions || [],
        reactions: {}
      };

      if (!channel.messages) channel.messages = [];
      channel.messages.push(messageObj);
      
      // Update unread counts for other users
      if (!messaging.unreadCounts) messaging.unreadCounts = {};
      Object.keys(messaging.unreadCounts).forEach(userId => {
        if (userId !== messageObj.senderId) {
          if (!messaging.unreadCounts[userId]) messaging.unreadCounts[userId] = {};
          messaging.unreadCounts[userId][channelId] = (messaging.unreadCounts[userId][channelId] || 0) + 1;
        }
      });
      
      saveMessagingData(messaging);
      
      console.log('💬 Message sent to', channel.name, ':', messageObj.text);
      return messageObj;
    },

    // Get channel messages
    getChannelMessages: function(channelId, limit) {
      limit = limit || 50;
      const messaging = getMessagingData();
      const channel = messaging.channels && messaging.channels[channelId];
      
      if (!channel) return [];
      
      return (channel.messages || []).slice(-limit);
    },

    // Mark channel as read
    markChannelAsRead: function(channelId) {
      const user = window.CrewAuth ? window.CrewAuth.getCurrentUser() : null;
      if (!user) return;

      const messaging = getMessagingData();
      if (!messaging.unreadCounts) messaging.unreadCounts = {};
      if (!messaging.unreadCounts[user.email]) messaging.unreadCounts[user.email] = {};
      
      messaging.unreadCounts[user.email][channelId] = 0;
      saveMessagingData(messaging);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DIRECT MESSAGING
  // ═══════════════════════════════════════════════════════════════════════════

  const DirectMessageActions = {
    // Get or create conversation between two users
    getConversation: function(userId1, userId2) {
      const messaging = getMessagingData();
      const conversationId = [userId1, userId2].sort().join('_');
      
      if (!messaging.conversations) messaging.conversations = {};
      if (!messaging.conversations[conversationId]) {
        messaging.conversations[conversationId] = {
          id: conversationId,
          participants: [userId1, userId2],
          messages: [],
          createdAt: new Date().toISOString()
        };
        saveMessagingData(messaging);
      }
      
      return messaging.conversations[conversationId];
    },

    // Send direct message
    sendDirectMessage: function(recipientId, message) {
      const user = window.CrewAuth ? window.CrewAuth.getCurrentUser() : null;
      if (!user) return null;

      const messaging = getMessagingData();
      if (!messaging.conversations) messaging.conversations = {};

      const conversationId = [user.email, recipientId].sort().join('_');
      if (!messaging.conversations[conversationId]) {
        messaging.conversations[conversationId] = {
          id: conversationId,
          participants: [user.email, recipientId],
          messages: [],
          createdAt: new Date().toISOString()
        };
      }
      const conversation = messaging.conversations[conversationId];
      
      const messageObj = {
        id: 'dm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        conversationId: conversation.id,
        text: message.text,
        senderId: user.email,
        senderName: user.name,
        recipientId: recipientId,
        timestamp: new Date().toISOString(),
        attachments: message.attachments || [],
        read: false
      };

      if (!conversation.messages) conversation.messages = [];
      conversation.messages.push(messageObj);
      
      // Update unread count
      if (!messaging.unreadCounts) messaging.unreadCounts = {};
      if (!messaging.unreadCounts[recipientId]) messaging.unreadCounts[recipientId] = {};
      messaging.unreadCounts[recipientId]['dm_' + user.email] = 
        (messaging.unreadCounts[recipientId]['dm_' + user.email] || 0) + 1;
      
      saveMessagingData(messaging);
      
      console.log('📨 DM sent to', recipientId, ':', messageObj.text);
      return messageObj;
    },

    // Get all conversations for a user
    getUserConversations: function() {
      const user = window.CrewAuth ? window.CrewAuth.getCurrentUser() : null;
      if (!user) return [];

      const messaging = getMessagingData();
      return Object.values(messaging.conversations || {}).filter(conv => 
        conv.participants && conv.participants.includes(user.email)
      );
    },

    // Get conversation messages
    getConversationMessages: function(conversationId) {
      const messaging = getMessagingData();
      const conversation = messaging.conversations && messaging.conversations[conversationId];
      return conversation ? (conversation.messages || []) : [];
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTACTS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  const ContactsActions = {
    // Get all contacts (users + workers)
    getAllContacts: function() {
      let data = {};
      try {
        data = JSON.parse(localStorage.getItem('crewSharedData') || '{}');
      } catch (e) {
        data = {};
      }
      const users = data.users || {};
      const workers = data.workers || {};
      
      const contacts = [];
      const seenEmails = new Set();
      
      // Add all users
      Object.values(users).forEach(function(user) {
        seenEmails.add(user.email);
        contacts.push({
          id: user.email,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          type: 'user',
          status: 'online',
          lastActive: user.lastActive
        });
      });
      
      // Add workers not already in users
      Object.values(workers).forEach(function(worker) {
        if (!seenEmails.has(worker.email)) {
          contacts.push({
            id: worker.email || worker.id,
            name: worker.name,
            email: worker.email,
            phone: worker.phone,
            role: worker.role,
            type: 'worker',
            status: worker.status,
            joinedAt: worker.joinedAt
          });
        }
      });
      
      return contacts;
    },

    // Get contacts by role
    getContactsByRole: function(role) {
      return this.getAllContacts().filter(function(contact) {
        return contact.role === role || (contact.role && contact.role.includes(role));
      });
    },

    // Get customers
    getCustomers: function() {
      return this.getContactsByRole('customer');
    },

    // Get crew members
    getCrewMembers: function() {
      const contacts = this.getAllContacts();
      return contacts.filter(function(c) {
        return c.role === 'crew_member' || c.role === 'crew_manager';
      });
    },

    // Search contacts
    searchContacts: function(query) {
      const contacts = this.getAllContacts();
      const lowerQuery = query.toLowerCase();
      
      return contacts.filter(function(contact) {
        return contact.name.toLowerCase().includes(lowerQuery) ||
          (contact.email && contact.email.toLowerCase().includes(lowerQuery)) ||
          (contact.phone && contact.phone.includes(lowerQuery));
      });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const NotificationActions = {
    // Get unread count for user
    getUnreadCount: function() {
      const user = window.CrewAuth ? window.CrewAuth.getCurrentUser() : null;
      if (!user) return 0;

      const messaging = getMessagingData();
      const userUnreads = (messaging.unreadCounts && messaging.unreadCounts[user.email]) || {};
      
      return Object.values(userUnreads).reduce(function(sum, count) { return sum + count; }, 0);
    },

    // Get unread by channel/conversation
    getUnreadByChannel: function(channelId) {
      const user = window.CrewAuth ? window.CrewAuth.getCurrentUser() : null;
      if (!user) return 0;

      const messaging = getMessagingData();
      const userUnreads = (messaging.unreadCounts && messaging.unreadCounts[user.email]) || {};
      
      return userUnreads[channelId] || 0;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT TO GLOBAL SCOPE
  // ═══════════════════════════════════════════════════════════════════════════

  window.CrewMessaging = {
    // Initialize
    init: initMessagingData,
    
    // Channel management
    Channels: ChannelActions,
    
    // Direct messages
    DirectMessages: DirectMessageActions,
    
    // Contacts
    Contacts: ContactsActions,
    
    // Notifications
    Notifications: NotificationActions,
    
    // Utility
    getData: getMessagingData
  };

  // Initialize on load (safe merge)
  initMessagingData();
  
  console.log('✅ Crew Messaging System Loaded');
  console.log('📊 Channels:', Object.keys(getMessagingData().channels || {}).length);
  console.log('👥 Contacts available:', ContactsActions.getAllContacts().length);

})();
