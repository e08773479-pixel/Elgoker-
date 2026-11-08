
/* =========================================================
   HENO CHAT — AUTHENTICATION & REGISTRATION
   File: js/auth.js
   Version: 1.1.0
   Six-Step Account Creation
   Firebase-ready architecture
========================================================= */

const HENOAuth = (() => {
  "use strict";

  const state = {
    mode: "login",
    provider: "email",
    step: 1,
    totalSteps: 6,
    data: {
      fullName: "",
      username: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      photo: null,
      birthDate: "",
      about: "",
      termsAccepted: false,
      privacyAccepted: false
    }
  };

  const providers = {
    email: "البريد الإلكتروني",
    phone: "رقم الهاتف",
    google: "Google",
    facebook: "Facebook"
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

  function toast(message, type = "info") {
    if (window.HENO?.toast) {
      window.HENO.toast(message, type);
    } else {
      console.log(message);
    }
  }

  function emit(name, detail = {}) {
    document.dispatchEvent(
      new CustomEvent(`heno:auth:${name}`, { detail })
    );
  }

  /* =======================================================
     VALIDATION
  ======================================================= */

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validatePhone(phone) {
    const normalized = phone.replace(/[\s()-]/g, "");
    return /^\+?[0-9]{8,15}$/.test(normalized);
  }

  function validateUsername(username) {
    return /^[a-zA-Z0-9_]{3,24}$/.test(username);
  }

  function validatePassword(password) {
    return (
      password.length >= 8 &&
      /[A-Za-z]/.test(password) &&
      /[0-9]/.test(password)
    );
  }

  function validateImage(file) {
    if (!file) return "اختر صورة شخصية.";

    if (!file.type.startsWith("image/")) {
      return "الملف المختار ليس صورة.";
    }

    if (file.size > 5 * 1024 * 1024) {
      return "يجب ألا يتجاوز حجم الصورة 5 ميجابايت.";
    }

    return null;
  }

  function validateStep(step) {
    const d = state.data;

    switch (step) {
      case 1:
        if (!state.provider) {
          return "اختر طريقة إنشاء الحساب.";
        }

        if (
          state.provider === "email" &&
          !validateEmail(d.email)
        ) {
          return "أدخل بريدًا إلكترونيًا صحيحًا.";
        }

        if (
          state.provider === "phone" &&
          !validatePhone(d.phone)
        ) {
          return "أدخل رقم هاتف صحيحًا مع مفتاح الدولة.";
        }

        return null;

      case 2:
        if (!d.fullName.trim()) {
          return "أدخل اسمك.";
        }

        if (d.fullName.trim().length < 3) {
          return "الاسم يجب أن يتكون من 3 أحرف على الأقل.";
        }

        return null;

      case 3:
        if (!validateUsername(d.username)) {
          return "اسم المستخدم من 3 إلى 24 حرفًا، ويقبل الإنجليزية والأرقام والشرطة السفلية.";
        }

        return null;

      case 4: {
        const error = validateImage(d.photo);
        return error;
      }

      case 5:
        if (
          d.birthDate &&
          Number.isNaN(Date.parse(d.birthDate))
        ) {
          return "تاريخ الميلاد غير صحيح.";
        }

        return null;

      case 6:
        if (!d.termsAccepted || !d.privacyAccepted) {
          return "يجب الموافقة على الشروط وسياسة الخصوصية.";
        }

        if (
          state.provider === "email" &&
          !validatePassword(d.password)
        ) {
          return "كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم.";
        }

        if (
          state.provider === "email" &&
          d.password !== d.confirmPassword
        ) {
          return "كلمتا المرور غير متطابقتين.";
        }

        return null;

      default:
        return null;
    }
  }

  /* =======================================================
     PROVIDER SELECTION
  ======================================================= */

  function selectProvider(provider) {
    if (!providers[provider]) {
      toast("طريقة تسجيل غير معروفة.", "error");
      return;
    }

    state.provider = provider;
    state.data.email = "";
    state.data.phone = "";

    emit("provider-selected", { provider });

    toast(`طريقة التسجيل: ${providers[provider]}`);
  }

  /* =======================================================
     REGISTRATION START
  ======================================================= */

  function startRegistration(provider = "email") {
    state.mode = "register";
    state.step = 1;

    selectProvider(provider);

    renderRegistration();
    emit("registration-started", { provider });
  }

  function startLogin(provider = "email") {
    state.mode = "login";
    state.provider = provider;

    emit("login-requested", { provider });
  }

  /* =======================================================
     FORM DATA
  ======================================================= */

  function updateField(name, value) {
    if (!(name in state.data)) return;

    state.data[name] = value;
  }

  function collectFields() {
    const form = $("#heno-registration-form");

    if (!form) return;

    const fields = new FormData(form);

    for (const [name, value] of fields.entries()) {
      if (name === "photo") {
        const file = value instanceof File && value.size
          ? value
          : null;

        if (file) state.data.photo = file;

        continue;
      }

      if (name in state.data) {
        state.data[name] = value;
      }
    }

    const terms = $('[name="termsAccepted"]', form);
    const privacy = $('[name="privacyAccepted"]', form);

    state.data.termsAccepted = !!terms?.checked;
    state.data.privacyAccepted = !!privacy?.checked;
  }

  /* =======================================================
     SIX REGISTRATION STEPS
  ======================================================= */

  function renderRegistration() {
    const authScreen = $("#auth-screen");

    if (!authScreen) return;

    let container = $("#heno-registration");

    if (!container) {
      container = document.createElement("section");
      container.id = "heno-registration";
      container.className = "heno-registration";

      authScreen.appendChild(container);
    }

    container.hidden = false;

    const stepContent = getStepContent(state.step);

    container.innerHTML = `
      <div class="registration-card">

        <button
          type="button"
          class="registration-back"
          data-auth-action="back"
          aria-label="رجوع"
        >←</button>

        <div class="registration-brand">
          <span class="registration-brand-mark">H</span>
          <strong>HENO CHAT</strong>
        </div>

        <div class="registration-progress">
          <div class="registration-progress-track">
            <span style="width:${(state.step / state.totalSteps) * 100}%"></span>
          </div>

          <div class="registration-progress-label">
            <span>الخطوة ${state.step} من ${state.totalSteps}</span>
            <span>${Math.round((state.step / state.totalSteps) * 100)}%</span>
          </div>
        </div>

        <div class="registration-heading">
          <h2>${escapeHTML(stepContent.title)}</h2>
          <p>${escapeHTML(stepContent.description)}</p>
        </div>

        <form id="heno-registration-form" novalidate>
          <div class="registration-step-content">
            ${stepContent.html}
          </div>

          <p
            class="registration-error"
            id="registration-error"
            role="alert"
            hidden
          ></p>

          <div class="registration-actions">
            <button
              type="submit"
              class="registration-next"
            >
              ${state.step === 6 ? "إنشاء الحساب" : "متابعة"}
            </button>
          </div>
        </form>

        <div class="registration-footer">
          بيانات حسابك تُستخدم لإنشاء ملفك الشخصي داخل HENO.
        </div>

      </div>
    `;

    bindRegistrationForm();
  }

  function getStepContent(step) {
    const d = state.data;

    switch (step) {
      case 1:
        return {
          title: "اختر طريقة التسجيل",
          description: "ابدأ إنشاء حساب HENO الخاص بك.",
          html: `
            <div class="auth-provider-options">

              <button type="button" data-provider="email"
                class="auth-provider-option">
                البريد الإلكتروني
              </button>

              <button type="button" data-provider="phone"
                class="auth-provider-option">
                رقم الهاتف
              </button>

              <button type="button" data-provider="google"
                class="auth-provider-option">
                <strong>G</strong> التسجيل باستخدام Google
              </button>

              <button type="button" data-provider="facebook"
                class="auth-provider-option">
                <strong>f</strong> التسجيل باستخدام Facebook
              </button>

            </div>

            ${
              state.provider === "email"
                ? `
                  <label>البريد الإلكتروني</label>
                  <input
                    name="email"
                    type="email"
                    autocomplete="email"
                    placeholder="name@example.com"
                    value="${escapeHTML(d.email)}"
                    required
                  >
                `
                : ""
            }

            ${
              state.provider === "phone"
                ? `
                  <label>رقم الهاتف</label>
                  <input
                    name="phone"
                    type="tel"
                    autocomplete="tel"
                    placeholder="+20xxxxxxxxxx"
                    value="${escapeHTML(d.phone)}"
                    required
                  >
                `
                : ""
            }

            ${
              ["google", "facebook"].includes(state.provider)
                ? `
                  <div class="provider-notice">
                    سيتم استكمال التحقق من حسابك عبر
                    ${escapeHTML(providers[state.provider])}.
                  </div>
                `
                : ""
            }
          `
        };

      case 2:
        return {
          title: "ما اسمك؟",
          description: "اكتب الاسم الذي سيظهر لأصدقائك.",
          html: `
            <label>الاسم الكامل</label>
            <input
              name="fullName"
              type="text"
              autocomplete="name"
              placeholder="اسمك الكامل"
              value="${escapeHTML(d.fullName)}"
              maxlength="60"
              required
            >
          `
        };

      case 3:
        return {
          title: "اختر اسم المستخدم",
          description: "سيستخدمه الآخرون للعثور عليك.",
          html: `
            <label>اسم المستخدم</label>
            <div class="username-field">
              <span>@</span>
              <input
                name="username"
                type="text"
                autocomplete="username"
                placeholder="username"
                value="${escapeHTML(d.username)}"
                minlength="3"
                maxlength="24"
                required
              >
            </div>
            <small>
              الإنجليزية والأرقام والشرطة السفلية فقط.
            </small>
          `
        };

      case 4:
        return {
          title: "صورتك الشخصية",
          description: "أضف صورة ليعرفك أصدقاؤك.",
          html: `
            <div class="profile-photo-picker">
              <div class="profile-photo-preview" id="profile-photo-preview">
                <span>H</span>
              </div>

              <label for="registration-photo">
                اختر صورة شخصية
              </label>

              <input
                id="registration-photo"
                name="photo"
                type="file"
                accept="image/*"
              >

              <small>الحد الأقصى 5 ميجابايت.</small>
            </div>
          `
        };

      case 5:
        return {
          title: "أكمل ملفك الشخصي",
          description: "بعض المعلومات الإضافية تساعد في تخصيص حسابك.",
          html: `
            <label>تاريخ الميلاد (اختياري)</label>
            <input
              name="birthDate"
              type="date"
              value="${escapeHTML(d.birthDate)}"
            >

            <label>نبذة عنك (اختياري)</label>
            <textarea
              name="about"
              maxlength="160"
              placeholder="اكتب نبذة قصيرة عنك..."
            >${escapeHTML(d.about)}</textarea>
          `
        };

      case 6:
        return {
          title: "تأمين حسابك",
          description: "راجع بياناتك ووافق على سياسات HENO.",
          html: `
            ${
              state.provider === "email"
                ? `
                  <label>كلمة المرور</label>
                  <input
                    name="password"
                    type="password"
                    autocomplete="new-password"
                    placeholder="8 أحرف على الأقل"
                    required
                  >

                  <label>تأكيد كلمة المرور</label>
                  <input
                    name="confirmPassword"
                    type="password"
                    autocomplete="new-password"
                    placeholder="أعد كتابة كلمة المرور"
                    required
                  >
                `
                : ""
            }

            <div class="registration-summary">
              <strong>بيانات الحساب</strong>
              <p>${escapeHTML(d.fullName || "لم يُحدد الاسم")}</p>
              <p>@${escapeHTML(d.username || "لم يُحدد المستخدم")}</p>
              <p>${escapeHTML(
                state.provider === "email"
                  ? d.email
                  : state.provider === "phone"
                    ? d.phone
                    : providers[state.provider]
              )}</p>
            </div>

            <label class="registration-consent">
              <input
                type="checkbox"
                name="termsAccepted"
                ${d.termsAccepted ? "checked" : ""}
                required
              >
              أوافق على شروط الاستخدام.
            </label>

            <label class="registration-consent">
              <input
                type="checkbox"
                name="privacyAccepted"
                ${d.privacyAccepted ? "checked" : ""}
                required
              >
              أوافق على سياسة الخصوصية.
            </label>
          `
        };

      default:
        return {
          title: "إنشاء الحساب",
          description: "",
          html: ""
        };
    }
  }

  /* =======================================================
     REGISTRATION EVENTS
  ======================================================= */

  function bindRegistrationForm() {
    const form = $("#heno-registration-form");

    if (!form) return;

    form.addEventListener("submit", event => {
      event.preventDefault();

      collectFields();

      const error = validateStep(state.step);

      if (error) {
        showError(error);
        return;
      }

      hideError();

      if (state.step < state.totalSteps) {
        state.step += 1;
        renderRegistration();
      } else {
        submitRegistration();
      }
    });

    form.querySelectorAll("[data-provider]").forEach(button => {
      button.addEventListener("click", () => {
        collectFields();

        const provider = button.dataset.provider;

        selectProvider(provider);
        renderRegistration();
      });
    });

    form.querySelector('[name="photo"]')
      ?.addEventListener("change", handlePhotoSelection);
  }

  function handlePhotoSelection(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    const error = validateImage(file);

    if (error) {
      event.target.value = "";
      showError(error);
      return;
    }

    state.data.photo = file;

    const preview = $("#profile-photo-preview");

    if (preview) {
      const oldImage = $(".profile-photo-image", preview);

      if (oldImage) oldImage.remove();

      const image = document.createElement("img");

      image.className = "profile-photo-image";
      image.alt = "معاينة الصورة الشخصية";

      const reader = new FileReader();

      reader.onload = () => {
        image.src = reader.result;
      };

      reader.readAsDataURL(file);

      preview.innerHTML = "";
      preview.appendChild(image);
    }
  }

  function showError(message) {
    const error = $("#registration-error");

    if (!error) {
      toast(message, "error");
      return;
    }

    error.textContent = message;
    error.hidden = false;
  }

  function hideError() {
    const error = $("#registration-error");

    if (!error) return;

    error.textContent = "";
    error.hidden = true;
  }

  /* =======================================================
     STEP NAVIGATION
  ======================================================= */

  function previousStep() {
    if (state.step > 1) {
      collectFields();

      state.step -= 1;
      renderRegistration();

      return;
    }

    closeRegistration();
  }

  function closeRegistration() {
    const container = $("#heno-registration");

    if (container) {
      container.hidden = true;
    }

    state.mode = "login";
    state.step = 1;

    window.HENO?.switchAuthTab("login");
  }

  /* =======================================================
     REGISTRATION SUBMISSION
  ======================================================= */

  async function submitRegistration() {
    collectFields();

    const error = validateStep(6);

    if (error) {
      showError(error);
      return;
    }

    const form = $("#heno-registration-form");
    const submitButton = form?.querySelector('[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "جارٍ تجهيز الحساب...";
    }

    try {
      const payload = {
        provider: state.provider,
        fullName: state.data.fullName.trim(),
        username: state.data.username.trim().toLowerCase(),
        email: state.data.email.trim().toLowerCase(),
        phone: state.data.phone.trim(),
        photo: state.data.photo,
        birthDate: state.data.birthDate,
        about: state.data.about.trim(),
        termsAccepted: state.data.termsAccepted,
        privacyAccepted: state.data.privacyAccepted
      };

      if (state.provider === "email") {
        payload.password = state.data.password;
      }

      emit("registration-submit", payload);

      /*
       * Firebase authentication module will listen
       * for this event and perform the real operation.
       * No fake account is created here.
       */

      if (!firebaseAdapterAvailable()) {
        throw new Error(
          "AUTH_BACKEND_NOT_CONNECTED"
        );
      }

      await window.HENOAuthBackend.register(payload);

    } catch (error) {
      if (error.message === "AUTH_BACKEND_NOT_CONNECTED") {
        showError(
          "لم يتم تفعيل خدمة إنشاء الحساب بعد. يجب ربط Firebase لإتمام التسجيل بأمان."
        );
      } else {
        showError(
          error.message || "تعذر إنشاء الحساب. حاول مرة أخرى."
        );
      }

      emit("registration-error", { error });

    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "إنشاء الحساب";
      }
    }
  }

  function firebaseAdapterAvailable() {
    return (
      typeof window.HENOAuthBackend?.register === "function"
    );
  }

  /* =======================================================
     GOOGLE / FACEBOOK / PHONE LOGIN
  ======================================================= */

  async function authenticate(provider, mode = "login") {
    if (!providers[provider]) {
      toast("طريقة الدخول غير مدعومة.", "error");
      return;
    }

    emit("provider-auth-request", {
      provider,
      mode
    });

    const methods = {
      google: "signInWithGoogle",
      facebook: "signInWithFacebook",
      phone: "signInWithPhone",
      email: "signInWithEmail"
    };

    const method = methods[provider];

    if (
      !method ||
      typeof window.HENOAuthBackend?.[method] !== "function"
    ) {
      toast(
        "خدمة المصادقة غير متصلة. يلزم إعداد Firebase.",
        "error"
      );
      return;
    }

    try {
      await window.HENOAuthBackend[method]({
        mode,
        data: { ...state.data }
      });
    } catch (error) {
      toast(
        error.message || "تعذر إتمام تسجيل الدخول.",
        "error"
      );

      emit("authentication-error", {
        provider,
        error
      });
    }
  }

  /* =======================================================
     AUTH EVENT BRIDGE
  ======================================================= */

  document.addEventListener(
    "heno:auth-request",
    event => {
      const { provider, mode = "login" } = event.detail || {};

      if (provider === "email" && mode === "register") {
        startRegistration("email");
        return;
      }

      authenticate(provider, mode);
    }
  );

  /* =======================================================
     ACTION EVENTS
  ======================================================= */

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-auth-action]");

    if (!button) return;

    switch (button.dataset.authAction) {
      case "back":
        previousStep();
        break;

      case "register":
        startRegistration("email");
        break;

      case "login":
        closeRegistration();
        break;
    }
  });

  /* =======================================================
     PUBLIC API
  ======================================================= */

  function getState() {
    return {
      mode: state.mode,
      provider: state.provider,
      step: state.step,
      totalSteps: state.totalSteps
    };
  }

  return {
    startRegistration,
    startLogin,
    selectProvider,
    authenticate,
    previousStep,
    closeRegistration,
    getState,
    validateEmail,
    validatePhone,
    validateUsername,
    validatePassword
  };

})();

window.HENOAuth = HENOAuth;
