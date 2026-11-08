
/* =========================================================
   HENO CHAT — ADVANCED CONVERSATION ENGINE
   File: js/chat.js
   Version: 1.1.0

   FEATURES:
   Direct Chats | Group Chats
   Messages | Replies | Editing | Deleting
   Forwarding | Pinning | Starred Messages
   Reactions | Search | Read Receipts
   Typing Indicators | Realtime Subscriptions
   Archive | Mute | Group Management

   Requires:
   window.HENOAuthBackend
   window.HENOChatBackend
========================================================= */

const HENOChat = (() => {
  "use strict";

  const state = {
    activeChatId: null,
    chats: new Map(),
    messages: new Map(),
    listeners: new Map(),
    searchQuery: "",
    replyTo: null,
    editingMessage: null,
    pinnedMessages: new Set(),
    starredMessages: new Set(),
    initialized: false
  };

  const config = {
    maxMessageLength: 10000,
    pageSize: 40
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);

  function emit(name, detail = {}) {
    document.dispatchEvent(
      new CustomEvent(`heno:chat:${name}`, { detail })
    );
  }

  function notify(message, type = "info") {
    if (typeof window.HENO?.toast === "function") {
      window.HENO.toast(message, type);
    } else {
      console.log(`[HENO CHAT] ${message}`);
    }
  }

  function createId() {
    if (typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return [
      Date.now().toString(36),
      Math.random().toString(36).slice(2)
    ].join("-");
  }

  function getCurrentUser() {
    return window.HENOAuthBackend?.currentUser || null;
  }

  function requireAuthenticatedUser() {
    const user = getCurrentUser();

    if (!user?.uid) {
      notify("سجّل الدخول أولًا لاستخدام المحادثات.", "error");
      return null;
    }

    return user;
  }

  function getBackendMethod(method) {
    const service = window.HENOChatBackend;

    if (!service || typeof service[method] !== "function") {
      throw new Error(
        `خدمة المحادثات غير متصلة أو أن الوظيفة ${method} غير مهيأة.`
      );
    }

    return service[method].bind(service);
  }

  async function callBackend(method, payload) {
    return getBackendMethod(method)(payload);
  }

  function getTimestamp(value) {
    if (!value) return 0;

    if (typeof value.toMillis === "function") {
      return value.toMillis();
    }

    if (typeof value.toDate === "function") {
      return value.toDate().getTime();
    }

    const number = Number(value);

    if (Number.isFinite(number)) return number;

    const date = new Date(value).getTime();

    return Number.isFinite(date) ? date : 0;
  }

  /* =======================================================
     CHAT DATA
  ======================================================= */

  function normalizeChat(raw) {
    if (!raw?.id) {
      throw new Error("بيانات المحادثة غير صحيحة.");
    }

    return {
      id: String(raw.id),
      type: raw.type === "group" ? "group" : "direct",
      title: String(raw.title || ""),
      photoURL: raw.photoURL || null,
      participants: Array.isArray(raw.participants)
        ? raw.participants
        : [],
      lastMessage: raw.lastMessage || null,
      unreadCount: Math.max(0, Number(raw.unreadCount || 0)),
      updatedAt: raw.updatedAt || null,
      muted: Boolean(raw.muted),
      archived: Boolean(raw.archived),
      pinned: Boolean(raw.pinned),
      metadata: raw.metadata || {}
    };
  }

  function saveChat(raw) {
    const chat = normalizeChat(raw);

    state.chats.set(chat.id, chat);

    emit("chat-updated", { chat });

    return chat;
  }

  function getChat(chatId) {
    return state.chats.get(String(chatId)) || null;
  }

  function getChats() {
    return [...state.chats.values()].sort(
      (a, b) =>
        getTimestamp(b.updatedAt) -
        getTimestamp(a.updatedAt)
    );
  }

  function getArchivedChats() {
    return getChats().filter(chat => chat.archived);
  }

  function getUnarchivedChats() {
    return getChats().filter(chat => !chat.archived);
  }

  function setActiveChat(chatId) {
    const chat = getChat(chatId);

    if (!chat) {
      notify("المحادثة غير موجودة.", "error");
      return false;
    }

    state.activeChatId = chat.id;
    state.replyTo = null;
    state.editingMessage = null;

    emit("chat-opened", { chat });

    return true;
  }

  function closeActiveChat() {
    state.activeChatId = null;
    state.replyTo = null;
    state.editingMessage = null;

    emit("chat-closed");
  }

  /* =======================================================
     MESSAGE DATA
  ======================================================= */

  function normalizeMessage(raw) {
    if (!raw?.id || !raw?.chatId) {
      throw new Error("بيانات الرسالة غير صحيحة.");
    }

    return {
      id: String(raw.id),
      chatId: String(raw.chatId),
      senderId: String(raw.senderId || ""),
      type: raw.type || "text",
      text: String(raw.text || ""),
      createdAt: raw.createdAt || null,
      editedAt: raw.editedAt || null,
      replyTo: raw.replyTo || null,
      forwarded: Boolean(raw.forwarded),
      forwardedFrom: raw.forwardedFrom || null,
      pinned: Boolean(raw.pinned),
      starred: Boolean(raw.starred),
      deleted: Boolean(raw.deleted),
      deletedForEveryone: Boolean(raw.deletedForEveryone),
      attachments: Array.isArray(raw.attachments)
        ? raw.attachments
        : [],
      status: raw.status || "sent",
      reactions: raw.reactions || {},
      metadata: raw.metadata || {}
    };
  }

  function getMessages(chatId) {
    return state.messages.get(String(chatId)) || [];
  }

  function saveMessage(raw) {
    const message = normalizeMessage(raw);

    const list =
      state.messages.get(message.chatId) || [];

    const existing = list.findIndex(
      item => item.id === message.id
    );

    if (existing >= 0) {
      list[existing] = message;
    } else {
      list.push(message);
    }

    list.sort(
      (a, b) =>
        getTimestamp(a.createdAt) -
        getTimestamp(b.createdAt)
    );

    state.messages.set(message.chatId, list);

    emit("message-updated", { message });

    return message;
  }

  function getMessage(chatId, messageId) {
    return getMessages(chatId).find(
      message => message.id === String(messageId)
    ) || null;
  }

  /* =======================================================
     MESSAGE SENDING
  ======================================================= */

  async function sendMessage(chatId, text, options = {}) {
    const user = requireAuthenticatedUser();

    if (!user) return null;

    if (!getChat(chatId)) {
      throw new Error("المحادثة غير متاحة.");
    }

    const cleanText = String(text || "").trim();

    if (!cleanText) return null;

    if (cleanText.length > config.maxMessageLength) {
      throw new Error("الرسالة أطول من الحد المسموح.");
    }

    const payload = {
      chatId: String(chatId),
      senderId: user.uid,
      type: "text",
      text: cleanText,
      replyTo: options.replyTo || state.replyTo || null,
      forwarded: Boolean(options.forwarded),
      forwardedFrom: options.forwardedFrom || null
    };

    emit("message-sending", { payload });

    try {
      const result = await callBackend(
        "sendMessage",
        payload
      );

      const message = saveMessage(result);

      state.replyTo = null;
      state.editingMessage = null;

      emit("message-sent", { message });

      return message;

    } catch (error) {
      emit("message-send-error", { error });
      throw error;
    }
  }

  /* =======================================================
     MESSAGE EDITING
  ======================================================= */

  async function editMessage(chatId, messageId, newText) {
    const user = requireAuthenticatedUser();

    if (!user) return false;

    const text = String(newText || "").trim();

    if (!text || text.length > config.maxMessageLength) {
      throw new Error("نص الرسالة غير صالح.");
    }

    const message = getMessage(chatId, messageId);

    if (!message || message.senderId !== user.uid) {
      throw new Error("لا يمكنك تعديل هذه الرسالة.");
    }

    await callBackend("editMessage", {
      chatId,
      messageId,
      text
    });

    emit("message-edited", {
      chatId,
      messageId,
      text
    });

    return true;
  }

  function startEditingMessage(chatId, messageId) {
    const user = requireAuthenticatedUser();

    if (!user) return null;

    const message = getMessage(chatId, messageId);

    if (!message || message.senderId !== user.uid) {
      notify("لا يمكنك تعديل هذه الرسالة.", "error");
      return null;
    }

    state.editingMessage = {
      chatId,
      messageId,
      text: message.text
    };

    emit("message-edit-started", {
      message: state.editingMessage
    });

    return state.editingMessage;
  }

  function cancelEditingMessage() {
    state.editingMessage = null;
    emit("message-edit-cancelled");
  }

  /* =======================================================
     MESSAGE DELETION
  ======================================================= */

  async function deleteMessage(
    chatId,
    messageId,
    forEveryone = false
  ) {
    const user = requireAuthenticatedUser();

    if (!user) return false;

    const message = getMessage(chatId, messageId);

    if (!message) {
      throw new Error("الرسالة غير موجودة.");
    }

    if (
      forEveryone &&
      message.senderId !== user.uid
    ) {
      throw new Error(
        "لا يمكنك حذف رسالة شخص آخر للجميع."
      );
    }

    await callBackend("deleteMessage", {
      chatId,
      messageId,
      forEveryone: Boolean(forEveryone)
    });

    emit("message-deleted", {
      chatId,
      messageId,
      forEveryone
    });

    return true;
  }

  /* =======================================================
     REPLY
  ======================================================= */

  function replyToMessage(messageId) {
    const chatId = state.activeChatId;

    if (!chatId) return null;

    const message = getMessage(chatId, messageId);

    if (!message) return null;

    state.replyTo = {
      id: message.id,
      senderId: message.senderId,
      text: message.text,
      type: message.type
    };

    emit("reply-selected", {
      message: state.replyTo
    });

    return state.replyTo;
  }

  function cancelReply() {
    state.replyTo = null;
    emit("reply-cancelled");
  }

  function getReplyTarget() {
    return state.replyTo;
  }

  /* =======================================================
     FORWARDING
  ======================================================= */

  async function forwardMessage(
    sourceChatId,
    messageId,
    targetChatIds
  ) {
    const user = requireAuthenticatedUser();

    if (!user) return false;

    const message = getMessage(sourceChatId, messageId);

    if (!message || message.deleted) {
      throw new Error("الرسالة غير متاحة لإعادة التوجيه.");
    }

    if (
      !Array.isArray(targetChatIds) ||
      !targetChatIds.length
    ) {
      throw new Error("اختر محادثة واحدة على الأقل.");
    }

    const uniqueTargets = [
      ...new Set(targetChatIds.map(String))
    ];

    for (const chatId of uniqueTargets) {
      if (!getChat(chatId)) {
        throw new Error("إحدى المحادثات المحددة غير متاحة.");
      }
    }

    const result = await callBackend(
      "forwardMessage",
      {
        sourceChatId,
        messageId,
        targetChatIds: uniqueTargets
      }
    );

    emit("message-forwarded", {
      sourceChatId,
      messageId,
      targetChatIds: uniqueTargets,
      result
    });

    return result;
  }

  /* =======================================================
     PIN MESSAGES
  ======================================================= */

  async function pinMessage(
    chatId,
    messageId,
    pinned = true
  ) {
    const user = requireAuthenticatedUser();

    if (!user) return false;

    if (!getMessage(chatId, messageId)) {
      throw new Error("الرسالة غير موجودة.");
    }

    await callBackend("pinMessage", {
      chatId,
      messageId,
      pinned: Boolean(pinned)
    });

    if (pinned) {
      state.pinnedMessages.add(messageId);
    } else {
      state.pinnedMessages.delete(messageId);
    }

    emit("message-pin-changed", {
      chatId,
      messageId,
      pinned
    });

    return true;
  }

  function getPinnedMessages(chatId) {
    return getMessages(chatId).filter(
      message =>
        message.pinned ||
        state.pinnedMessages.has(message.id)
    );
  }

  /* =======================================================
     STAR MESSAGES
  ======================================================= */

  async function starMessage(
    chatId,
    messageId,
    starred = true
  ) {
    const user = requireAuthenticatedUser();

    if (!user) return false;

    if (!getMessage(chatId, messageId)) {
      throw new Error("الرسالة غير موجودة.");
    }

    await callBackend("starMessage", {
      chatId,
      messageId,
      starred: Boolean(starred)
    });

    if (starred) {
      state.starredMessages.add(messageId);
    } else {
      state.starredMessages.delete(messageId);
    }

    emit("message-star-changed", {
      chatId,
      messageId,
      starred
    });

    return true;
  }

  function getStarredMessages() {
    const results = [];

    for (const messages of state.messages.values()) {
      for (const message of messages) {
        if (
          message.starred ||
          state.starredMessages.has(message.id)
        ) {
          results.push(message);
        }
      }
    }

    return results;
  }

  /* =======================================================
     REACTIONS
  ======================================================= */

  async function reactToMessage(
    chatId,
    messageId,
    reaction
  ) {
    const user = requireAuthenticatedUser();

    if (!user) return false;

    if (!getMessage(chatId, messageId)) {
      throw new Error("الرسالة غير موجودة.");
    }

    if (
      typeof reaction !== "string" ||
      !reaction.trim() ||
      reaction.length > 32
    ) {
      throw new Error("التفاعل غير صالح.");
    }

    await callBackend("reactToMessage", {
      chatId,
      messageId,
      reaction
    });

    emit("message-reaction", {
      chatId,
      messageId,
      reaction
    });

    return true;
  }

  /* =======================================================
     SEARCH
  ======================================================= */

  function searchMessages(chatId, query) {
    const cleanQuery = String(query || "")
      .trim()
      .toLowerCase();

    state.searchQuery = cleanQuery;

    if (!cleanQuery) {
      return getMessages(chatId);
    }

    return getMessages(chatId).filter(message =>
      !message.deleted &&
      message.text.toLowerCase().includes(cleanQuery)
    );
  }

  async function searchAllMessages(query) {
    const user = requireAuthenticatedUser();

    if (!user) return [];

    const cleanQuery = String(query || "").trim();

    if (cleanQuery.length < 2) return [];

    return callBackend("searchMessages", {
      query: cleanQuery
    });
  }

  /* =======================================================
     READ RECEIPTS
  ======================================================= */

  async function markAsRead(chatId, messageId) {
    const user = requireAuthenticatedUser();

    if (!user) return false;

    await callBackend("markAsRead", {
      chatId,
      messageId
    });

    emit("messages-read", {
      chatId,
      messageId
    });

    return true;
  }

  async function updateMessageStatus(
    chatId,
    messageId,
    status
  ) {
    const allowed = [
      "sent",
      "delivered",
      "read"
    ];

    if (!allowed.includes(status)) {
      throw new Error("حالة الرسالة غير صحيحة.");
    }

    const user = requireAuthenticatedUser();

    if (!user) return false;

    await callBackend("updateMessageStatus", {
      chatId,
      messageId,
      status
    });

    emit("message-status", {
      chatId,
      messageId,
      status
    });

    return true;
  }

  /* =======================================================
     TYPING INDICATOR
  ======================================================= */

  async function setTyping(chatId, typing) {
    const user = requireAuthenticatedUser();

    if (!user) return false;

    await callBackend("setTyping", {
      chatId,
      userId: user.uid,
      typing: Boolean(typing)
    });

    emit("typing-changed", {
      chatId,
      userId: user.uid,
      typing: Boolean(typing)
    });

    return true;
  }

  /* =======================================================
     DIRECT CHAT
  ======================================================= */

  async function createDirectChat(targetUserId) {
    const user = requireAuthenticatedUser();

    if (!user) return null;

    if (!targetUserId || targetUserId === user.uid) {
      throw new Error("حدد مستخدمًا آخر لبدء المحادثة.");
    }

    const result = await callBackend(
      "createDirectChat",
      { targetUserId }
    );

    const chat = saveChat(result);

    emit("direct-chat-created", { chat });

    return chat;
  }

  /* =======================================================
     GROUP CREATION
  ======================================================= */

  async function createGroup(title, memberIds = []) {
    const user = requireAuthenticatedUser();

    if (!user) return null;

    const name = String(title || "").trim();

    if (name.length < 2 || name.length > 80) {
      throw new Error("اسم المجموعة يجب أن يكون من 2 إلى 80 حرفًا.");
    }

    if (!Array.isArray(memberIds) || !memberIds.length) {
      throw new Error("أضف عضوًا واحدًا على الأقل.");
    }

    const members = [
      ...new Set(
        [user.uid, ...memberIds.map(String)]
      )
    ];

    const result = await callBackend(
      "createGroup",
      {
        title: name,
        memberIds: members
      }
    );

    const chat = saveChat(result);

    emit("group-created", { chat });

    return chat;
  }

  /* =======================================================
     GROUP MEMBERS
  ======================================================= */

  async function addGroupMember(chatId, userId) {
    const user = requireAuthenticatedUser();

    if (!user) return false;

    if (!userId) {
      throw new Error("حدد العضو الذي تريد إضافته.");
    }

    return callBackend("addGroupMember", {
      chatId,
      userId
    });
  }

  async function removeGroupMember(chatId, userId) {
    const user = requireAuthenticatedUser();

    if (!user) return false;

    if (!userId) {
      throw new Error("حدد العضو الذي تريد إزالته.");
    }

    return callBackend("removeGroupMember", {
      chatId,
      userId
    });
  }

  async function updateGroupInfo(chatId, changes) {
    const user = requireAuthenticatedUser();

    if (!user) return false;

    if (!changes || typeof changes !== "object") {
      throw new Error("بيانات المجموعة غير صحيحة.");
    }

    return callBackend("updateGroupInfo", {
      chatId,
      changes
    });
  }

  /* =======================================================
     CHAT MANAGEMENT
  ======================================================= */

  async function archiveChat(chatId, archived = true) {
    const user = requireAuthenticatedUser();

    if (!user) return false;

    await callBackend("archiveChat", {
      chatId,
      archived: Boolean(archived)
    });

    const chat = getChat(chatId);

    if (chat) {
      chat.archived = Boolean(archived);
      emit("chat-updated", { chat });
    }

    emit("chat-archive-changed", {
      chatId,
      archived
    });

    return true;
  }

  async function muteChat(chatId, muted = true) {
    const user = requireAuthenticatedUser();

    if (!user) return false;

    await callBackend("muteChat", {
      chatId,
      muted: Boolean(muted)
    });

    const chat = getChat(chatId);

    if (chat) {
      chat.muted = Boolean(muted);
      emit("chat-updated", { chat });
    }

    emit("chat-mute-changed", {
      chatId,
      muted
    });

    return true;
  }

  async function deleteChat(chatId) {
    const user = requireAuthenticatedUser();

    if (!user) return false;

    await callBackend("deleteChat", { chatId });

    state.chats.delete(chatId);
    state.messages.delete(chatId);

    if (state.activeChatId === chatId) {
      closeActiveChat();
    }

    emit("chat-deleted", { chatId });

    return true;
  }

  /* =======================================================
     REALTIME CHAT SUBSCRIPTION
  ======================================================= */

  function subscribeToChats() {
    const user = requireAuthenticatedUser();

    if (!user) return null;

    if (state.listeners.has("chats")) {
      return state.listeners.get("chats");
    }

    const subscribe = getBackendMethod("subscribeToChats");

    const unsubscribe = subscribe(
      user.uid,

      chats => {
        if (!Array.isArray(chats)) return;

        chats.forEach(saveChat);

        emit("chats-received", {
          chats: getChats()
        });
      },

      error => {
        emit("realtime-error", { error });
      }
    );

    if (typeof unsubscribe === "function") {
      state.listeners.set("chats", unsubscribe);
    }

    return unsubscribe;
  }

  function subscribeToMessages(chatId) {
    const user = requireAuthenticatedUser();

    if (!user) return null;

    if (!getChat(chatId)) {
      throw new Error("المحادثة غير موجودة.");
    }

    const key = `messages:${chatId}`;

    const previous = state.listeners.get(key);

    if (typeof previous === "function") {
      previous();
    }

    const subscribe = getBackendMethod(
      "subscribeToMessages"
    );

    const unsubscribe = subscribe(
      chatId,

      messages => {
        if (!Array.isArray(messages)) return;

        messages.forEach(saveMessage);

        emit("messages-received", {
          chatId,
          messages: getMessages(chatId)
        });
      },

      error => {
        emit("realtime-error", { error });
      }
    );

    if (typeof unsubscribe === "function") {
      state.listeners.set(key, unsubscribe);
    }

    return unsubscribe;
  }

  function unsubscribeAll() {
    for (const unsubscribe of state.listeners.values()) {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    }

    state.listeners.clear();
  }

  function unsubscribeFromChat(chatId) {
    const key = `messages:${chatId}`;
    const unsubscribe = state.listeners.get(key);

    if (typeof unsubscribe === "function") {
      unsubscribe();
    }

    state.listeners.delete(key);
  }

  /* =======================================================
     MESSAGE DISPLAY
  ======================================================= */

  function renderMessage(message) {
    const user = getCurrentUser();

    const mine = user?.uid === message.senderId;

    const article = document.createElement("article");

    article.className = mine
      ? "heno-message heno-message-mine"
      : "heno-message heno-message-other";

    article.dataset.messageId = message.id;

    if (message.deleted) {
      article.innerHTML = `
        <div class="message-deleted">
          تم حذف هذه الرسالة
        </div>
      `;

      return article;
    }

    const reply = message.replyTo
      ? `
        <div class="message-reply-preview">
          ${escapeHTML(message.replyTo.text || "رسالة")}
        </div>
      `
      : "";

    const forwarded = message.forwarded
      ? `<div class="message-forwarded">رسالة معاد توجيهها</div>`
      : "";

    article.innerHTML = `
      ${forwarded}

      <div class="message-content">
        ${reply}
        <p class="message-text">${escapeHTML(message.text)}</p>
      </div>

      <footer class="message-meta">
        <time>${formatTime(message.createdAt)}</time>
        ${mine ? renderMessageStatus(message.status) : ""}
      </footer>

      <button
        type="button"
        class="message-menu-trigger"
        data-message-action="menu"
        aria-label="خيارات الرسالة"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <circle cx="5" cy="12" r="1"></circle>
          <circle cx="12" cy="12" r="1"></circle>
          <circle cx="19" cy="12" r="1"></circle>
        </svg>
      </button>
    `;

    return article;
  }

  function formatTime(value) {
    if (!value) return "";

    const timestamp = getTimestamp(value);

    if (!timestamp) return "";

    return new Intl.DateTimeFormat("ar-EG", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(timestamp));
  }

  function renderMessageStatus(status) {
    const labels = {
      sent: "✓",
      delivered: "✓✓",
      read: "✓✓"
    };

    return `
      <span
        class="message-status message-status-${escapeHTML(status)}"
        aria-label="${escapeHTML(status)}"
      >
        ${labels[status] || ""}
      </span>
    `;
  }

  function renderMessageList(chatId, container) {
    if (!container) return;

    const messages = getMessages(chatId);

    container.replaceChildren();

    for (const message of messages) {
      container.appendChild(renderMessage(message));
    }
  }

  /* =======================================================
     CLEANUP
  ======================================================= */

  function reset() {
    unsubscribeAll();

    state.activeChatId = null;
    state.chats.clear();
    state.messages.clear();
    state.replyTo = null;
    state.editingMessage = null;
    state.pinnedMessages.clear();
    state.starredMessages.clear();
    state.searchQuery = "";

    emit("chat-state-reset");
  }

  /* =======================================================
     INITIALIZATION
  ======================================================= */

  function init() {
    if (state.initialized) return;

    state.initialized = true;

    emit("initialized", {
      version: "1.1.0"
    });
  }

  /* =======================================================
     PUBLIC API
  ======================================================= */

  return {
    init,
    createId,

    getChat,
    getChats,
    getArchivedChats,
    getUnarchivedChats,

    saveChat,
    getMessages,
    getMessage,
    saveMessage,

    setActiveChat,
    closeActiveChat,

    sendMessage,
    editMessage,
    startEditingMessage,
    cancelEditingMessage,
    deleteMessage,

    replyToMessage,
    cancelReply,
    getReplyTarget,

    forwardMessage,

    pinMessage,
    getPinnedMessages,

    starMessage,
    getStarredMessages,

    reactToMessage,

    searchMessages,
    searchAllMessages,

    markAsRead,
    updateMessageStatus,
    setTyping,

    createDirectChat,
    createGroup,

    addGroupMember,
    removeGroupMember,
    updateGroupInfo,

    archiveChat,
    muteChat,
    deleteChat,

    subscribeToChats,
    subscribeToMessages,
    unsubscribeFromChat,
    unsubscribeAll,

    renderMessage,
    renderMessageList,
    formatTime,

    reset
  };

})();

window.HENOChat = HENOChat;
HENOChat.init();
