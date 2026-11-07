/* =========================================
   HENO CHAT — MEDIA ENGINE
   Images, Videos, Documents, Audio,
   Voice Notes and Attachment Preview.
========================================= */

const Media = (() => {
  "use strict";

  const MAX_FILE_SIZE = 25 * 1024 * 1024;

  const ALLOWED_TYPES = {
    image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    video: ["video/mp4", "video/webm", "video/quicktime"],
    audio: ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/webm", "audio/wav"],
    document: [
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ]
  };

  let selectedFiles = [];
  let recorder = null;
  let audioChunks = [];
  let recordingStream = null;
  let recordingStartedAt = 0;
  let recordingTimer = null;

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

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} بايت`;
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
  }

  function getFileType(file) {
    const type = file.type || "";

    for (const [category, mimeTypes] of Object.entries(ALLOWED_TYPES)) {
      if (mimeTypes.includes(type)) return category;
    }

    return "unknown";
  }

  function validateFile(file) {
    if (!(file instanceof File)) {
      return "الملف غير صالح";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "حجم الملف أكبر من الحد المسموح (25 ميجابايت)";
    }

    if (getFileType(file) === "unknown") {
      return "نوع الملف غير مدعوم";
    }

    return null;
  }

  function openPicker(type = "all") {
    const input = $("#mediaInput");
    if (!input) {
      notify("عنصر اختيار الملفات غير موجود في الصفحة");
      return;
    }

    const accept = {
      image: ALLOWED_TYPES.image.join(","),
      video: ALLOWED_TYPES.video.join(","),
      audio: ALLOWED_TYPES.audio.join(","),
      document: ALLOWED_TYPES.document.join(","),
      all: Object.values(ALLOWED_TYPES).flat().join(",")
    };

    input.accept = accept[type] || accept.all;
    input.multiple = true;
    input.click();
  }

  function handleFiles(files) {
    const accepted = [];

    [...files].forEach(file => {
      const error = validateFile(file);

      if (error) {
        notify(`${file.name}: ${error}`);
        return;
      }

      accepted.push(file);
    });

    selectedFiles = [...selectedFiles, ...accepted];

    renderPreview();
  }

  function renderPreview() {
    const container = $("#attachmentPreview");
    if (!container) return;

    if (!selectedFiles.length) {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }

    container.hidden = false;

    container.innerHTML = selectedFiles.map((file, index) => `
      <div class="attachment-item">
        <div class="attachment-details">
          <strong>${escapeHTML(file.name)}</strong>
          <small>${formatSize(file.size)}</small>
        </div>

        <button type="button"
          data-remove-file="${index}"
          aria-label="إزالة الملف">
          ×
        </button>
      </div>
    `).join("");
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

  async function sendSelectedFiles() {
    if (!selectedFiles.length) return;

    const conversation = window.HENOChat?.getActiveConversation();

    if (!conversation) {
      notify("افتح محادثة أولًا");
      return;
    }

    for (const file of selectedFiles) {
      const type = getFileType(file);

      /*
       * Object URLs are temporary browser references.
       * Firebase Storage upload will replace this
       * local preview mechanism later.
       */
      const url = URL.createObjectURL(file);

      window.HENOChat.sendMessage(file.name, {
        type: "file"
      });

      const message =
        conversation.messages[conversation.messages.length - 1];

      if (message) {
        message.media = {
          name: file.name,
          size: file.size,
          mimeType: file.type,
          category: type,
          localUrl: url
        };
      }
    }

    selectedFiles = [];
    renderPreview();

    notify("تمت إضافة المرفقات إلى المحادثة على هذا الجهاز");
  }

  function removeSelectedFile(index) {
    const file = selectedFiles[index];
    if (!file) return;

    selectedFiles.splice(index, 1);
    renderPreview();
  }

  // AUDIO RECORDING

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      notify("المتصفح لا يدعم تسجيل الصوت");
      return;
    }

    if (!window.MediaRecorder) {
      notify("تسجيل الصوت غير مدعوم في هذا المتصفح");
      return;
    }

    try {
      recordingStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      audioChunks = [];

      recorder = new MediaRecorder(recordingStream);

      recorder.addEventListener("dataavailable", event => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      });

      recorder.addEventListener("stop", finishRecording);

      recorder.start();
      recordingStartedAt = Date.now();

      updateRecordingUI(true);
      startRecordingClock();

    } catch (error) {
      console.error("Microphone error:", error);
      notify("لم يتم السماح باستخدام الميكروفون");
    }
  }

  function stopRecording() {
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    stopRecordingClock();
    stopRecordingTracks();
    updateRecordingUI(false);
  }

  function cancelRecording() {
    audioChunks = [];

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }

    stopRecordingClock();
    stopRecordingTracks();
    updateRecordingUI(false);

    notify("تم إلغاء التسجيل");
  }

  function finishRecording() {
    if (!audioChunks.length) return;

    const mimeType = recorder?.mimeType || "audio/webm";
    const blob = new Blob(audioChunks, { type: mimeType });

    if (blob.size > MAX_FILE_SIZE) {
      notify("التسجيل أكبر من الحجم المسموح");
      return;
    }

    const file = new File(
      [blob],
      `heno-voice-${Date.now()}.webm`,
      { type: mimeType }
    );

    const conversation = window.HENOChat?.getActiveConversation();

    if (!conversation) {
      notify("افتح محادثة لحفظ التسجيل");
      return;
    }

    const url = URL.createObjectURL(file);

    window.HENOChat.sendMessage("رسالة صوتية", {
      type: "audio"
    });

    const message =
      conversation.messages[conversation.messages.length - 1];

    if (message) {
      message.media = {
        name: file.name,
        size: file.size,
        mimeType: file.type,
        category: "audio",
        localUrl: url
      };
    }

    notify("تم حفظ التسجيل الصوتي محليًا");
  }

  function stopRecordingTracks() {
    recordingStream?.getTracks().forEach(track => track.stop());
    recordingStream = null;
  }

  function startRecordingClock() {
    stopRecordingClock();

    recordingTimer = setInterval(() => {
      const seconds = Math.floor(
        (Date.now() - recordingStartedAt) / 1000
      );

      const clock = $("#recordingTime");

      if (clock) {
        clock.textContent =
          `${String(Math.floor(seconds / 60)).padStart(2, "0")}:` +
          `${String(seconds % 60).padStart(2, "0")}`;
      }
    }, 500);
  }

  function stopRecordingClock() {
    if (recordingTimer) {
      clearInterval(recordingTimer);
      recordingTimer = null;
    }

    const clock = $("#recordingTime");
    if (clock) clock.textContent = "00:00";
  }

  function updateRecordingUI(active) {
    const panel = $("#recordingPanel");

    if (panel) {
      panel.hidden = !active;
    }

    const button = $("#recordVoiceButton");

    if (button) {
      button.classList.toggle("recording", active);
      button.setAttribute(
        "aria-label",
        active ? "إيقاف التسجيل" : "بدء التسجيل"
      );
    }
  }

  // PLAY MEDIA

  function previewMedia(url, type) {
    const layer = $("#mediaViewer");
    if (!layer) return;

    let content = "";

    if (type === "image") {
      content = `<img src="${escapeHTML(url)}" alt="معاينة الصورة">`;
    } else if (type === "video") {
      content = `
        <video controls autoplay playsinline>
          <source src="${escapeHTML(url)}">
        </video>
      `;
    } else if (type === "audio") {
      content = `
        <audio controls autoplay>
          <source src="${escapeHTML(url)}">
        </audio>
      `;
    }

    layer.innerHTML = `
      <div class="media-viewer-content">
        <button type="button" data-media-close>×</button>
        ${content}
      </div>
    `;

    layer.hidden = false;
  }

  function closeViewer() {
    const layer = $("#mediaViewer");

    if (!layer) return;

    layer.querySelectorAll("video, audio").forEach(media => {
      media.pause();
    });

    layer.hidden = true;
    layer.innerHTML = "";
  }

  // EVENTS

  function bindEvents() {
    $("#mediaInput")?.addEventListener("change", event => {
      handleFiles(event.target.files);
      event.target.value = "";
    });

    $("#sendAttachmentsButton")?.addEventListener(
      "click",
      sendSelectedFiles
    );

    $("#attachmentPreview")?.addEventListener("click", event => {
      const button = event.target.closest("[data-remove-file]");
      if (!button) return;

      removeSelectedFile(Number(button.dataset.removeFile));
    });

    $("#recordVoiceButton")?.addEventListener("click", () => {
      if (recorder && recorder.state === "recording") {
        stopRecording();
      } else {
        startRecording();
      }
    });

    $("#cancelRecordingButton")?.addEventListener(
      "click",
      cancelRecording
    );

    $("#mediaViewer")?.addEventListener("click", event => {
      if (event.target.closest("[data-media-close]")) {
        closeViewer();
      }
    });

    document.addEventListener("click", event => {
      const button = event.target.closest("[data-media-type]");
      if (!button) return;

      openPicker(button.dataset.mediaType);
    });
  }

  function init() {
    bindEvents();

    document.dispatchEvent(
      new CustomEvent("heno:media-ready")
    );
  }

  return {
    init,
    openPicker,
    handleFiles,
    sendSelectedFiles,
    removeSelectedFile,
    startRecording,
    stopRecording,
    cancelRecording,
    previewMedia,
    closeViewer
  };
})();

window.HENOMedia = Media;
