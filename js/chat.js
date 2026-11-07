/* =========================================
   HENO CHAT — CHAT ENGINE
   Local conversation engine.
   Firebase sync will be added later.
========================================= */

const Chat = (() => {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const STORAGE_KEY = "heno_chat_data";

  const state = {
    conversations: [],
    activeConversationId: null,
    replyTo: null,
    searchQuery: "",
    editingMessageId: null
  };

  function uid() {
    return (
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 9)
    );
  }

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function formatTime(timestamp) {
    return new Intl.DateTimeFormat("ar-EG", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(timestamp));
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state.conversations)
      );
    } catch (error) {
      console.error("HENO chat storage error:", error);
      notify("تعذر حفظ المحادثات على هذا الجهاز");
    }
  }

  function load() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      state.conversations = Array.isArray(saved) ? saved : [];
    } catch {
      state.conversations = [];
    }
  }

  function notify(message) {
    if (typeof window.HENO?.toast === "function") {
      window.HENO.toast(message);
      return;
    }

    const toast = $("#toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  }

  function getConversation(id) {
    return state.conversations.find(
      conversation => conversation.id === id
    );
  }

  function getActiveConversation() {
    return getConversation(state.activeConversationId);
  }

  function createConversation(data = {}) {
    const conversation = {
      id: uid(),
      name: data.name || "محادثة جديدة",
      avatar: data.avatar || "",
      type: data.type || "private",
      online: Boolean(data.online),
      pinned: false,
      muted: false,
      archived: false,
      unread: 0,
      createdAt: Date.now(),
      messages: []
    };

    state.conversations.unshift(conversation);
    save();
    renderConversationList();

    return conversation;
  }

  function openConversation(id) {
    const conversation = getConversation(id);

    if (!conversation) {
      notify("المحادثة غير موجودة");
      return;
    }

    state.activeConversationId = id;
    state.replyTo = null;
    conversation.unread = 0;

    save();
    renderConversationList();
    renderMessages();
    updateConversationHeader();

    document.dispatchEvent(
      new CustomEvent("heno:conversation-opened", {
        detail: { conversationId: id }
      })
    );
  }

  function sendMessage(text, options = {}) {
    const conversation = getActiveConversation();

    if (!conversation) {
      notify("افتح محادثة أولًا");
      return null;
    }

    const content = String(text || "").trim();

    if (!content) return null;

    const message = {
      id: uid(),
      text: content,
      sender: "me",
      type: options.type || "text",
      timestamp: Date.now(),
      edited: false,
      deleted: false,
      replyTo: state.replyTo
        ? { ...state.replyTo }
        : null,
      reactions: [],
      pinned: false,
      starred: false
    };

    conversation.messages.push(message);

    state.replyTo = null;

    save();
    renderMessages();
    renderConversationList();

    document.dispatchEvent(
      new CustomEvent("heno:message-sent", {
        detail: {
          conversationId: conversation.id,
          message
        }
      })
    );

    return message;
  }

  function receiveMessage(conversationId, text, sender = "other") {
    const conversation = getConversation(conversationId);

    if (!conversation) return null;

    const message = {
      id: uid(),
      text: String(text || ""),
      sender,
      type: "text",
      timestamp: Date.now(),
      edited: false,
      deleted: false,
      replyTo: null,
      reactions: [],
      pinned: false,
      starred: false
    };

    conversation.messages.push(message);

    if (state.activeConversationId !== conversationId) {
      conversation.unread++;
    }

    save();
    renderMessages();
    renderConversationList();

    return message;
  }

  function editMessage(messageId, newText) {
    const conversation = getActiveConversation();
    if (!conversation) return;

    const message = conversation.messages.find(
      item => item.id === messageId
    );

    if (!message || message.sender !== "me") return;

    const text = String(newText || "").trim();
    if (!text) return;

    message.text = text;
    message.edited = true;

    save();
    renderMessages();
    notify("تم تعديل الرسالة");
  }

  function deleteMessage(messageId, forEveryone = false) {
    const conversation = getActiveConversation();
    if (!conversation) return;

    const message = conversation.messages.find(
      item => item.id === messageId
    );

    if (!message) return;

    if (forEveryone) {
      message.text = "تم حذف هذه الرسالة";
      message.deleted = true;
      message.type = "deleted";
    } else {
      conversation.messages = conversation.messages.filter(
        item => item.id !== messageId
      );
    }

    save();
    renderMessages();
    renderConversationList();
  }

  function setReply(messageId) {
    const conversation = getActiveConversation();
    if (!conversation) return;

    const message = conversation.messages.find(
      item => item.id === messageId
    );

    if (!message) return;

    state.replyTo = {
      id: message.id,
      text: message.text,
      sender: message.sender
    };

    const preview = $("#replyPreview");

    if (preview) {
      preview.hidden = false;
      preview.textContent = `الرد على: ${message.text}`;
    }

    $("#messageInput")?.focus();
  }

  function cancelReply() {
    state.replyTo = null;

    const preview = $("#replyPreview");

    if (preview) {
      preview.hidden = true;
      preview.textContent = "";
    }
  }

  function toggleReaction(messageId, emoji) {
    const conversation = getActiveConversation();
    if (!conversation) return;

    const message = conversation.messages.find(
      item => item.id === messageId
    );

    if (!message) return;

    const existing = message.reactions.find(
      reaction => reaction.emoji === emoji
    );

    if (existing) {
      existing.count++;

      if (existing.count > 1) {
        existing.count = 1;
      }
    } else {
      message.reactions.push({
        emoji,
        count: 1
      });
    }

    save();
    renderMessages();
  }

  function togglePin(messageId) {
    const conversation = getActiveConversation();
    if (!conversation) return;

    const message = conversation.messages.find(
      item => item.id === messageId
    );

    if (!message) return;

    message.pinned = !message.pinned;

    save();
    renderMessages();

    notify(
      message.pinned
        ? "تم تثبيت الرسالة"
        : "تم إلغاء تثبيت الرسالة"
    );
  }

  function toggleStar(messageId) {
    const conversation = getActiveConversation();
    if (!conversation) return;

    const message = conversation.messages.find(
      item => item.id === messageId
    );

    if (!message) return;

    message.starred = !message.starred;

    save();
    renderMessages();
  }

  function searchMessages(query) {
    state.searchQuery = String(query || "")
      .trim()
      .toLowerCase();

    renderMessages();
  }

  function renderConversationList() {
    const container = $("#chatList");
    if (!container) return;

    const conversations = state.conversations
      .filter(item => !item.archived)
      .filter(item => {
        const query = state.searchQuery;

        if (!query) return true;

        return (
          item.name.toLowerCase().includes(query) ||
          item.messages.some(message =>
            message.text.toLowerCase().includes(query)
          )
        );
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return Number(b.pinned) - Number(a.pinned);
        }

        return b.createdAt - a.createdAt;
      });

    if (!conversations.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>لا توجد محادثات حتى الآن</p>
        </div>
      `;
      return;
    }

    container.innerHTML = conversations.map(item => {
      const last = item.messages[item.messages.length - 1];

      return `
        <button
          class="chat-item ${
            state.activeConversationId === item.id ? "active" : ""
          }"
          data-chat-open="${escapeHTML(item.id)}"
          type="button"
        >
          <span class="chat-avatar">
            ${
              item.avatar
                ? `<img src="${escapeHTML(item.avatar)}" alt="">`
                : escapeHTML(item.name.slice(0, 1))
            }
          </span>

          <span class="chat-info">
            <strong>${escapeHTML(item.name)}</strong>
            <small>
              ${escapeHTML(last?.text || "ابدأ المحادثة")}
            </small>
          </span>

          <span class="chat-meta">
            ${
              last
                ? `<small>${formatTime(last.timestamp)}</small>`
                : ""
            }

            ${
              item.unread
                ? `<b class="unread-count">${item.unread}</b>`
                : ""
            }
          </span>
        </button>
      `;
    }).join("");
  }

  function renderMessages() {
    const container = $("#messagesContainer");
    const conversation = getActiveConversation();

    if (!container || !conversation) return;

    let messages = conversation.messages;

    if (state.searchQuery) {
      messages = messages.filter(message =>
        message.text.toLowerCase().includes(state.searchQuery)
      );
    }

    if (!messages.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>لا توجد رسائل هنا بعد</p>
          <small>ابدأ أول محادثة الآن</small>
        </div>
      `;
      return;
    }

    container.innerHTML = messages.map(message => {
      const mine = message.sender === "me";

      return `
        <article
          class="message ${mine ? "sent" : "received"}"
          data-message-id="${escapeHTML(message.id)}"
        >
          ${
            message.replyTo
              ? `
                <div class="message-reply">
                  ${escapeHTML(message.replyTo.text)}
                </div>
              `
              : ""
          }

          <div class="message-content">
            ${escapeHTML(message.text)}
          </div>

          <div class="message-footer">
            <time>${formatTime(message.timestamp)}</time>
            ${message.edited ? "<small>معدّلة</small>" : ""}
            ${message.pinned ? "<small>مثبّتة</small>" : ""}
            ${message.starred ? "<small>★</small>" : ""}
          </div>

          ${
            message.reactions.length
              ? `
                <div class="message-reactions">
                  ${message.reactions.map(reaction => `
                    <span>
                      ${escapeHTML(reaction.emoji)}
                      ${reaction.count}
                    </span>
                  `).join("")}
                </div>
              `
              : ""
          }

          <div class="message-actions">
            <button type="button"
              data-message-action="reply"
              data-message-id="${escapeHTML(message.id)}">
              رد
            </button>

            <button type="button"
              data-message-action="react"
              data-message-id="${escapeHTML(message.id)}">
              تفاعل
            </button>

            <button type="button"
              data-message-action="star"
              data-message-id="${escapeHTML(message.id)}">
              حفظ
            </button>

            <button type="button"
              data-message-action="pin"
              data-message-id="${escapeHTML(message.id)}">
              تثبيت
            </button>

            ${
              mine
                ? `
                  <button type="button"
                    data-message-action="edit"
                    data-message-id="${escapeHTML(message.id)}">
                    تعديل
                  </button>
                `
                : ""
            }

            <button type="button"
              data-message-action="delete"
              data-message-id="${escapeHTML(message.id)}">
              حذف
            </button>
          </div>
        </article>
      `;
    }).join("");

    container.scrollTop = container.scrollHeight;
  }

  function updateConversationHeader() {
    const conversation = getActiveConversation();
    if (!conversation) return;

    const name = $("#conversationName");
    const avatar = $("#conversationAvatar");
    const status = $("#conversationStatus");

    if (name) name.textContent = conversation.name;

    if (avatar) {
      avatar.textContent = conversation.avatar
        ? ""
        : conversation.name.slice(0, 1);

      if (conversation.avatar) {
        avatar.innerHTML = `
          <img src="${escapeHTML(conversation.avatar)}" alt="">
        `;
      }
    }

    if (status) {
      status.textContent = conversation.online
        ? "متصل الآن"
        : "غير متصل";
    }
  }

  function handleMessageAction(button) {
    const action = button.dataset.messageAction;
    const id = button.dataset.messageId;

    if (!action || !id) return;

    const conversation = getActiveConversation();
    const message = conversation?.messages.find(
      item => item.id === id
    );

    if (!message) return;

    switch (action) {
      case "reply":
        setReply(id);
        break;

      case "react":
        toggleReaction(id, "❤️");
        break;

      case "star":
        toggleStar(id);
        break;

      case "pin":
        togglePin(id);
        break;

      case "edit": {
        const updated = prompt("اكتب النص الجديد:", message.text);

        if (updated !== null) {
          editMessage(id, updated);
        }
        break;
      }

      case "delete":
        if (confirm("هل تريد حذف هذه الرسالة؟")) {
          deleteMessage(id);
        }
        break;
    }
  }

  function bindEvents() {
    $("#sendMessageButton")?.addEventListener("click", () => {
      const input = $("#messageInput");
      if (!input) return;

      sendMessage(input.value);
      input.value = "";
      cancelReply();
      input.focus();
    });

    $("#messageInput")?.addEventListener("keydown", event => {
      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        $("#sendMessageButton")?.click();
      }
    });

    $("#chatSearch")?.addEventListener("input", event => {
      state.searchQuery = event.target.value.toLowerCase();
      renderConversationList();
    });

    $("#messageSearch")?.addEventListener("input", event => {
      searchMessages(event.target.value);
    });

    $("#cancelReply")?.addEventListener("click", cancelReply);

    $("#chatList")?.addEventListener("click", event => {
      const button = event.target.closest("[data-chat-open]");
      if (!button) return;

      openConversation(button.dataset.chatOpen);
    });

    $("#messagesContainer")?.addEventListener("click", event => {
      const button = event.target.closest("[data-message-action]");
      if (!button) return;

      handleMessageAction(button);
    });
  }

  function init() {
    load();
    bindEvents();
    renderConversationList();

    document.dispatchEvent(
      new CustomEvent("heno:chat-ready")
    );
  }

  return {
    init,
    createConversation,
    openConversation,
    sendMessage,
    receiveMessage,
    editMessage,
    deleteMessage,
    setReply,
    cancelReply,
    toggleReaction,
    togglePin,
    toggleStar,
    searchMessages,
    renderConversationList,
    renderMessages,
    getActiveConversation,
    getConversation
  };
})();

window.HENOChat = Chat;
