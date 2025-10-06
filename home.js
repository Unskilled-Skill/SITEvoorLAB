import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAsPg7svScxQijjpYNfqteLMLWH80gge4M",
  authDomain: "labwebsite-2ab57.firebaseapp.com",
  projectId: "labwebsite-2ab57",
  storageBucket: "labwebsite-2ab57.firebasestorage.app",
  messagingSenderId: "361466226719",
  appId: "1:361466226719:web:904d5f6fc1779f8efc0d2a",
  measurementId: "G-K8MD6033ZS",
  databaseURL: "https://labwebsite-2ab57-default-rtdb.europe-west1.firebasedatabase.app/"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getDatabase(app);

const SLIDE_INTERVAL_MS = 8000;

const state = {
  wrap: null,
  noteEl: null,
  statusEl: null,
  prevBtn: null,
  nextBtn: null,
  posts: [],
  index: 0,
  timerId: null
};

function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?/]+)/);
  return match ? match[1] : null;
}

function renderFallback(message) {
  if (!state.wrap) return;
  state.wrap.innerHTML = `
    <div class="hero__empty">
      <p>${message}</p>
    </div>`;
}

function renderMedia(post) {
  if (!state.wrap) return;
  state.wrap.innerHTML = "";

  if (!post) {
    renderFallback("The slideshow is empty right now.");
    return;
  }

  if (post.type === "youtube") {
    const videoId = extractYouTubeId(post.full);
    if (videoId) {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube.com/embed/${videoId}`;
      iframe.width = "100%";
      iframe.height = "100%";
      iframe.allowFullscreen = true;
      iframe.loading = "lazy";
      iframe.title = "Featured post";
      iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
      state.wrap.appendChild(iframe);
      return;
    }
  }

  if (post.type === "video") {
    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = post.full;
    state.wrap.appendChild(video);
    return;
  }

  const img = document.createElement("img");
  img.src = post.full;
  img.alt = "Featured post";
  img.loading = "lazy";
  state.wrap.appendChild(img);
}

function formatAuthor(post) {
  if (post.username) return post.username;
  if (post.email) return post.email.split("@")[0];
  return "Unknown user";
}

function formatDate(post) {
  if (!post.createdAt) return "";
  const created = new Date(post.createdAt);
  if (Number.isNaN(created.getTime())) return "";
  return created.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function updateStatus(post) {
  if (state.statusEl) {
    state.statusEl.textContent = `Post ${state.index + 1} / ${state.posts.length}`;
  }

  if (!state.noteEl || !post) return;

  const typeLabel = post.type === "video" ? "Video" : post.type === "youtube" ? "YouTube clip" : "Image";
  const author = formatAuthor(post);
  const dateLabel = formatDate(post);
  const datePart = dateLabel ? ` on ${dateLabel}` : "";
  state.noteEl.textContent = `Post ${state.index + 1} of ${state.posts.length} - ${typeLabel} by ${author}${datePart}.`;
}

function updateControls() {
  const disabled = state.posts.length <= 1;
  if (state.prevBtn) state.prevBtn.disabled = disabled;
  if (state.nextBtn) state.nextBtn.disabled = disabled;
}

function stopAutoAdvance() {
  if (state.timerId !== null) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function startAutoAdvance() {
  stopAutoAdvance();
  if (state.posts.length <= 1) return;
  state.timerId = window.setInterval(() => {
    showSlide(state.index + 1);
  }, SLIDE_INTERVAL_MS);
}

function restartAutoAdvance() {
  stopAutoAdvance();
  startAutoAdvance();
}

function showEmptyState(message, noteMessage) {
  stopAutoAdvance();
  const displayMessage = message || "No posts yet. Visit the collection to add the first one!";
  const note = noteMessage || "Tip: upvote posts in the collection to feature them here.";
  renderFallback(displayMessage);
  if (state.statusEl) state.statusEl.textContent = "";
  if (state.noteEl) state.noteEl.textContent = note;
  updateControls();
}

function showSlide(nextIndex) {
  if (!state.posts.length) {
    showEmptyState();
    return;
  }

  const total = state.posts.length;
  state.index = ((nextIndex % total) + total) % total;
  const post = state.posts[state.index];
  renderMedia(post);
  updateStatus(post);
  updateControls();
}

function applyPosts(posts) {
  const currentId = state.posts[state.index]?.id;
  state.posts = posts;

  if (!posts.length) {
    state.index = 0;
    showEmptyState();
    return;
  }

  let nextIndex = 0;
  if (currentId) {
    const found = posts.findIndex((post) => post.id === currentId);
    if (found >= 0) nextIndex = found;
  }

  showSlide(nextIndex);
  startAutoAdvance();
}

function parseSnapshot(snapshot) {
  const raw = snapshot.val();
  if (!raw) return [];

  return Object.entries(raw)
    .map(([id, value]) => ({ id, ...value }))
    .filter((post) => post && post.full)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function subscribeToPosts() {
  const postsRef = ref(db, "posts");
  onValue(postsRef, (snapshot) => {
    applyPosts(parseSnapshot(snapshot));
  }, (error) => {
    console.error("Failed to load posts", error);
    state.posts = [];
    state.index = 0;
    showEmptyState("Unable to load posts right now.", "Try again soon.");
  });
}

function bindControls() {
  if (state.prevBtn) {
    state.prevBtn.addEventListener("click", () => {
      if (!state.posts.length) return;
      showSlide(state.index - 1);
      restartAutoAdvance();
    });
  }

  if (state.nextBtn) {
    state.nextBtn.addEventListener("click", () => {
      if (!state.posts.length) return;
      showSlide(state.index + 1);
      restartAutoAdvance();
    });
  }

  const hoverTargets = [state.wrap, document.querySelector(".hero__nav")].filter(Boolean);
  hoverTargets.forEach((target) => {
    target.addEventListener("pointerenter", stopAutoAdvance);
    target.addEventListener("pointerleave", startAutoAdvance);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopAutoAdvance();
    } else {
      startAutoAdvance();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  state.wrap = document.getElementById("latestMedia");
  state.noteEl = document.getElementById("latestNote");
  state.statusEl = document.getElementById("slideStatus");
  state.prevBtn = document.getElementById("prevSlide");
  state.nextBtn = document.getElementById("nextSlide");

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const fab = document.getElementById("fabAddPost");
  if (fab) {
    fab.addEventListener("click", () => {
      window.location.href = "./index.html#uploadTile";
    });
  }

  if (state.noteEl) state.noteEl.textContent = "Loading posts...";
  if (state.wrap) renderFallback("Loading posts...");

  bindControls();
  subscribeToPosts();
});


