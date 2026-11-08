
/* =========================================================
   HENO CHAT — MAIN APPLICATION ENGINE
   File: js/app.js
   Version: 1.0.0
   Mobile First | Arabic RTL | Modular Architecture
========================================================= */

const HENO = (() => {
  "use strict";

  /* -------------------------
     APPLICATION CONFIGURATION
  ------------------------- */

  const CONFIG = {
    name: "HENO CHAT",
    version: "1.0.0",
    splashDuration: 5000,
    defaultPage: "chats",
    direction: "rtl"
  };

  const state = {
    initialized: false,
    previewMode: false,
    currentPage: CONFIG.defaultPage,
    previousPage: null,
    sidebarOpen: false,
    modalOpen: false,
    activeTab: "login"
  };

  const elements = {};

  /* -------------------------
     DOM HELPERS
  ------------------------- */

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  function cacheElements() {
    elements.splash = $("#splash");
    elements.auth = $("#auth-screen");
    elements.app = $("#app-screen");

    elements.previewButton = $("#preview-button");
    elements.pageContainer = $("#page-container");

    elements.sidebar = $("#app-sidebar");
    elements.main = $("#app-main");
    elements.header = $("#app-header");

    elements.modalLayer = $("#modal-layer");
    elements.toastRegion = $("#toast-region");
  }

  /* -------------------------
     SAFE UTILITIES
  ------------------------- */

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function showElement(element) {
    if (!element) return;
    element.hidden = false;
    element.style.display = "";
    element.classList.remove("is-hidden");
  }

  function hideElement(element) {
    if (!element) return;
    element.hidden = true;
    element.classList.add("is-hidden");
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  /* -------------------------
     TOAST NOTIFICATIONS
  ------------------------- */

  function toast(message, type = "info") {
    if (!elements.toastRegion) {
      console.log(`[HENO ${type}]`, message);
      return;
    }

    const item = document.createElement("div");
    item.className = `heno-toast heno-toast-${type}`;
    item.setAttribute("role", "status");

    const icon = document.createElement("span");
    icon.className = "heno-toast-indicator";
    icon.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.textContent = message;

    item.append(icon, text);
    elements.toastRegion.appendChild(item);

    requestAnimationFrame(() => {
      item.classList.add("visible");
    });

    window.setTimeout(() => {
      item.classList.remove("visible");

      window.setTimeout(() => item.remove(), 250);
    }, 3200);
  }

  /* -------------------------
     SPLASH SCREEN
  ------------------------- */

  function startSplash() {
    if (!elements.splash) {
      showAuth();
      return;
    }

    showElement(elements.splash);
    hideElement(elements.auth);
    hideElement(elements.app);

    window.setTimeout(() => {
      elements.splash.classList.add("splash-leaving");

      window.setTimeout(() => {
        hideElement(elements.splash);
        elements.splash.classList.remove("splash-leaving");
        showAuth();
      }, 450);
    }, CONFIG.splashDuration);
  }

  /* -------------------------
     AUTH SCREEN
  ------------------------- */

  function showAuth() {
    hideElement(elements.splash);
    hideElement(elements.app);
    showElement(elements.auth);

    document.body.classList.remove("app-active");
    document.body.classList.add("auth-active");
  }

  function switchAuthTab(tab) {
    if (!["login", "register"].includes(tab)) return;

    state.activeTab = tab;

    const loginTab = $("#login-tab");
    const registerTab = $("#register-tab");

    const loginForm = $("#login-form");
    const registerForm = $("#register-form");

    [loginTab, registerTab].forEach(button => {
      if (!button) return;

      const active =
        button.id === `${tab}-tab`;

      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });

    if (loginForm) {
      loginForm.hidden = tab !== "login";
    }

    if (registerForm) {
      registerForm.hidden = tab !== "register";
    }
  }

  /* -------------------------
     PREVIEW MODE
     Interface preview only.
     No account is created.
     No messages are sent.
  ------------------------- */

  function enterPreviewMode() {
    state.previewMode = true;
    state.currentPage = CONFIG.defaultPage;

    hideElement(elements.auth);
    showElement(elements.app);

    document.body.classList.remove("auth-active");
    document.body.classList.add("app-active", "preview-active");

    buildApplicationShell();
    navigate(CONFIG.defaultPage);

    toast("أنت الآن تستعرض واجهات HENO CHAT", "success");
  }

  function exitPreviewMode() {
    state.previewMode = false;
    state.sidebarOpen = false;

    document.body.classList.remove(
      "app-active",
      "preview-active"
    );

    showAuth();
    closeModal();

    toast("تم الرجوع إلى شاشة الدخول");
  }

  /* -------------------------
     APPLICATION NAVIGATION
  ------------------------- */

  const pages = {
    chats: {
      title: "المحادثات",
      subtitle: "محادثاتك",
      icon: "message-circle",
      render: renderChats
    },

    status: {
      title: "الحالة",
      subtitle: "الحالات",
      icon: "circle-dot",
      render: renderStatus
    },

    calls: {
      title: "المكالمات",
      subtitle: "المكالمات",
      icon: "phone",
      render: renderCalls
    },

    communities: {
      title: "المجتمعات",
      subtitle: "مجتمعات HENO",
      icon: "users",
      render: renderCommunities
    },

    channels: {
      title: "القنوات",
      subtitle: "القنوات",
      icon: "radio",
      render: renderChannels
    },

    contacts: {
      title: "جهات الاتصال",
      subtitle: "الأشخاص",
      icon: "contact",
      render: renderContacts
    },

    settings: {
      title: "الإعدادات",
      subtitle: "إعدادات التطبيق",
      icon: "settings",
      render: renderSettings
    },

    profile: {
      title: "الملف الشخصي",
      subtitle: "حسابك",
      icon: "user-round",
      render: renderProfile
    }
  };

  function navigate(pageName) {
    const page = pages[pageName];

    if (!page) {
      toast("هذا القسم غير متاح حاليًا", "error");
      return;
    }

    state.previousPage = state.currentPage;
    state.currentPage = pageName;

    updateNavigation(pageName);
    updateHeader(page);

    if (elements.pageContainer) {
      elements.pageContainer.innerHTML = "";
      elements.pageContainer.appendChild(page.render());
    }

    closeSidebar();

    document.dispatchEvent(
      new CustomEvent("heno:pagechange", {
        detail: { page: pageName }
      })
    );
  }

  function updateNavigation(activePage) {
    $$("[data-page]").forEach(button => {
      const active =
        button.dataset.page === activePage;

      button.classList.toggle("active", active);

      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });
  }

  function updateHeader(page) {
    const title = $("#header-title");
    const subtitle = $("#header-subtitle");

    setText(title, page.title);
    setText(subtitle, page.subtitle);

    if (elements.header) {
      elements.header.dataset.currentPage =
        state.currentPage;
    }
  }

  /* -------------------------
     APPLICATION SHELL
  ------------------------- */

  function buildApplicationShell() {
    if (!elements.app) return;

    showElement(elements.app);

    const existingNavigation =
      $("#heno-navigation", elements.app);

    if (existingNavigation) return;

    const navigation = document.createElement("nav");

    navigation.id = "heno-navigation";
    navigation.className = "heno-navigation";
    navigation.setAttribute("aria-label", "التنقل الرئيسي");

    const navigationItems = [
      ["chats", "المحادثات", "message-circle"],
      ["status", "الحالة", "circle-dot"],
      ["calls", "المكالمات", "phone"],
      ["communities", "المجتمعات", "users"],
      ["channels", "القنوات", "radio"],
      ["contacts", "جهات الاتصال", "contact"],
      ["settings", "الإعدادات", "settings"]
    ];

    navigation.innerHTML = navigationItems.map(item => `
      <button
        type="button"
        class="heno-nav-item"
        data-page="${item[0]}"
        aria-label="${item[1]}"
      >
        <span class="nav-icon" aria-hidden="true">
          ${getIcon(item[2])}
        </span>
        <span class="nav-label">${item[1]}</span>
      </button>
    `).join("");

    if (elements.sidebar) {
      elements.sidebar.appendChild(navigation);
    }

    createPreviewIndicator();
  }

  function createPreviewIndicator() {
    if (!state.previewMode || !elements.app) return;

    let indicator = $("#preview-indicator");

    if (!indicator) {
      indicator = document.createElement("div");
      indicator.id = "preview-indicator";
      indicator.className = "preview-indicator";

      indicator.innerHTML = `
        <span>معاينة الواجهات</span>
        <button type="button" data-action="exit-preview">
          خروج
        </button>
      `;

      elements.app.prepend(indicator);
    }
  }

  /* -------------------------
     SVG ICON SYSTEM
  ------------------------- */

  const iconPaths = {
    "message-circle": `
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>
    `,
    "circle-dot": `
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="3"/>
    `,
    phone: `
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7 10a16 16 0 0 0 6 6l1.8-1.9a2 2 0 0 1 1.7-.6l2.8.4a2 2 0 0 1 1.7 2z"/>
    `,
    users: `
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="10" cy="7" r="4"/>
      <path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>
    `,
    radio: `
      <circle cx="12" cy="12" r="2"/>
      <path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4"/>
      <path d="M19 5a10 10 0 0 1 0 14M5 19a10 10 0 0 1 0-14"/>
    `,
    contact: `
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <circle cx="9" cy="9" r="2.5"/>
      <path d="M5.5 17a3.5 3.5 0 0 1 7 0M15 8h3M15 12h3M15 16h3"/>
    `,
    settings: `
      <circle cx="12" cy="12" r="3"/>
      <path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2z"/>
    `,
    "user-round": `
      <circle cx="12" cy="8" r="4"/>
      <path d="M5 21a7 7 0 0 1 14 0"/>
    `,
    search: `
      <circle cx="11" cy="11" r="7"/>
      <path d="m20 20-4-4"/>
    `,
    plus: `
      <path d="M12 5v14M5 12h14"/>
    `
  };

  function getIcon(name) {
    const path = iconPaths[name] || iconPaths.settings;

    return `
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        ${path}
      </svg>
    `;
  }

  /* -------------------------
     PAGE COMPONENT HELPERS
  ------------------------- */

  function createPage(title, description, iconName) {
    const section = document.createElement("section");

    section.className = "heno-page";
    section.dataset.pageContent = state.currentPage;

    const heading = document.createElement("div");
    heading.className = "heno-page-heading";

    heading.innerHTML = `
      <div class="heno-page-heading-icon">
        ${getIcon(iconName)}
      </div>
      <div>
        <h2>${escapeHTML(title)}</h2>
        <p>${escapeHTML(description)}</p>
      </div>
    `;

    section.appendChild(heading);

    return section;
  }

  function createEmptyState(title, description, iconName) {
    const box = document.createElement("div");

    box.className = "heno-empty-state";

    box.innerHTML = `
      <div class="empty-state-icon">
        ${getIcon(iconName)}
      </div>
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(description)}</p>
    `;

    return box;
  }

  function createActionButton(label, action, iconName = "plus") {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "heno-action-button";
    button.dataset.action = action;

    button.innerHTML = `
      ${getIcon(iconName)}
      <span>${escapeHTML(label)}</span>
    `;

    return button;
  }

  /* -------------------------
     CHATS PAGE
  ------------------------- */

  function renderChats() {
    const page = createPage(
      "المحادثات",
      "كل محادثاتك في مكان واحد",
      "message-circle"
    );

    const toolbar = document.createElement("div");
    toolbar.className = "heno-page-toolbar";

    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "ابحث عن محادثة أو شخص";
    search.className = "heno-search-input";
    search.setAttribute("aria-label", "البحث في المحادثات");

    toolbar.appendChild(search);
    toolbar.appendChild(
      createActionButton("محادثة جديدة", "new-chat")
    );

    page.appendChild(toolbar);

    const list = document.createElement("div");
    list.className = "heno-chat-list";
    list.appendChild(
      createEmptyState(
        "المحادثات",
        "ستظهر هنا محادثات حسابك بعد تسجيل الدخول.",
        "message-circle"
      )
    );

    page.appendChild(list);

    return page;
  }

  /* -------------------------
     STATUS PAGE
  ------------------------- */

  function renderStatus() {
    const page = createPage(
      "الحالة",
      "شارك لحظاتك مع جهات اتصالك",
      "circle-dot"
    );

    const toolbar = document.createElement("div");
    toolbar.className = "heno-page-toolbar";

    toolbar.appendChild(
      createActionButton("إضافة حالة", "add-status")
    );

    page.appendChild(toolbar);

    page.appendChild(
      createEmptyState(
        "الحالات",
        "ستظهر تحديثات الحالة الخاصة بحسابك هنا.",
        "circle-dot"
      )
    );

    return page;
  }

  /* -------------------------
     CALLS PAGE
  ------------------------- */

  function renderCalls() {
    const page = createPage(
      "المكالمات",
      "المكالمات الصوتية والمرئية",
      "phone"
    );

    page.appendChild(
      createActionButton("مكالمة جديدة", "new-call", "phone")
    );

    page.appendChild(
      createEmptyState(
        "سجل المكالمات",
        "سيظهر سجل مكالمات حسابك هنا.",
        "phone"
      )
    );

    return page;
  }

  /* -------------------------
     COMMUNITIES PAGE
  ------------------------- */

  function renderCommunities() {
    const page = createPage(
      "المجتمعات",
      "اجمع المجموعات ذات الاهتمام المشترك",
      "users"
    );

    page.appendChild(
      createActionButton(
        "إنشاء مجتمع",
        "create-community"
      )
    );

    page.appendChild(
      createEmptyState(
        "المجتمعات",
        "ستظهر المجتمعات التي تنشئها أو تنضم إليها هنا.",
        "users"
      )
    );

    return page;
  }

  /* -------------------------
     CHANNELS PAGE
  ------------------------- */

  function renderChannels() {
    const page = createPage(
      "القنوات",
      "تابع التحديثات والمحتوى من القنوات",
      "radio"
    );

    page.appendChild(
      createActionButton(
        "إنشاء قناة",
        "create-channel"
      )
    );

    page.appendChild(
      createEmptyState(
        "القنوات",
        "ستظهر القنوات التي تتابعها هنا.",
        "radio"
      )
    );

    return page;
  }

  /* -------------------------
     CONTACTS PAGE
  ------------------------- */

  function renderContacts() {
    const page = createPage(
      "جهات الاتصال",
      "ابحث عن الأشخاص وتواصل معهم",
      "contact"
    );

    const search = document.createElement("input");

    search.type = "search";
    search.placeholder = "ابحث بالاسم أو كود HENO";
    search.className = "heno-search-input";

    page.appendChild(search);

    page.appendChild(
      createActionButton(
        "إضافة جهة اتصال",
        "add-contact"
      )
    );

    page.appendChild(
      createEmptyState(
        "جهات الاتصال",
        "ستظهر جهات اتصال حسابك هنا.",
        "contact"
      )
    );

    return page;
  }

  /* -------------------------
     SETTINGS PAGE
  ------------------------- */

  function renderSettings() {
    const page = createPage(
      "الإعدادات",
      "تحكم في حسابك وتجربتك داخل HENO",
      "settings"
    );

    const settings = [
      ["account", "الحساب", "إدارة معلومات حسابك"],
      ["privacy", "الخصوصية", "التحكم في ظهور معلوماتك"],
      ["security", "الأمان", "إعدادات حماية الحساب"],
      ["notifications", "الإشعارات", "إدارة التنبيهات"],
      ["appearance", "المظهر", "الألوان والوضع الليلي"],
      ["language", "اللغة", "لغة التطبيق"],
      ["chats-settings", "الدردشات", "إعدادات المحادثات"],
      ["storage", "التخزين والبيانات", "إدارة الملفات والمساحة"],
      ["linked-devices", "الأجهزة المرتبطة", "إدارة الأجهزة"],
      ["blocked", "المحظورون", "إدارة الحسابات المحظورة"],
      ["help", "المساعدة", "الدعم والأسئلة الشائعة"]
    ];

    const list = document.createElement("div");
    list.className = "heno-settings-list";

    settings.forEach(([id, title, description]) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "heno-settings-item";
      button.dataset.settingsSection = id;

      button.innerHTML = `
        <span class="settings-item-content">
          <strong>${escapeHTML(title)}</strong>
          <small>${escapeHTML(description)}</small>
        </span>
        <span class="settings-arrow" aria-hidden="true">‹</span>
      `;

      list.appendChild(button);
    });

    page.appendChild(list);

    return page;
  }

  /* -------------------------
     PROFILE PAGE
  ------------------------- */

  function renderProfile() {
    const page = createPage(
      "الملف الشخصي",
      "إدارة صورتك ومعلومات حسابك",
      "user-round"
    );

    page.appendChild(
      createEmptyState(
        "الملف الشخصي",
        "ستظهر معلومات حسابك بعد تسجيل الدخول.",
        "user-round"
      )
    );

    return page;
  }

  /* -------------------------
     SIDEBAR
  ------------------------- */

  function openSidebar() {
    if (!elements.sidebar) return;

    state.sidebarOpen = true;
    elements.sidebar.classList.add("sidebar-open");

    document.body.classList.add("sidebar-visible");
  }

  function closeSidebar() {
    if (!elements.sidebar) return;

    state.sidebarOpen = false;
    elements.sidebar.classList.remove("sidebar-open");

    document.body.classList.remove("sidebar-visible");
  }

  function toggleSidebar() {
    state.sidebarOpen ? closeSidebar() : openSidebar();
  }

  /* -------------------------
     MODAL SYSTEM
  ------------------------- */

  function openModal(title, content) {
    if (!elements.modalLayer) return;

    state.modalOpen = true;

    elements.modalLayer.innerHTML = `
      <div class="heno-modal-backdrop" data-action="close-modal">
        <section
          class="heno-modal"
          role="dialog"
          aria-modal="true"
          aria-label="${escapeHTML(title)}"
        >
          <header class="heno-modal-header">
            <h3>${escapeHTML(title)}</h3>
            <button
              type="button"
              class="heno-modal-close"
              data-action="close-modal"
              aria-label="إغلاق"
            >×</button>
          </header>
          <div class="heno-modal-body"></div>
        </section>
      </div>
    `;

    const body = $(".heno-modal-body", elements.modalLayer);

    if (typeof content === "string") {
      body.textContent = content;
    } else if (content instanceof Node) {
      body.appendChild(content);
    }

    showElement(elements.modalLayer);

    document.body.classList.add("modal-visible");

    const closeButton = $(".heno-modal-close", elements.modalLayer);
    closeButton?.focus();
  }

  function closeModal() {
    if (!elements.modalLayer) return;

    elements.modalLayer.innerHTML = "";
    hideElement(elements.modalLayer);

    state.modalOpen = false;

    document.body.classList.remove("modal-visible");
  }

  /* -------------------------
     ACTION ROUTER
  ------------------------- */

  function handleAction(action, element) {
    switch (action) {
      case "enter-preview":
        enterPreviewMode();
        break;

      case "exit-preview":
        exitPreviewMode();
        break;

      case "close-modal":
        closeModal();
        break;

      case "new-chat":
        openModal(
          "محادثة جديدة",
          "ابحث عن شخص باستخدام اسم المستخدم أو كود HENO."
        );
        break;

      case "add-contact":
        openModal(
          "إضافة جهة اتصال",
          "يمكن البحث عن الأشخاص باستخدام كود HENO."
        );
        break;

      case "add-status":
        openModal(
          "إضافة حالة",
          "يمكنك مشاركة صورة أو فيديو أو نص في حالتك."
        );
        break;

      case "new-call":
        openModal(
          "مكالمة جديدة",
          "اختر جهة اتصال لبدء مكالمة."
        );
        break;

      case "create-community":
        openModal(
          "إنشاء مجتمع",
          "أنشئ مجتمعًا لتنظيم مجموعاتك."
        );
        break;

      case "create-channel":
        openModal(
          "إنشاء قناة",
          "أنشئ قناة لمشاركة التحديثات."
        );
        break;

      default:
        if (element?.dataset.settingsSection) {
          openModal(
            element.querySelector("strong")?.textContent || "الإعدادات",
            "تفاصيل هذا القسم ستُفتح ضمن صفحة الإعدادات."
          );
        } else {
          toast("لم يتم العثور على الإجراء المطلوب", "error");
        }
    }
  }

  /* -------------------------
     GLOBAL CLICK EVENTS
  ------------------------- */

  function bindClickEvents() {
    document.addEventListener("click", event => {
      const actionElement =
        event.target.closest("[data-action]");

      if (actionElement) {
        event.preventDefault();

        handleAction(
          actionElement.dataset.action,
          actionElement
        );

        return;
      }

      const pageElement =
        event.target.closest("[data-page]");

      if (pageElement) {
        event.preventDefault();
        navigate(pageElement.dataset.page);
        return;
      }

      const settingsElement =
        event.target.closest("[data-settings-section]");

      if (settingsElement) {
        handleAction("", settingsElement);
      }
    });

    const loginTab = $("#login-tab");
    const registerTab = $("#register-tab");

    loginTab?.addEventListener("click", () => {
      switchAuthTab("login");
    });

    registerTab?.addEventListener("click", () => {
      switchAuthTab("register");
    });

    elements.previewButton?.addEventListener(
      "click",
      enterPreviewMode
    );
  }

  /* -------------------------
     KEYBOARD SUPPORT
  ------------------------- */

  function bindKeyboardEvents() {
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        if (state.modalOpen) {
          closeModal();
        } else if (state.sidebarOpen) {
          closeSidebar();
        }
      }
    });
  }

  /* -------------------------
     AUTH EVENTS
  ------------------------- */

  function bindAuthEvents() {
    const googleButton = $("#google-login");

    googleButton?.addEventListener("click", () => {
      document.dispatchEvent(
        new CustomEvent("heno:auth-request", {
          detail: { provider: "google" }
        })
      );
    });

    const loginForm = $("#login-form");

    loginForm?.addEventListener("submit", event => {
      event.preventDefault();

      document.dispatchEvent(
        new CustomEvent("heno:auth-request", {
          detail: {
            provider: "email",
            mode: "login",
            form: loginForm
          }
        })
      );
    });

    const registerForm = $("#register-form");

    registerForm?.addEventListener("submit", event => {
      event.preventDefault();

      document.dispatchEvent(
        new CustomEvent("heno:auth-request", {
          detail: {
            provider: "email",
            mode: "register",
            form: registerForm
          }
        })
      );
    });
  }

  /* -------------------------
     RESPONSIVE EVENTS
  ------------------------- */

  function bindResponsiveEvents() {
    const menuButton = $("[data-action='toggle-sidebar']");

    menuButton?.addEventListener("click", toggleSidebar);

    document.addEventListener("click", event => {
      if (!state.sidebarOpen) return;

      const insideSidebar =
        event.target.closest("#app-sidebar");

      const menu =
        event.target.closest("[data-action='toggle-sidebar']");

      if (!insideSidebar && !menu) {
        closeSidebar();
      }
    });
  }

  /* -------------------------
     PUBLIC API
  ------------------------- */

  function getState() {
    return Object.freeze({
      previewMode: state.previewMode,
      currentPage: state.currentPage,
      sidebarOpen: state.sidebarOpen,
      modalOpen: state.modalOpen,
      activeTab: state.activeTab
    });
  }

  function init() {
    if (state.initialized) return;

    cacheElements();

    bindClickEvents();
    bindKeyboardEvents();
    bindAuthEvents();
    bindResponsiveEvents();

    switchAuthTab("login");

    state.initialized = true;

    startSplash();

    document.dispatchEvent(
      new CustomEvent("heno:initialized")
    );
  }

  return {
    init,
    navigate,
    toast,
    openModal,
    closeModal,
    enterPreviewMode,
    exitPreviewMode,
    switchAuthTab,
    getState,
    getIcon
  };

})();

/* -------------------------
   START APPLICATION
------------------------- */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", HENO.init);
} else {
  HENO.init();
}

/* Global application reference */
window.HENO = HENO;
