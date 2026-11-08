
/* =========================================================
   HENO CHAT — CONVERSATION ENGINE
   File: js/chat.js
   Messaging | Replies | Editing | Forwarding
   Search | Pin | Star | Realtime Adapter
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
    window.HENO?.toast(message, type);
  }

  function createId() {
    if (crypto.randomUUID) {
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

  /* =======================================================
     CHAT DATA
  ======================================================= */

  function normalizeChat(raw) {
    if (!raw?.id) {
      throw new Error("Invalid chat data.");
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
      unreadCount: Number(raw.unreadCount || 0),
      updatedAt: raw.updatedAt || null,
      muted: Boolean(raw.muted),
      archived: Boolean(raw.archived),
      pinned: Boolean(raw.pinned)
    };
  }

  function saveChat(raw) {
    const chat = normalizeChat(raw);

    state.chats.set(chat.id, chat);

    emit("chat-updated", { chat });

    return chat;
  }

  function getChat(chatId) {
    return state.chats.get(chatId) || null;
  }

  function getChats() {
    return [...state.chats.values()].sort((a, b) => {
      const timeA = a.updatedAt?.toMillis?.() ||
        Number(a.updatedAt || 0);

      const timeB = b.updatedAt?.toMillis?.() ||
        Number(b.updatedAt || 0);

      return timeB - timeA;
    });
  }

  function setActiveChat(chatId) {
    if (!state.chats.has(chatId)) {
      notify("المحادثة غير موجودة.", "error");
      return false;
    }

    state.activeChatId = chatId;
    state.replyTo = null;
    state.editingMessage = null;

    emit("chat-opened", {
      chat: getChat(chatId)
    });

    return true;
  }

  function closeActiveChat() {
    state.activeChatId = null;
    state.replyTo = null;
    state.editingMessage = null;

    emit("chat-closed");
  }

  /* =======================================================
     MESSAGE NORMALIZATION
  ======================================================= */

  function normalizeMessage(raw) {
    if (!raw?.id || !raw?.chatId) {
      throw new Error("Invalid message.");
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
    return state.messages.get(chatId) || [];
  }

  function saveMessage(raw) {
    const message = normalizeMessage(raw);

    const list = state.messages.get(message.chatId) || [];

    const existing = list.findIndex(
      item => item.id === message.id
    );

    if (existing >= 0) {
      list[existing] = message;
    } else {
      list.push(message);
    }

    list.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() ||
        Number(a.createdAt || 0);

      const timeB = b.createdAt?.toMillis?.() ||
        Number(b.createdAt || 0);

      return timeA - timeB;
    });

    state.messages.set(message.chatId, list);

    emit("message-updated", { message });

    return message;
  }

  /* =======================================================
     BACKEND ADAPTER
  ======================================================= */

  function backend() {
    const service = window.HENOChatBackend;

    if (!service) {
      throw new Error("CHAT_BACKEND_NOT_CONNECTED");
    }

    return service;
  }

  /* =======================================================
     SEND MESSAGE
  ======================================================= */

  async function sendMessage(chatId, text, options = {}) {
    const user = requireAuthenticatedUser();

    if (!user) return null;

    if (!chatId || !getChat(chatId)) {
      throw new Error("المحادثة غير متاحة.");
    }

    const cleanText = String(text || "").trim();

    if (!cleanText) {
      return null;
    }

    if (cleanText.length > config.maxMessageLength) {
      throw new Error("الرسالة أطول من الحد المسموح.");
    }

    const payload = {
      chatId,
      senderId: user.uid,
      type: "text",
      text: cleanText,
      replyTo: options.replyTo || state.replyTo || null,
      forwarded: Boolean(options.forwarded),
      forwardedFrom: options.forwardedFrom || null
    };

    emit("message-sending", { payload });

    try {
      const result = await backend().sendMessage(payload);

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
     EDIT MESSAGE
  ======================================================= */

  async function editMessage(chatId, messageId, newText) {
    const user = requireAuthenticatedUser();

    if (!user) return false;

    const text = String(newText || "").trim();

    if (!text || text.length > config.maxMessageLength) {
      throw new Error("نص الرسالة غير صالح.");
    }

    const message = getMessages(chatId).find(
      item => item.id === messageId
    );

    if (!message || message.senderId !== user.uid) {
      throw new Error("لا يمكنك تعديل هذه الرسالة.");
    }

    await backend().editMessage({
      chatId,
      messageId,
      text
    });

    emit("message-edited", {
      chatId,
      messageId
    });

    return true;
  }

  /* =======================================================
     DELETE MESSAGE
  ======================================================= */

  async function deleteMessage(
    chatId,
    messageId,
    forEveryone = false
  ) {
    const user = requireAuthenticatedUser();

    if (!user) return false;

    const message = getMessages(chatId).find(
      item => item.id === messageId
    );

    if (!message) {
      throw new Error("الرسالة غير موجودة.");
    }

    if (
      forEveryone &&
      message.senderId !== user.uid
    ) {
      throw new Error("لا يمكنك حذف رسالة شخص آخر للجميع.");
    }

    await backend().deleteMessage({
      chatId,
      messageId,
      forEveryone
    });

    emit("message-deleted", {
      chatId,
      messageId,
      forEveryone
    });

    return true;
  }

  /* =======================================================
     REPLY TO MESSAGE
  ======================================================= */

  function replyToMessage(messageId) {
    const chatId = state.activeChatId;

    if (!chatId) return null;

    const message = getMessages(chatId).find(
      item => item.id === messageId
    );

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

  /* =======================================================
     FORWARD MESSAGE
  ======================================================= */

  async function forwardMessage(
    sourceChatId,
    messageId,
    targetChatIds
  ) {
    requireAuthenticatedUser();

    const message = getMessages(sourceChatId).find(
      item => item.id === messageId
    );

    if (!message) {
      throw new Error("الرسالة غير موجودة.");
    }

    if (!Array.isArray(targetChatIds) || !targetChatIds.length) {
      throw new Error("اختر محادثة واحدة على الأقل.");
    }

    const result = await backend().forwardMessage({
      sourceChatId,
      messageId,
      targetChatIds
    });

    emit("message-forwarded", {
      sourceChatId,
      messageId,
      targetChatIds
    });

    return result;
  }

  /* =======================================================
     PIN MESSAGE
  ======================================================= */

  async function pinMessage(chatId, messageId, pinned = true) {
    requireAuthenticatedUser();

    await backend().pinMessage({
      chatId,
      messageId,
      pinned
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

  /* =======================================================
     STAR MESSAGE
  ======================================================= */

  async function starMessage(chatId, messageId, starred = true) {
    requireAuthenticatedUser();

    await backend().starMessage({
      chatId,
      messageId,
      starred
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

  /* =======================================================
     REACTIONS
  ======================================================= */

  async function reactToMessage(chatId, messageId, reaction) {
    requireAuthenticatedUser();

    if (!reaction || typeof reaction !== "string") {
      throw new Error("تفاعل غير صالح.");
    }

    await backend().reactToMessage({
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
     MESSAGE SEARCH
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
    requireAuthenticatedUser();

    const cleanQuery = String(query || "").trim();

    if (cleanQuery.length < 2) {
      return [];
    }

    return backend().searchMessages({
      query: cleanQuery
    });
  }

  /* =======================================================
     READ RECEIPTS
  ======================================================= */

  async function markAsRead(chatId, messageId) {
    requireAuthenticatedUser();

    await backend().markAsRead({
      chatId,
      messageId
    });

    emit("messages-read", {
      chatId,
      messageId
    });
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

    if (!allowed.includes(status)) return false;

    await backend().updateMessageStatus({
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
    const user = getCurrentUser();

    if (!user?.uid) return;

    await backend().setTyping({
      chatId,
      userId: user.uid,
      typing: Boolean(typing)
    });
  }

  /* =======================================================
     CREATE DIRECT CHAT
  ======================================================= */

  async function createDirectChat(targetUserId) {
    requireAuthenticatedUser();

    if (!targetUserId) {
      throw new Error("حدد المستخدم أولًا.");
    }

    const result = await backend().createDirectChat({
      targetUserId
    });

    return saveChat(result);
  }

  /* =======================================================
     CREATE GROUP
  ======================================================= */

  async function createGroup(title, memberIds = []) {
    requireAuthenticatedUser();

    const name = String(title || "").trim();

    if (name.length < 2) {
      throw new Error("اسم المجموعة قصير جدًا.");
    }

    if (!Array.isArray(memberIds) || !memberIds.length) {
      throw new Error("أضف عضوًا واحدًا على الأقل.");
    }

    const result = await backend().createGroup({
      title: name,
      memberIds
    });

    const chat = saveChat(result);

    emit("group-created", { chat });

    return chat;
  }

  /* =======================================================
     GROUP MEMBER MANAGEMENT
  ======================================================= */

  async function addGroupMember(chatId, userId) {
    requireAuthenticatedUser();

    return backend().addGroupMember({
      chatId,
      userId
    });
  }

  async function removeGroupMember(chatId, userId) {
    requireAuthenticatedUser();

    return backend().removeGroupMember({
      chatId,
      userId
    });
  }

  async function updateGroupInfo(chatId, changes) {
    requireAuthenticatedUser();

    return backend().updateGroupInfo({
      chatId,
      changes
    });
  }

  /* =======================================================
     CHAT MANAGEMENT
  ======================================================= */

  async function archiveChat(chatId, archived = true) {
    requireAuthenticatedUser();

    await backend().archiveChat({
      chatId,
      archived
    });

    emit("chat-archive-changed", {
      chatId,
      archived
    });
  }

  async function muteChat(chatId, muted = true) {
    requireAuthenticatedUser();

    await backend().muteChat({
      chatId,
      muted
    });

    emit("chat-mute-changed", {
      chatId,
      muted
    });
  }

  async function deleteChat(chatId) {
    requireAuthenticatedUser();

    await backend().deleteChat({ chatId });

    state.chats.delete(chatId);
    state.messages.delete(chatId);

    if (state.activeChatId === chatId) {
      closeActiveChat();
    }

    emit("chat-deleted", { chatId });
  }

  /* =======================================================
     REALTIME SUBSCRIPTIONS
  ======================================================= */

  function subscribeToChats() {
    const user = requireAuthenticatedUser();

    if (!user) return null;

    if (state.listeners.has("chats")) {
      return state.listeners.get("chats");
    }

    const unsubscribe = backend().subscribeToChats(
      user.uid,
      chats => {
        chats.forEach(saveChat);

        emit("chats-received", {
          chats: getChats()
        });
      },
      error => emit("realtime-error", { error })
    );

    state.listeners.set("chats", unsubscribe);

    return unsubscribe;
  }

  function subscribeToMessages(chatId) {
    requireAuthenticatedUser();

    const existing = state.listeners.get(`messages:${chatId}`);

    if (existing) existing();

    const unsubscribe = backend().subscribeToMessages(
      chatId,
      messages => {
        messages.forEach(saveMessage);

        emit("messages-received", {
          chatId,
          messages: getMessages(chatId)
        });
      },
      error => emit("realtime-error", { error })
    );

    state.listeners.set(`messages:${chatId}`, unsubscribe);

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

  /* =======================================================
     RENDER MESSAGE
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

    article.innerHTML = `
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
        ⋯
      </button>
    `;

    return article;
  }

  function formatTime(value) {
    if (!value) return "";

    let date;

    if (typeof value.toDate === "function") {
      date = value.toDate();
    } else {
      date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("ar-EG", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function renderMessageStatus(status) {
    const labels = {
      sent: "✓",
      delivered: "✓✓",
      read: "✓✓"
    };

    return `
      <span class="message-status message-status-${escapeHTML(status)}"
        aria-label="${escapeHTML(status)}">
        ${labels[status] || ""}
      </span>
    `;
  }

  /* =======================================================
     INITIALIZATION
  ======================================================= */

  function init() {
    if (state.initialized) return;

    state.initialized = true;

    document.dispatchEvent(
      new CustomEvent("heno:chat:initialized")
    );
  }

  /* =======================================================
     PUBLIC API
  ======================================================= */

  return {
    init,

    getChat,
    getChats,
    getMessages,
    saveChat,
    saveMessage,

    setActiveChat,
    closeActiveChat,

    sendMessage,
    editMessage,
    deleteMessage,

    replyToMessage,
    cancelReply,
    forwardMessage,

    pinMessage,
    starMessage,
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
    unsubscribeAll,

    renderMessage,
    formatTime
  };

})();

window.HENOChat = HENOChat;
HENOChat.init();
