/* =========================================
   HENO CHAT — SOCIAL SYSTEM
   Contacts, Friends, Requests, Status,
   Groups, Channels and Communities.
========================================= */

const Social = (() => {
  "use strict";

  const STORAGE_KEY = "heno_social_data";

  const state = {
    contacts: [],
    requests: [],
    statuses: [],
    groups: [],
    channels: [],
    communities: []
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

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

  function notify(message) {
    if (typeof window.HENO?.toast === "function") {
      window.HENO.toast(message);
      return;
    }

    const toast = $("#toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => toast.classList.remove("show"), 2500);
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch (error) {
      console.error("Social save error:", error);
      notify("تعذر حفظ البيانات على الجهاز");
    }
  }

  function load() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "{}"
      );

      Object.keys(state).forEach(key => {
        state[key] = Array.isArray(saved[key])
          ? saved[key]
          : [];
      });
    } catch {
      Object.keys(state).forEach(key => {
        state[key] = [];
      });
    }
  }

  function makeUser(data = {}) {
    return {
      id: uid(),
      name: String(data.name || "مستخدم HENO"),
      username: String(data.username || ""),
      code: String(data.code || ""),
      avatar: String(data.avatar || ""),
      bio: String(data.bio || ""),
      online: Boolean(data.online),
      createdAt: Date.now()
    };
  }

  // CONTACTS

  function addContact(data) {
    const user = makeUser(data);

    const exists = state.contacts.some(
      contact =>
        contact.code &&
        contact.code === user.code
    );

    if (exists) {
      notify("هذا الشخص موجود بالفعل في جهات الاتصال");
      return null;
    }

    state.contacts.unshift(user);
    save();
    renderContacts();

    notify("تمت إضافة جهة الاتصال");
    return user;
  }

  function removeContact(id) {
    state.contacts = state.contacts.filter(
      contact => contact.id !== id
    );

    save();
    renderContacts();
    notify("تم حذف جهة الاتصال");
  }

  function findContact(query) {
    const value = String(query || "")
      .trim()
      .toLowerCase();

    if (!value) return [];

    return state.contacts.filter(contact =>
      contact.name.toLowerCase().includes(value) ||
      contact.username.toLowerCase().includes(value) ||
      contact.code.toLowerCase().includes(value)
    );
  }

  // FRIEND REQUESTS

  function sendRequest(data) {
    if (!data || (!data.code && !data.username)) {
      notify("أدخل كود المستخدم أو اسم المستخدم");
      return null;
    }

    const request = {
      id: uid(),
      name: String(data.name || "مستخدم HENO"),
      username: String(data.username || ""),
      code: String(data.code || ""),
      avatar: String(data.avatar || ""),
      status: "pending",
      createdAt: Date.now()
    };

    state.requests.unshift(request);

    save();
    renderRequests();

    notify("تم تسجيل الطلب محليًا");
    return request;
  }

  function acceptRequest(id) {
    const request = state.requests.find(
      item => item.id === id
    );

    if (!request || request.status !== "pending") {
      return;
    }

    request.status = "accepted";

    const exists = state.contacts.some(
      contact => contact.code === request.code
    );

    if (!exists) {
      state.contacts.unshift({
        id: request.id,
        name: request.name,
        username: request.username,
        code: request.code,
        avatar: request.avatar,
        bio: "",
        online: false,
        createdAt: Date.now()
      });
    }

    save();
    renderRequests();
    renderContacts();

    notify("تم قبول الطلب");
  }

  function rejectRequest(id) {
    state.requests = state.requests.filter(
      item => item.id !== id
    );

    save();
    renderRequests();

    notify("تم رفض الطلب");
  }

  // STATUS / STORIES

  function addStatus(data) {
    if (!data || !data.content) {
      notify("أضف محتوى للحالة أولًا");
      return null;
    }

    const status = {
      id: uid(),
      type: data.type || "text",
      content: String(data.content),
      background: data.background || "",
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      views: [],
      reactions: []
    };

    state.statuses.unshift(status);

    save();
    renderStatuses();

    notify("تم نشر الحالة على هذا الجهاز");
    return status;
  }

  function getActiveStatuses() {
    const now = Date.now();

    state.statuses = state.statuses.filter(
      status => status.expiresAt > now
    );

    return state.statuses;
  }

  function viewStatus(id) {
    const status = state.statuses.find(
      item => item.id === id
    );

    if (!status) return;

    const viewer = "local-viewer";

    if (!status.views.includes(viewer)) {
      status.views.push(viewer);
      save();
    }

    const viewerElement = $("#statusViewer");
    if (!viewerElement) return;

    viewerElement.hidden = false;
    viewerElement.innerHTML = `
      <div class="status-viewer-content">
        <button type="button"
          data-status-close
          aria-label="إغلاق">×</button>

        <div class="status-viewer-text">
          ${escapeHTML(status.content)}
        </div>

        <small>
          ${new Date(status.createdAt).toLocaleString("ar-EG")}
        </small>
      </div>
    `;
  }

  function closeStatus() {
    const viewer = $("#statusViewer");
    if (viewer) viewer.hidden = true;
  }

  function reactToStatus(id, reaction = "❤️") {
    const status = state.statuses.find(
      item => item.id === id
    );

    if (!status) return;

    status.reactions.push({
      reaction,
      createdAt: Date.now()
    });

    save();
    renderStatuses();
  }

  // GROUPS

  function createGroup(data) {
    const name = String(data?.name || "").trim();

    if (name.length < 2) {
      notify("اسم المجموعة قصير جدًا");
      return null;
    }

    const group = {
      id: uid(),
      name,
      description: String(data.description || ""),
      avatar: String(data.avatar || ""),
      members: Array.isArray(data.members)
        ? [...new Set(data.members)]
        : [],
      admins: [],
      createdAt: Date.now(),
      messages: []
    };

    state.groups.unshift(group);

    save();
    renderGroups();

    notify("تم إنشاء المجموعة محليًا");
    return group;
  }

  function addGroupMember(groupId, member) {
    const group = state.groups.find(
      item => item.id === groupId
    );

    if (!group || !member) return;

    if (!group.members.includes(member)) {
      group.members.push(member);
      save();
      renderGroups();
    }
  }

  function removeGroupMember(groupId, member) {
    const group = state.groups.find(
      item => item.id === groupId
    );

    if (!group) return;

    group.members = group.members.filter(
      item => item !== member
    );

    save();
    renderGroups();
  }

  // CHANNELS

  function createChannel(data) {
    const name = String(data?.name || "").trim();

    if (name.length < 2) {
      notify("أدخل اسم القناة");
      return null;
    }

    const channel = {
      id: uid(),
      name,
      description: String(data.description || ""),
      avatar: String(data.avatar || ""),
      followers: [],
      posts: [],
      createdAt: Date.now()
    };

    state.channels.unshift(channel);

    save();
    renderChannels();

    notify("تم إنشاء القناة محليًا");
    return channel;
  }

  function followChannel(id) {
    const channel = state.channels.find(
      item => item.id === id
    );

    if (!channel) return;

    if (!channel.followers.includes("local-user")) {
      channel.followers.push("local-user");
    } else {
      channel.followers = channel.followers.filter(
        user => user !== "local-user"
      );
    }

    save();
    renderChannels();
  }

  function publishChannelPost(id, content) {
    const channel = state.channels.find(
      item => item.id === id
    );

    const text = String(content || "").trim();

    if (!channel || !text) return;

    channel.posts.unshift({
      id: uid(),
      content: text,
      createdAt: Date.now(),
      reactions: []
    });

    save();
    renderChannels();

    notify("تم نشر المنشور محليًا");
  }

  // COMMUNITIES

  function createCommunity(data) {
    const name = String(data?.name || "").trim();

    if (name.length < 2) {
      notify("أدخل اسم المجتمع");
      return null;
    }

    const community = {
      id: uid(),
      name,
      description: String(data.description || ""),
      avatar: String(data.avatar || ""),
      groups: [],
      members: [],
      createdAt: Date.now()
    };

    state.communities.unshift(community);

    save();
    renderCommunities();

    notify("تم إنشاء المجتمع محليًا");
    return community;
  }

  function joinCommunity(id) {
    const community = state.communities.find(
      item => item.id === id
    );

    if (!community) return;

    if (!community.members.includes("local-user")) {
      community.members.push("local-user");
    } else {
      community.members = community.members.filter(
        item => item !== "local-user"
      );
    }

    save();
    renderCommunities();
  }

  // RENDERING

  function renderContacts() {
    const container = $("#contactsList");
    if (!container) return;

    if (!state.contacts.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>لا توجد جهات اتصال بعد</p>
        </div>
      `;
      return;
    }

    container.innerHTML = state.contacts.map(contact => `
      <div class="contact-item">
        <div class="contact-avatar">
          ${
            contact.avatar
              ? `<img src="${escapeHTML(contact.avatar)}" alt="">`
              : escapeHTML(contact.name.slice(0, 1))
          }
        </div>

        <div class="contact-info">
          <strong>${escapeHTML(contact.name)}</strong>
          <small>${escapeHTML(contact.code)}</small>
        </div>

        <button type="button"
          data-contact-remove="${escapeHTML(contact.id)}">
          حذف
        </button>
      </div>
    `).join("");
  }

  function renderRequests() {
    const container = $("#friendRequests");
    if (!container) return;

    const pending = state.requests.filter(
      request => request.status === "pending"
    );

    container.innerHTML = pending.length
      ? pending.map(request => `
          <div class="request-item">
            <strong>${escapeHTML(request.name)}</strong>

            <button type="button"
              data-request-accept="${escapeHTML(request.id)}">
              قبول
            </button>

            <button type="button"
              data-request-reject="${escapeHTML(request.id)}">
              رفض
            </button>
          </div>
        `).join("")
      : `<div class="empty-state">لا توجد طلبات جديدة</div>`;
  }

  function renderStatuses() {
    const container = $("#statusList");
    if (!container) return;

    const statuses = getActiveStatuses();

    container.innerHTML = `
      <button type="button" data-status-create>
        + إضافة حالة
      </button>

      ${statuses.map(status => `
        <button type="button"
          class="status-item"
          data-status-open="${escapeHTML(status.id)}">
          <span class="status-avatar">H</span>
          <span>${escapeHTML(status.content.slice(0, 35))}</span>
        </button>
      `).join("")}
    `;
  }

  function renderGroups() {
    const container = $("#groupsList");
    if (!container) return;

    container.innerHTML = state.groups.length
      ? state.groups.map(group => `
          <div class="social-card">
            <strong>${escapeHTML(group.name)}</strong>
            <p>${escapeHTML(group.description)}</p>
            <small>${group.members.length} أعضاء</small>
          </div>
        `).join("")
      : `<div class="empty-state">لا توجد مجموعات بعد</div>`;
  }

  function renderChannels() {
    const container = $("#channelsList");
    if (!container) return;

    container.innerHTML = state.channels.length
      ? state.channels.map(channel => `
          <div class="social-card">
            <strong>${escapeHTML(channel.name)}</strong>
            <p>${escapeHTML(channel.description)}</p>
            <small>${channel.followers.length} متابعين</small>

            <button type="button"
              data-channel-follow="${escapeHTML(channel.id)}">
              ${
                channel.followers.includes("local-user")
                  ? "إلغاء المتابعة"
                  : "متابعة"
              }
            </button>
          </div>
        `).join("")
      : `<div class="empty-state">لا توجد قنوات بعد</div>`;
  }

  function renderCommunities() {
    const container = $("#communitiesList");
    if (!container) return;

    container.innerHTML = state.communities.length
      ? state.communities.map(community => `
          <div class="social-card">
            <strong>${escapeHTML(community.name)}</strong>
            <p>${escapeHTML(community.description)}</p>
            <small>${community.members.length} أعضاء</small>

            <button type="button"
              data-community-join="${escapeHTML(community.id)}">
              ${
                community.members.includes("local-user")
                  ? "مغادرة المجتمع"
                  : "انضمام"
              }
            </button>
          </div>
        `).join("")
      : `<div class="empty-state">لا توجد مجتمعات بعد</div>`;
  }

  // EVENT DELEGATION

  function bindEvents() {
    document.addEventListener("click", event => {
      const target = event.target.closest("button");
      if (!target) return;

      if (target.dataset.contactRemove) {
        removeContact(target.dataset.contactRemove);
      }

      if (target.dataset.requestAccept) {
        acceptRequest(target.dataset.requestAccept);
      }

      if (target.dataset.requestReject) {
        rejectRequest(target.dataset.requestReject);
      }

      if (target.dataset.statusOpen) {
        viewStatus(target.dataset.statusOpen);
      }

      if (target.hasAttribute("data-status-close")) {
        closeStatus();
      }

      if (target.dataset.channelFollow) {
        followChannel(target.dataset.channelFollow);
      }

      if (target.dataset.communityJoin) {
        joinCommunity(target.dataset.communityJoin);
      }
    });

    $("#friendSearch")?.addEventListener("input", event => {
      const results = findContact(event.target.value);
      const container = $("#contactSearchResults");

      if (!container) return;

      container.innerHTML = results.map(contact => `
        <div>${escapeHTML(contact.name)}</div>
      `).join("");
    });
  }

  function init() {
    load();
    bindEvents();

    renderContacts();
    renderRequests();
    renderStatuses();
    renderGroups();
    renderChannels();
    renderCommunities();

    document.dispatchEvent(
      new CustomEvent("heno:social-ready")
    );
  }

  return {
    init,
    addContact,
    removeContact,
    findContact,
    sendRequest,
    acceptRequest,
    rejectRequest,
    addStatus,
    getActiveStatuses,
    viewStatus,
    closeStatus,
    reactToStatus,
    createGroup,
    addGroupMember,
    removeGroupMember,
    createChannel,
    followChannel,
    publishChannelPost,
    createCommunity,
    joinCommunity,
    renderContacts,
    renderRequests,
    renderStatuses,
    renderGroups,
    renderChannels,
    renderCommunities
  };
})();

window.HENOSocial = Social;
