
/* =========================================
   HENO CHAT — APP CORE
   File: js/app.js
========================================= */

const HENO = {
  version: "1.0.0",
  currentPage: "chats",
  currentUser: null,
  previewMode: false,
  splashDuration: 5000
};

/* =========================================
   ELEMENTS
========================================= */

const $ = (selector, parent = document) =>
  parent.querySelector(selector);

const $$ = (selector, parent = document) =>
  [...parent.querySelectorAll(selector)];

const elements = {
  splash: $("#splash"),
  auth: $("#authScreen"),
  app: $("#appScreen"),
  modal: $("#modalLayer"),
  modalTitle: $("#modalTitle"),
  modalContent: $("#modalContent"),
  toast: $("#toastRegion")
};

/* =========================================
   LOCAL STORAGE
========================================= */

const Storage = {
  get(key, fallback = null) {
    try {
      const value = localStorage.getItem(`heno_${key}`);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(`heno_${key}`, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  remove(key) {
    localStorage.removeItem(`heno_${key}`);
  }
};

/* =========================================
   TOAST NOTIFICATIONS
========================================= */

function toast(message, type = "normal") {
  if (!elements.toast) return;

  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;

  elements.toast.appendChild(item);

  setTimeout(() => {
    item.style.opacity = "0";
    item.style.transform = "translateX(-12px)";

    setTimeout(() => item.remove(), 250);
  }, 3000);
}

/* =========================================
   SCREEN MANAGEMENT
========================================= */

function showScreen(screenName) {
  const screens = {
    splash: elements.splash,
    auth: elements.auth,
    app: elements.app
  };

  Object.entries(screens).forEach(([name, element]) => {
    if (!element) return;

    element.classList.toggle("hidden", name !== screenName);
  });
}

function startSplash() {
  showScreen("splash");

  window.setTimeout(() => {
    showScreen("auth");
    addPreviewButton();
  }, HENO.splashDuration);
}

/* =========================================
   AUTH TABS
========================================= */

function switchAuthTab(tabName) {
  const loginForm = $("#loginForm");
  const registerForm = $("#registerForm");

  $$(".auth-tab").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.authTab === tabName
    );
  });

  loginForm?.classList.toggle("hidden", tabName !== "login");
  registerForm?.classList.toggle("hidden", tabName !== "register");
}

/* =========================================
   LOCAL PREVIEW
   This is NOT a real account or login.
========================================= */

function addPreviewButton() {
  const authCard = $(".auth-card");

  if (!authCard || $("#previewModeButton")) return;

  const button = document.createElement("button");

  button.id = "previewModeButton";
  button.type = "button";
  button.className = "text-btn";
  button.style.cssText = `
    display:block;
    width:100%;
    margin-top:18px;
    padding:12px;
    border:1px solid rgba(160,130,255,.25);
    border-radius:12px;
    background:rgba(145,105,255,.08);
  `;

  button.textContent = "الدخول إلى معاينة التطبيق";

  button.addEventListener("click", () => {
    enterPreviewMode();
  });

  authCard.appendChild(button);
}

function enterPreviewMode() {
  HENO.previewMode = true;

  HENO.currentUser = {
    name: "مستخدم المعاينة",
    username: "@heno_preview",
    code: "PREVIEW",
    bio: "هذه معاينة محلية للتطبيق",
    avatar: "assets/default-avatar.png"
  };

  Storage.set("preview_user", HENO.currentUser);

  updateProfileUI();
  showScreen("app");
  navigateTo("chats");

  toast("أنت الآن في وضع المعاينة المحلية", "success");
}

/* =========================================
   AUTH FORM HANDLING
========================================= */

function setupAuthForms() {
  $("#loginForm")?.addEventListener("submit", event => {
    event.preventDefault();

    toast(
      "تسجيل الدخول الحقيقي سيتم تفعيله عند ربط Firebase.",
      "normal"
    );
  });

  $("#registerForm")?.addEventListener("submit", event => {
    event.preventDefault();

    toast(
      "إنشاء الحساب الحقيقي سيتم تفعيله عند ربط Firebase.",
      "normal"
    );
  });

  $("#googleSignIn")?.addEventListener("click", () => {
    toast(
      "تسجيل Google يحتاج إعداد Firebase Authentication أولاً.",
      "normal"
    );
  });

  $$("[data-auth-tab]").forEach(button => {
    button.addEventListener("click", () => {
      switchAuthTab(button.dataset.authTab);
    });
  });
}

/* =========================================
   PAGE NAVIGATION
========================================= */

function navigateTo(pageName) {
  const target = $(`#page-${pageName}`);

  if (!target) {
    toast("هذه الصفحة غير موجودة حالياً.", "error");
    return;
  }

  $$(".page").forEach(page => {
    page.classList.remove("active");
  });

  target.classList.add("active");

  HENO.currentPage = pageName;

  $$("[data-page]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === pageName
    );
  });

  if (pageName !== "conversation") {
    document.body.classList.remove("conversation-open");
  }
}

function setupNavigation() {
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-page]");
    if (!button) return;

    const pageName = button.dataset.page;
    navigateTo(pageName);
  });
}

/* =========================================
   MODAL MANAGEMENT
========================================= */

function openModal(title, content) {
  if (!elements.modal) return;

  elements.modalTitle.textContent = title;
  elements.modalContent.replaceChildren();

  if (content instanceof Node) {
    elements.modalContent.appendChild(content);
  } else {
    const paragraph = document.createElement("p");
    paragraph.textContent = String(content ?? "");
    elements.modalContent.appendChild(paragraph);
  }

  elements.modal.classList.remove("hidden");
  elements.modal.setAttribute("aria-hidden", "false");

  document.body.style.overflow = "hidden";

  $(".modal-card")?.focus();
}

function closeModal() {
  elements.modal?.classList.add("hidden");
  elements.modal?.setAttribute("aria-hidden", "true");

  document.body.style.overflow = "";
}

function setupModal() {
  elements.modal?.addEventListener("click", event => {
    if (event.target.closest('[data-action="close-modal"]')) {
      closeModal();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
}

/* =========================================
   PROFILE DISPLAY
========================================= */

function updateProfileUI() {
  const user = HENO.currentUser;
  if (!user) return;

  const name = user.name || "مستخدم HENO";
  const avatar = user.avatar || "assets/default-avatar.png";

  const nameElements = [
    "#profileName",
    "#settingsName"
  ];

  nameElements.forEach(selector => {
    const element = $(selector);
    if (element) element.textContent = name;
  });

  const username = $("#profileUsername");
  if (username) {
    username.textContent = user.username || "";
  }

  const code = $("#userCode");
  if (code) {
    code.textContent = user.code || "غير متاح";
  }

  const bio = $("#profileBio");
  if (bio) {
    bio.textContent = user.bio || "";
  }

  [
    "#railAvatar",
    "#statusAvatar",
    "#profileAvatar",
    "#settingsAvatar"
  ].forEach(selector => {
    const image = $(selector);
    if (image) image.src = avatar;
  });
}

/* =========================================
   SEARCH
========================================= */

function setupChatSearch() {
  const input = $("#chatSearch");

  input?.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();

    $$(".chat-item").forEach(item => {
      const searchableText = item.textContent.toLowerCase();

      item.style.display = searchableText.includes(query)
        ? ""
        : "none";
    });
  });
}

function setupContactSearch() {
  const input = $("#contactSearch");

  input?.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();

    $$(".contact-item").forEach(item => {
      item.style.display = item.textContent
        .toLowerCase()
        .includes(query) ? "" : "none";
    });
  });
}

/* =========================================
   FILTERS
========================================= */

function setupFilters() {
  $$("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;

      $$("[data-filter]").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      $$(".chat-item").forEach(item => {
        const matches =
          filter === "all" ||
          item.dataset.category === filter ||
          (filter === "unread" && item.dataset.unread === "true") ||
          (filter === "groups" && item.dataset.type === "group") ||
          (filter === "favorites" && item.dataset.favorite === "true");

        item.style.display = matches ? "" : "none";
      });
    });
  });
}

/* =========================================
   ACTIONS
========================================= */

function handleAction(action) {
  switch (action) {

    case "close-modal":
      closeModal();
      break;

    case "back-to-chats":
      navigateTo("chats");
      break;

    case "logout":
      if (HENO.previewMode) {
        Storage.remove("preview_user");
        HENO.currentUser = null;
        HENO.previewMode = false;

        showScreen("auth");
        toast("تم الخروج من وضع المعاينة.");
      } else {
        toast("تسجيل الخروج الحقيقي يحتاج جلسة Firebase.");
      }
      break;

    case "forgot-password":
      toast("استعادة كلمة المرور ستعمل بعد إعداد Firebase.");
      break;

    case "new-chat":
    case "add-contact":
    case "find-user":
      showActionModal("البحث عن مستخدم", "ابحث عن أصدقائك باستخدام كود HENO أو اسم المستخدم بعد تفعيل قاعدة البيانات.");
      break;

    case "friend-requests":
      showActionModal("طلبات الإضافة", "ستظهر هنا طلبات الصداقة الواردة والصادرة بعد ربط الحسابات.");
      break;

    case "scan-qr":
    case "my-qr":
      showActionModal("رمز QR", "سيتم تجهيز رمز QR الخاص بحسابك عند إنشاء الحساب وربطه بمعرّف HENO.");
      break;

    case "create-group":
      showActionModal("إنشاء مجموعة", "سيتم تجهيز إنشاء المجموعات وإضافة الأعضاء وربط الرسائل بها.");
      break;

    case "create-channel":
      showActionModal("إنشاء قناة", "سيتم تجهيز القنوات وإدارتها ومتابعة المنشورات.");
      break;

    case "create-community":
      showActionModal("إنشاء مجتمع", "سيتم تجهيز المجتمعات وتنظيم المجموعات داخلها.");
      break;

    case "add-status":
      $("#mediaPicker")?.click();
      break;

    case "attach-menu":
      showAttachmentMenu();
      break;

    case "voice-record":
      toast("تسجيل الصوت سيتم تنفيذه في ملف الوسائط.");
      break;

    case "voice-call":
    case "video-call":
    case "start-voice-call":
    case "start-video-call":
    case "new-call":
      toast("المكالمات تحتاج إعداد خدمة الاتصال والصلاحيات.");
      break;

    case "emoji-picker":
      showActionModal("الملصقات والرموز", "سيتم إضافة لوحة الرموز والملصقات وملفات GIF.");
      break;

    case "conversation-search":
      $("#messageSearchPanel")?.classList.remove("hidden");
      $("#messageSearchInput")?.focus();
      break;

    case "close-message-search":
      $("#messageSearchPanel")?.classList.add("hidden");
      break;

    case "cancel-reply":
      $("#replyPreview")?.classList.add("hidden");
      break;

    case "clear-ai-chat":
      $("#aiMessages")?.replaceChildren();
      toast("تم مسح رسائل هذه المعاينة.");
      break;

    case "edit-profile":
      showActionModal("تعديل الملف الشخصي", "سيتم إضافة نموذج تعديل الاسم والصورة والنبذة واسم المستخدم.");
      break;

    case "copy-user-code":
      copyUserCode();
      break;

    case "mark-all-read":
      toast("لا توجد رسائل مرتبطة بحساب حقيقي بعد.");
      break;

    case "conversation-menu":
      showActionModal("خيارات المحادثة", "ستجد هنا خيارات كتم المحادثة وتثبيتها وأرشفتها وحظر المستخدم.");
      break;

    case "conversation-search":
      $("#messageSearchPanel")?.classList.remove("hidden");
      break;

    default:
      if (action?.startsWith("setting:")) {
        const setting = action.split(":")[1];
        showActionModal("الإعدادات", getSettingDescription(setting));
      } else {
        toast("سيتم ربط هذه الخاصية في ملفها المخصص.");
      }
  }
}

function showActionModal(title, message) {
  const paragraph = document.createElement("p");
  paragraph.textContent = message;
  paragraph.style.lineHeight = "2";

  openModal(title, paragraph);
}

function getSettingDescription(setting) {
  const descriptions = {
    account: "إدارة معلومات الحساب وتفاصيله.",
    privacy: "التحكم في آخر ظهور والصورة الشخصية والحالة.",
    security: "إعدادات حماية الحساب والتحقق.",
    blocked: "إدارة المستخدمين المحظورين.",
    appearance: "اختيار المظهر والألوان والخلفيات.",
    language: "اختيار لغة التطبيق واتجاه العرض.",
    notifications: "التحكم في إشعارات الرسائل والمجموعات.",
    chat: "إعدادات المحادثات والرسائل.",
    devices: "إدارة الأجهزة المرتبطة بحسابك.",
    storage: "إدارة الملفات والتخزين واستهلاك البيانات.",
    help: "المساعدة والدعم ومعلومات التطبيق."
  };

  return descriptions[setting] || "إعدادات HENO CHAT.";
}

/* =========================================
   CLIPBOARD
========================================= */

async function copyUserCode() {
  const code = HENO.currentUser?.code;

  if (!code || code === "PREVIEW") {
    toast("لا يوجد كود حساب حقيقي في وضع المعاينة.");
    return;
  }

  try {
    await navigator.clipboard.writeText(code);
    toast("تم نسخ كود HENO.", "success");
  } catch {
    toast("تعذر النسخ من هذا المتصفح.", "error");
  }
}

/* =========================================
   ATTACHMENT MENU
========================================= */

function showAttachmentMenu() {
  const wrapper = document.createElement("div");
  wrapper.className = "attachment-options";

  const options = [
    ["صورة أو فيديو", "media"],
    ["ملف", "file"]
  ];

  options.forEach(([label, type]) => {
    const button = document.createElement("button");
    button.className = "settings-row";
    button.type = "button";
    button.textContent = label;

    button.addEventListener("click", () => {
      closeModal();

      if (type === "media") {
        $("#mediaPicker")?.click();
      } else {
        $("#filePicker")?.click();
      }
    });

    wrapper.appendChild(button);
  });

  openModal("إرفاق", wrapper);
}

/* =========================================
   GLOBAL ACTION DELEGATION
========================================= */

function setupActions() {
  document.addEventListener("click", event => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const action = actionButton.dataset.action;

    if (actionButton.dataset.setting) {
      handleAction(`setting:${actionButton.dataset.setting}`);
      return;
    }

    handleAction(action);
  });

  $$("[data-setting]").forEach(button => {
    button.addEventListener("click", () => {
      handleAction(`setting:${button.dataset.setting}`);
    });
  });
}

/* =========================================
   MESSAGE SEARCH
========================================= */

function setupMessageSearch() {
  const input = $("#messageSearchInput");

  input?.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();

    $$(".message-bubble").forEach(message => {
      message.style.display = message.textContent
        .toLowerCase()
        .includes(query) ? "" : "none";
    });
  });
}

/* =========================================
   MEDIA PICKER PREVIEW
========================================= */

function setupMediaPicker() {
  $("#mediaPicker")?.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;

    toast(`تم اختيار الملف: ${file.name}. لم يتم رفعه بعد.`);
    event.target.value = "";
  });

  $("#filePicker")?.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;

    toast(`تم اختيار الملف: ${file.name}. لم يتم رفعه بعد.`);
    event.target.value = "";
  });
}

/* =========================================
   KEYBOARD SHORTCUTS
========================================= */

function setupKeyboard() {
  document.addEventListener("keydown", event => {
    const isTyping = ["INPUT", "TEXTAREA"].includes(
      document.activeElement?.tagName
    );

    if (event.key === "/" && !isTyping) {
      event.preventDefault();
      $("#chatSearch")?.focus();
    }
  });
}

/* =========================================
   SERVICE WORKER
========================================= */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
    } catch (error) {
      console.warn("HENO service worker:", error);
    }
  });
}

/* =========================================
   INITIALIZATION
========================================= */

function initHeno() {
  setupAuthForms();
  setupNavigation();
  setupModal();
  setupActions();
  setupChatSearch();
  setupContactSearch();
  setupFilters();
  setupMessageSearch();
  setupMediaPicker();
  setupKeyboard();
  registerServiceWorker();

  startSplash();

  console.info(
    `HENO CHAT v${HENO.version} initialized.`
  );
}

initHeno();
