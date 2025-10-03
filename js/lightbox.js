// js/lightbox.js
import { renderComments, addComment } from "./comments.js";

export function initLightbox() {
  const lightbox = document.getElementById("lightbox");
  const lbMedia = document.getElementById("lbMedia");
  const lbComments = document.getElementById("lbComments");
  const lbForm = document.getElementById("lbForm");
  const lbText = document.getElementById("lbText");
  const lbClose = lightbox?.querySelector(".lightbox__close");

  let currentPostId = null;

  function openLightbox(article) {
    const id = article.getAttribute("data-id");
    if (!id) return;

    const full = article.getAttribute("data-full");
    if (!full) return;

    currentPostId = id;

    lbMedia.innerHTML = "";

    if (article.dataset.type === "youtube") {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube.com/embed/${extractYouTubeId(full)}`;
      iframe.width = "100%";
      iframe.height = "315";
      iframe.allowFullscreen = true;
      lbMedia.appendChild(iframe);
    } else if (article.dataset.type === "video") {
      const video = document.createElement("video");
      video.src = full;
      video.controls = true;
      video.autoplay = true;
      lbMedia.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = full;
      img.alt = "Full post";
      lbMedia.appendChild(img);
    }

    renderComments(lbComments, id);

    lightbox.classList.add("is-open");
    lightbox.removeAttribute("hidden");
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("hidden", "");
    lbMedia.innerHTML = "";
    lbComments.innerHTML = "";
    try { lbForm.reset(); } catch {}
    currentPostId = null;
  }

  document.addEventListener("click", (e) => {
    const commentBtn = e.target.closest(".btn-action");
    if (commentBtn) {
      const card = commentBtn.closest(".post");
      if (!card || card.classList.contains("upload")) return;
      e.preventDefault();
      e.stopPropagation();
      openLightbox(card);
    }
  });

  document.addEventListener("click", (e) => {
    const card = e.target.closest(".post");
    if (!card || card.classList.contains("upload")) return;
    if (e.target.closest(".post-actions") || e.target.closest("button")) return;
    openLightbox(card);
  });

  lbForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentPostId) return;

    if (!window.currentUser) {
      alert("You must be logged in to comment!");
      return;
    }

    const text = lbText.value.trim();
    if (!text) return;

    const name = window.currentUser.username;
    addComment(currentPostId, name, text);
    lbText.value = "";
    renderComments(lbComments, currentPostId);
  });

  lbClose?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox?.classList.contains("is-open")) {
      closeLightbox();
    }
  });

  return { bindOpenToPosts: () => {} };
}

function extractYouTubeId(url) {
  const match = url.match(/(?:youtube\.com\/.*v=|youtu\.be\/)([^&]+)/);
  return match ? match[1] : null;
}
