/* =========================================
   HENO CHAT — CALLS ENGINE
   Audio / Video call interface
   WebRTC signaling will be integrated later.
========================================= */

const Calls = (() => {
  "use strict";

  const state = {
    active: false,
    type: null,
    status: "idle",
    stream: null,
    cameraEnabled: true,
    microphoneEnabled: true,
    speakerEnabled: true,
    startedAt: null,
    timer: null,
    seconds: 0,
    peerConnection: null
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

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

  function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remaining = seconds % 60;

    const time = [
      String(minutes).padStart(2, "0"),
      String(remaining).padStart(2, "0")
    ];

    if (hours > 0) {
      time.unshift(String(hours).padStart(2, "0"));
    }

    return time.join(":");
  }

  function renderCallScreen() {
    const screen = $("#callScreen");
    if (!screen) return;

    screen.hidden = !state.active;

    if (!state.active) return;

    const title = $("#callTitle");
    const subtitle = $("#callSubtitle");
    const timer = $("#callTimer");
    const video = $("#localCallVideo");

    if (title) {
      title.textContent =
        state.type === "video"
          ? "مكالمة فيديو"
          : "مكالمة صوتية";
    }

    if (subtitle) {
      subtitle.textContent =
        state.status === "connecting"
          ? "جاري تجهيز الوسائط..."
          : "الوسائط المحلية جاهزة — لم يتم الاتصال بالطرف الآخر";
    }

    if (timer) {
      timer.textContent = formatDuration(state.seconds);
    }

    if (video && state.stream) {
      video.srcObject = state.stream;
    }
  }

  async function requestMedia(type) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("المتصفح لا يدعم الوصول إلى الكاميرا والميكروفون");
    }

    const constraints = {
      audio: true,
      video: type === "video"
        ? {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        : false
    };

    return navigator.mediaDevices.getUserMedia(constraints);
  }

  async function startCall(type = "audio", contact = null) {
    if (state.active) {
      notify("هناك مكالمة مفتوحة بالفعل");
      return false;
    }

    state.active = true;
    state.type = type === "video" ? "video" : "audio";
    state.status = "connecting";
    state.seconds = 0;
    state.startedAt = null;

    renderCallScreen();

    try {
      state.stream = await requestMedia(state.type);

      state.status = "local-ready";

      state.microphoneEnabled = true;
      state.cameraEnabled = state.type === "video";

      renderCallScreen();
      updateControls();

      notify(
        "تم تشغيل الوسائط على جهازك. الاتصال بالطرف الآخر غير مفعّل بعد."
      );

      document.dispatchEvent(
        new CustomEvent("heno:call-local-ready", {
          detail: {
            type: state.type,
            contact
          }
        })
      );

      return true;

    } catch (error) {
      console.error("Call media error:", error);

      state.status = "error";

      endCall();

      notify(
        error.name === "NotAllowedError"
          ? "اسمح باستخدام الكاميرا والميكروفون من إعدادات المتصفح"
          : "تعذر تشغيل الكاميرا أو الميكروفون"
      );

      return false;
    }
  }

  function startTimer() {
    stopTimer();

    state.startedAt = Date.now();

    state.timer = setInterval(() => {
      state.seconds = Math.floor(
        (Date.now() - state.startedAt) / 1000
      );

      const element = $("#callTimer");

      if (element) {
        element.textContent = formatDuration(state.seconds);
      }
    }, 1000);
  }

  function stopTimer() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function toggleMicrophone() {
    if (!state.stream) return;

    state.microphoneEnabled = !state.microphoneEnabled;

    state.stream.getAudioTracks().forEach(track => {
      track.enabled = state.microphoneEnabled;
    });

    updateControls();
  }

  function toggleCamera() {
    if (!state.stream || state.type !== "video") return;

    state.cameraEnabled = !state.cameraEnabled;

    state.stream.getVideoTracks().forEach(track => {
      track.enabled = state.cameraEnabled;
    });

    updateControls();
  }

  function toggleSpeaker() {
    state.speakerEnabled = !state.speakerEnabled;

    const remoteAudio = $("#remoteCallAudio");

    if (remoteAudio) {
      remoteAudio.muted = !state.speakerEnabled;
    }

    updateControls();
  }

  function updateControls() {
    const microphone = $("#toggleCallMic");
    const camera = $("#toggleCallCamera");
    const speaker = $("#toggleCallSpeaker");

    if (microphone) {
      microphone.classList.toggle(
        "disabled",
        !state.microphoneEnabled
      );
      microphone.setAttribute(
        "aria-pressed",
        String(state.microphoneEnabled)
      );
    }

    if (camera) {
      camera.classList.toggle(
        "disabled",
        !state.cameraEnabled
      );
      camera.setAttribute(
        "aria-pressed",
        String(state.cameraEnabled)
      );
    }

    if (speaker) {
      speaker.classList.toggle(
        "disabled",
        !state.speakerEnabled
      );
      speaker.setAttribute(
        "aria-pressed",
        String(state.speakerEnabled)
      );
    }
  }

  function endCall() {
    stopTimer();

    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
    }

    if (state.peerConnection) {
      state.peerConnection.close();
    }

    state.stream = null;
    state.peerConnection = null;

    state.active = false;
    state.type = null;
    state.status = "idle";
    state.startedAt = null;
    state.seconds = 0;

    const video = $("#localCallVideo");

    if (video) {
      video.srcObject = null;
    }

    renderCallScreen();

    document.dispatchEvent(
      new CustomEvent("heno:call-ended")
    );
  }

  function setupEvents() {
    $("#toggleCallMic")?.addEventListener(
      "click",
      toggleMicrophone
    );

    $("#toggleCallCamera")?.addEventListener(
      "click",
      toggleCamera
    );

    $("#toggleCallSpeaker")?.addEventListener(
      "click",
      toggleSpeaker
    );

    $("#endCallButton")?.addEventListener(
      "click",
      endCall
    );

    document.addEventListener("click", event => {
      const button = event.target.closest("[data-call-type]");
      if (!button) return;

      const type = button.dataset.callType;

      if (type === "audio" || type === "video") {
        startCall(type);
      }
    });
  }

  function init() {
    setupEvents();

    document.dispatchEvent(
      new CustomEvent("heno:calls-ready")
    );
  }

  return {
    init,
    startCall,
    endCall,
    toggleMicrophone,
    toggleCamera,
    toggleSpeaker,
    getState: () => ({ ...state })
  };
})();

window.HENOC
  = Calls;
