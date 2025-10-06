// ============================================================
//  IMPORTS
// ============================================================
import { ref, set, push, onValue, get, remove } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import { initLightbox } from "./lightbox.js";

// ============================================================
//  HELPERS
// ============================================================
function getUsernameFromEmail(email) {
  if (!email.endsWith("@student.avans.nl")) return null;
  return email.split("@")[0];
}

function extractYouTubeId(url) {
  // Handles normal and Shorts URLs
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?/]+)/);
  return match ? match[1] : null;
}

// ============================================================
//  AUTHENTICATION
// ============================================================
function initAuth() {
  const emailInput = document.getElementById("loginEmail");
  const passInput = document.getElementById("loginPassword");
  const loginBtn = document.getElementById("loginBtn");
  const regBtn = document.getElementById("registerBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // Register
  regBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const pass = passInput.value.trim();
    if (!email.endsWith("@student.avans.nl")) {
      alert("Only @student.avans.nl emails allowed!");
      return;
    }
    try {
      await createUserWithEmailAndPassword(window.auth, email, pass);
      alert("Account created!");
    } catch (err) {
      alert("Error: " + err.message);
    }
  });

  // Login
  loginBtn.addEventListener("click", async () => {
    try {
      await signInWithEmailAndPassword(window.auth, emailInput.value.trim(), passInput.value.trim());
    } catch (err) {
      alert("Login failed: " + err.message);
    }
  });

  // Logout
  logoutBtn.addEventListener("click", async () => await signOut(window.auth));

  // Auth listener
  onAuthStateChanged(window.auth, (user) => {
    if (user && user.email.endsWith("@student.avans.nl")) {
      window.currentUser = {
        uid: user.uid,
        username: getUsernameFromEmail(user.email),
        email: user.email
      };
      console.log("Logged in as:", window.currentUser.username);
    } else {
      window.currentUser = null;
      console.log("Not logged in");
    }
  });
}

// ============================================================
//  UPLOAD POSTS
// ============================================================
function setupUpload() {
  const uploadTile = document.getElementById("uploadTile");
  if (!uploadTile) return;

  uploadTile.addEventListener("click", async () => {
    if (!window.currentUser) return alert("Login to upload a meme!");
    const url = prompt("Paste an image, video, or YouTube/Imgur URL:");
    if (!url) return;

    let type;
    if (/youtube\.com|youtu\.be/.test(url)) {
      const id = extractYouTubeId(url);
      if (!id) return alert("Invalid YouTube link!");
      type = "youtube";
    } else if (url.match(/\.(mp4|webm|ogg)$/i)) {
      type = "video";
    } else if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      const img = new Image();
      img.onload = async () => savePost(url, "image");
      img.onerror = () => alert("Invalid image URL!");
      img.src = url;
      return;
    } else return alert("Unsupported link type!");

    await savePost(url, type);
  });
}

async function savePost(url, type) {
  const newPostRef = push(ref(window.db, "posts"));
  await set(newPostRef, {
    userId: window.currentUser.uid,
    username: window.currentUser.username,
    email: window.currentUser.email,
    type,
    full: url,
    createdAt: Date.now()
  });
}

// ============================================================
//  VOTES (toggle + score cache)
// ============================================================
const voteScores = {}; // cache of post scores

async function submitVote(postId, type) {
  if (!window.currentUser) return alert("Login to vote!");
  const userVoteRef = ref(window.db, `votes/${postId}/${window.currentUser.uid}`);
  const snap = await get(userVoteRef);
  const existing = snap.val();

  // Clicking same button again removes your vote
  if (existing === type) {
    await remove(userVoteRef);
  } else {
    await set(userVoteRef, type);
  }
}

function listenForVotes(post, postId) {
  const upEl = post.querySelector(".upvote-count");
  const downEl = post.querySelector(".downvote-count");
  const upBtn = post.querySelector(".upvote");
  const downBtn = post.querySelector(".downvote");
  if (!upEl || !downEl) return;

  onValue(ref(window.db, `votes/${postId}`), (snap) => {
    const votes = snap.val() || {};
    const up = Object.values(votes).filter(v => v === "upvote").length;
    const down = Object.values(votes).filter(v => v === "downvote").length;
    upEl.textContent = up;
    downEl.textContent = down;
    voteScores[postId] = up - down;

    // Highlight user's current vote
    if (window.currentUser) {
      const myVote = votes[window.currentUser.uid];
      upBtn.classList.toggle("active-up", myVote === "upvote");
      downBtn.classList.toggle("active-down", myVote === "downvote");
    } else {
      upBtn.classList.remove("active-up");
      downBtn.classList.remove("active-down");
    }

    resortFeed(); // only reorders DOM, no new listeners
  });
}


// ============================================================
//  FEED RENDERING + SORTING
// ============================================================
let currentSort = "recent";

function listenForPosts() {
  const grid = document.querySelector(".post-grid");
  const uploadTile = document.querySelector(".post.upload");
  if (!grid) return;

  onValue(ref(window.db, "posts"), (snapshot) => {
    const data = snapshot.val() || {};
    grid.querySelectorAll(".post:not(.upload):not(.placeholder)").forEach(el => el.remove());

    let posts = Object.entries(data);

    if (currentSort === "recent") {
      posts.sort((a, b) => b[1].createdAt - a[1].createdAt);
    } else if (currentSort === "upvoted") {
      posts.sort((a, b) => (voteScores[b[0]] || 0) - (voteScores[a[0]] || 0));
    }

    posts.forEach(([id, post]) => renderPost(id, post, grid, uploadTile));

    const ph = document.getElementById("loadingPlaceholder");
    if (ph) ph.remove();
  });
}

// resort only existing posts when scores change
function resortFeed() {
  if (currentSort !== "upvoted") return;

  const grid = document.querySelector(".post-grid");
  if (!grid) return;

  const posts = Array.from(grid.querySelectorAll(".post:not(.upload)"));
  posts.sort((a, b) => (voteScores[b.dataset.id] || 0) - (voteScores[a.dataset.id] || 0));

  const uploadTile = grid.querySelector(".post.upload");
  posts.forEach(p => grid.insertBefore(p, uploadTile));
}

function renderPost(id, post, grid, uploadTile) {
  const card = document.createElement("article");
  card.className = "post";
  card.dataset.id = id;
  card.dataset.type = post.type;
  card.dataset.full = post.full;

  // --- media wrapper ---
  const mediaWrap = document.createElement("div");
  mediaWrap.className = "post-media";

  let mediaEl;
  if (post.type === "youtube") {
    const vid = extractYouTubeId(post.full);
    if (vid) {
      mediaEl = document.createElement("iframe");
      mediaEl.src = `https://www.youtube.com/embed/${vid}`;
      mediaEl.allowFullscreen = true;
    }
  } else if (post.type === "video") {
    mediaEl = document.createElement("video");
    mediaEl.src = post.full;
    mediaEl.controls = true;
  } else {
    mediaEl = document.createElement("img");
    mediaEl.src = post.full;
    mediaEl.alt = "Uploaded image";
    mediaEl.loading = "lazy";
  }

  if (mediaEl) mediaWrap.appendChild(mediaEl);
  card.appendChild(mediaWrap);

  // --- action bar ---
  const actions = document.createElement("div");
  actions.className = "post-actions";
  actions.innerHTML = `
    <button class="btn-vote upvote">▲ <span class="upvote-count">0</span></button>
    <button class="btn-vote downvote">▼ <span class="downvote-count">0</span></button>
    <button class="btn-action">Comment</button>
  `;

  // Owner-only delete
  if (window.currentUser?.email === "rrp.faverey@student.avans.nl") {
    const delBtn = document.createElement("button");
    delBtn.className = "btn-delete";
    delBtn.textContent = "🗑 Delete";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("Delete this post?")) set(ref(window.db, `posts/${id}`), null);
    });
    actions.appendChild(delBtn);
  }

  card.appendChild(actions);
  grid.insertBefore(card, uploadTile);

  listenForVotes(card, id);

  // Voting
  card.querySelector(".upvote")?.addEventListener("click", (e) => {
    e.stopPropagation();
    submitVote(id, "upvote");
  });
  card.querySelector(".downvote")?.addEventListener("click", (e) => {
    e.stopPropagation();
    submitVote(id, "downvote");
  });
}

// ============================================================
//  INIT EVERYTHING
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  setupUpload();
  listenForPosts();

  const fab = document.getElementById("fabAddPost");
  if (fab) {
    fab.addEventListener("click", () => {
      const uploadTile = document.getElementById("uploadTile");
      if (uploadTile) {
        uploadTile.scrollIntoView({ behavior: "smooth", block: "center" });
        uploadTile.click();
      }
    });
  }

  const { bindOpenToPosts } = initLightbox();
  bindOpenToPosts();

  const setSortMode = (mode) => {
    currentSort = mode;
    document.getElementById("sortRecent").classList.toggle("active", mode === "recent");
    document.getElementById("sortUpvoted").classList.toggle("active", mode === "upvoted");
    listenForPosts();
  };

  document.getElementById("sortRecent").onclick = () => setSortMode("recent");
  document.getElementById("sortUpvoted").onclick = () => setSortMode("upvoted");
  setSortMode("recent");

  console.log("All systems ready!");
});

