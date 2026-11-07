/* =========================================
   HENO CHAT — SETTINGS ENGINE
   Profile, Privacy, Notifications,
   Appearance, Language and Security.
========================================= */

const Settings = (() => {
  "use strict";

  const STORAGE_KEY = "heno_settings";

  const defaults = {
    theme: "dark",
    language: "ar",
    fontSize: "normal",
    notifications: true,
    messagePreview: true,
    sound: true,
    vibration: true,
    onlineVisibility: true,
    lastSeenVisibility: true,
    readReceipts: true,
    typingVisibility: true,
    profilePhotoVisibility: "everyone",
    statusVisibility: "contacts",
    groupInvites: "contacts",
    twoStepVerification: false,
    appLock: false,
    biometricLock: false,
    autoDownloadImages: true,
    autoDownloadVideos: false,
    autoDownloadAudio: true,
    saveToGallery: false
  };

  let settings = { ...defaults };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

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

  function load() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "{}"
      );

      settings = {
        ...defaults,
        ...(saved && typeof saved === "object" ? saved : {})
      };
    } catch {
      settings = { ...defaults };
    }
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(settings)
      );

      document.dispatchEvent(
        new CustomEvent("heno:settings-changed", {
          detail: { ...settings }
        })
      );
    } catch (error) {
      console.error("Settings save error:", error);
      notify("تعذر حفظ الإعدادات");
    }
  }

  function get(key) {
    return settings[key];
  }

  function getAll() {
    return { ...settings };
  }

  function set(key, value) {
    if (!(key in defaults)) {
      notify("هذا الإعداد غير معروف");
      return false;
    }

    settings[key] = value;
    save();
    applySetting(key, value);
    renderControls();

    return true;
  }

  function toggle(key) {
    if (typeof settings[key] !== "boolean") {
      return false;
    }

    return set(key, !settings[key]);
  }

  // APPEARANCE

  function applyTheme(theme) {
    const allowed = ["dark", "light", "system"];

    if (!allowed.includes(theme)) return;

    settings.theme = theme;

    const root = document.documentElement;

    if (theme === "system") {
      const prefersDark = window.matchMedia?.(
        "(prefers-color-scheme: dark)"
      ).matches;

      root.dataset.theme = prefersDark ? "dark" : "light";
    } else {
      root.dataset.theme = theme;
    }

    document.body.dataset.theme = root.dataset.theme;
  }

  function applyFontSize(size) {
    const sizes = {
      small: "14px",
      normal: "16px",
      large: "18px",
      extraLarge: "20px"
    };

    if (!sizes[size]) return;

    document.documentElement.style.setProperty(
      "--app-font-size",
      sizes[size]
    );

    document.documentElement.style.fontSize = sizes[size];
  }

  function applyLanguage(language) {
    const allowed = ["ar", "en"];

    if (!allowed.includes(language)) return;

    settings.language = language;

    document.documentElement.lang = language;
    document.documentElement.dir =
      language === "ar" ? "rtl" : "ltr";

    document.dispatchEvent(
      new CustomEvent("heno:language-changed", {
        detail: { language }
      })
    );
  }

  function applySetting(key, value) {
    switch (key) {
      case "theme":
        applyTheme(value);
        break;

      case "fontSize":
        applyFontSize(value);
        break;

      case "language":
        applyLanguage(value);
        break;
    }
  }

  function applyAll() {
    applyTheme(settings.theme);
    applyFontSize(settings.fontSize);
    applyLanguage(settings.language);
  }

  // PRIVACY

  function getPrivacySettings() {
    return {
      onlineVisibility: settings.onlineVisibility,
      lastSeenVisibility: settings.lastSeenVisibility,
      readReceipts: settings.readReceipts,
      typingVisibility: settings.typingVisibility,
      profilePhotoVisibility: settings.profilePhotoVisibility,
      statusVisibility: settings.statusVisibility,
      groupInvites: settings.groupInvites
    };
  }

  // NOTIFICATIONS

  async function requestNotificationPermission() {
    if (!("Notification" in window)) {
      notify("الإشعارات غير مدعومة في هذا المتصفح");
      return false;
    }

    const permission =
      await Notification.requestPermission();

    if (permission === "granted") {
      set("notifications", true);
      notify("تم السماح بإشعارات المتصفح");
      return true;
    }

    set("notifications", false);
    notify("لم يتم السماح بالإشعارات");
    return false;
  }

  function showLocalNotification(title, body) {
    if (!settings.notifications) return;

    if (!("Notification" in window)) return;

    if (Notification.permission !== "granted") return;

    const notification = new Notification(title, {
      body,
      icon: "./assets/icon-192.png",
      badge: "./assets/icon-192.png"
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  // SECURITY

  function setTwoStepVerification(enabled) {
    if (enabled) {
      notify(
        "التحقق بخطوتين يحتاج إعدادًا آمنًا مرتبطًا بالحساب."
      );
      return false;
    }

    return set("twoStepVerification", false);
  }

  function setAppLock(enabled) {
    if (enabled) {
      notify(
        "قفل التطبيق يحتاج إعداد رمز حماية قبل تفعيله."
      );
      return false;
    }

    return set("appLock", false);
  }

  // STORAGE

  function getStorageUsage() {
    let used = 0;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key) || "";

        used += (key.length + value.length) * 2;
      }
    } catch (error) {
      console.error(error);
    }

    return {
      bytes: used,
      kilobytes: used / 1024,
      megabytes: used / (1024 * 1024)
    };
  }

  function clearLocalCache() {
    const allowedKeys = [
      "heno_media_cache",
      "heno_temporary_cache"
    ];

    allowedKeys.forEach(key => {
      localStorage.removeItem(key);
    });

    notify("تم تنظيف الملفات المؤقتة المتاحة");
  }

  // SETTINGS RENDERING

  function renderControls() {
    $$("[data-setting]").forEach(element => {
      const key = element.dataset.setting;

      if (!(key in settings)) return;

      const value = settings[key];

      if (element.type === "checkbox") {
        element.checked = Boolean(value);
      } else if (
        element.tagName === "SELECT" ||
        element.tagName === "INPUT"
      ) {
        element.value = String(value);
      } else {
        element.textContent = String(value);
      }
    });
  }

  function bindControls() {
    document.addEventListener("change", event => {
      const element = event.target.closest("[data-setting]");
      if (!element) return;

      const key = element.dataset.setting;

      if (element.type === "checkbox") {
        set(key, element.checked);
      } else {
        set(key, element.value);
      }
    });

    document.addEventListener("click", event => {
      const button = event.target.closest("[data-setting-toggle]");
      if (!button) return;

      toggle(button.dataset.settingToggle);
    });

    $$("[data-theme-choice]").forEach(button => {
      button.addEventListener("click", () => {
        set("theme", button.dataset.themeChoice);
      });
    });

    $$("[data-language-choice]").forEach(button => {
      button.addEventListener("click", () => {
        set("language", button.dataset.languageChoice);
      });
    });

    $("#enableNotifications")?.addEventListener(
      "click",
      requestNotificationPermission
    );

    $("#clearAppCache")?.addEventListener(
      "click",
      clearLocalCache
    );
  }

  function reset() {
    settings = { ...defaults };

    save();
    applyAll();
    renderControls();

    notify("تمت إعادة الإعدادات الافتراضية");
  }

  function init() {
    load();
    applyAll();
    bindControls();
    renderControls();

    window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    ).addEventListener?.("change", () => {
      if (settings.theme === "system") {
        applyTheme("system");
      }
    });

    document.dispatchEvent(
      new CustomEvent("heno:settings-ready")
    );
  }

  return {
    init,
    get,
    getAll,
    set,
    toggle,
    reset,
    applyAll,
    applyTheme,
    applyLanguage,
    getPrivacySettings,
    requestNotificationPermission,
    showLocalNotification,
    setTwoStepVerification,
    setAppLock,
    getStorageUsage,
    clearLocalCache
  };
})();

window.HENOSettings = Settings;
