/* =========================================
   HENO CHAT — AUTHENTICATION MODULE
   Firebase integration will be added later.
========================================= */

const Auth = (() => {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const STORAGE_KEY = "heno_user_profile";

  let currentMode = "login";

  function getSavedProfile() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
    } catch {
      return null;
    }
  }

  function saveProfile(profile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validatePassword(password) {
    return typeof password === "string" && password.length >= 8;
  }

  function showMessage(message, type = "info") {
    if (typeof window.HENO?.toast === "function") {
      window.HENO.toast(message, type);
      return;
    }

    const toast = $("#toast");
    if (toast) {
      toast.textContent = message;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 3000);
    }
  }

  function switchMode(mode) {
    currentMode = mode === "register" ? "register" : "login";

    const loginTab = $('[data-auth-tab="login"]');
    const registerTab = $('[data-auth-tab="register"]');
    const loginForm = $("#loginForm");
    const registerForm = $("#registerForm");

    loginTab?.classList.toggle("active", currentMode === "login");
    registerTab?.classList.toggle("active", currentMode === "register");

    if (loginForm) {
      loginForm.hidden = currentMode !== "login";
    }

    if (registerForm) {
      registerForm.hidden = currentMode !== "register";
    }

    const title = $("#authTitle");
    const subtitle = $("#authSubtitle");

    if (title) {
      title.textContent =
        currentMode === "login"
          ? "مرحبًا بعودتك"
          : "أنشئ حسابك في HENO";
    }

    if (subtitle) {
      subtitle.textContent =
        currentMode === "login"
          ? "سجّل الدخول وتواصل مع من تحب"
          : "ابدأ رحلتك وتواصل بلا حدود";
    }
  }

  function setLoading(form, loading) {
    const button = $("button[type='submit']", form);
    if (!button) return;

    button.disabled = loading;

    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent.trim();
    }

    button.textContent = loading
      ? "جارٍ المعالجة..."
      : button.dataset.originalText;
  }

  function createUserCode() {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "HENO-";

    for (let i = 0; i < 8; i++) {
      code += characters[Math.floor(Math.random() * characters.length)];
    }

    return code;
  }

  function getFormValues(form) {
    const values = {};

    $$("input", form).forEach(input => {
      if (input.name) {
        values[input.name] = input.value.trim();
      }
    });

    return values;
  }

  function validateRegistration(data) {
    if (!data.name || data.name.length < 2) {
      return "اكتب اسمًا صحيحًا لا يقل عن حرفين";
    }

    if (!validateEmail(data.email || "")) {
      return "أدخل بريدًا إلكترونيًا صحيحًا";
    }

    if (!validatePassword(data.password || "")) {
      return "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
    }

    if (data.password !== data.confirmPassword) {
      return "كلمتا المرور غير متطابقتين";
    }

    return null;
  }

  function validateLogin(data) {
    if (!validateEmail(data.email || "")) {
      return "أدخل بريدًا إلكترونيًا صحيحًا";
    }

    if (!data.password) {
      return "اكتب كلمة المرور";
    }

    return null;
  }

  async function handleLogin(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = getFormValues(form);
    const error = validateLogin(data);

    if (error) {
      showMessage(error, "error");
      return;
    }

    showMessage(
      "واجهة تسجيل الدخول جاهزة. سنفعّل التحقق الحقيقي من الحسابات عند ربط Firebase.",
      "info"
    );
  }

  async function handleRegister(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = getFormValues(form);
    const error = validateRegistration(data);

    if (error) {
      showMessage(error, "error");
      return;
    }

    showMessage(
      "بيانات التسجيل صحيحة. إنشاء الحساب الحقيقي سيتم بعد ربط Firebase.",
      "info"
    );
  }

  function updatePasswordVisibility(button) {
    const targetId = button.dataset.togglePassword;
    const input = targetId ? document.getElementById(targetId) : null;

    if (!input) return;

    const visible = input.type === "password";
    input.type = visible ? "text" : "password";

    button.setAttribute(
      "aria-label",
      visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
    );
  }

  function updatePasswordStrength(password) {
    const meter = $("#passwordStrength");
    const label = $("#passwordStrengthLabel");

    if (!meter || !label) return;

    let score = 0;

    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    meter.dataset.level = String(score);

    const levels = [
      "أدخل كلمة المرور",
      "ضعيفة جدًا",
      "ضعيفة",
      "متوسطة",
      "جيدة",
      "قوية"
    ];

    label.textContent = levels[score];
  }

  function bindEvents() {
    $$("[data-auth-tab]").forEach(button => {
      button.addEventListener("click", () => {
        switchMode(button.dataset.authTab);
      });
    });

    $("#loginForm")?.addEventListener("submit", handleLogin);
    $("#registerForm")?.addEventListener("submit", handleRegister);

    $$("[data-toggle-password]").forEach(button => {
      button.addEventListener("click", () => {
        updatePasswordVisibility(button);
      });
    });

    $("#registerPassword")?.addEventListener("input", event => {
      updatePasswordStrength(event.target.value);
    });

    $$("[data-auth-google]").forEach(button => {
      button.addEventListener("click", () => {
        showMessage(
          "تسجيل Google سيتم تفعيله باستخدام Firebase Authentication.",
          "info"
        );
      });
    });

    $$("[data-forgot-password]").forEach(button => {
      button.addEventListener("click", () => {
        showMessage(
          "استعادة كلمة المرور ستعمل من خلال البريد الإلكتروني بعد ربط Firebase.",
          "info"
        );
      });
    });
  }

  function init() {
    bindEvents();
    switchMode("login");
  }

  return {
    init,
    switchMode,
    getSavedProfile,
    saveProfile,
    createUserCode
  };
})();

window.HENOAuth = Auth;
