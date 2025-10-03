// js/main.js
// ---------------------------------------------
// Auth + Posts + Voting + Upload (URL-based) + Lightbox
// ---------------------------------------------

import { ref, set, push, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import { initLightbox } from "./lightbox.js";

/* ---------------------------
   Helpers
---------------------------- */
function getUsernameFromEmail(email) {
  if (!email.endsWith("@student.avans.nl")) return null;
  return email.split("@")[0];
}

function extractYouTubeId(url) {
  const match = url.match(/(?:youtube\.com\/.*v=|youtu\.be\/)([^&]+)/);
  return match ? match[1] : null;
}

/* ---------------------------
   Firebase Auth
---------------------------- */
function initAuth() {
  const emailInput = document.getElementById("loginEmail");
  const passInput = document.getElementById("loginPassword");
  const loginBtn = document.getElementById("loginBtn");
  const regBtn = document.getElementById("registerBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  regBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const pass = passInput.value.trim();
    if (!email.endsWith("@student.avans.nl")) {
      alert("Only @student.avans.nl accounts are allowed!");
      return;
    }
    try {
      await createUserWithEmailAndPassword(window.auth, email, pass);
      alert("Account created!");
    } catch (err) {
      alert("Error: " + err.message);
    }
  });

  loginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const pass = passInput.value.trim();
    try {
      await signInWithEmailAndPassword(window.auth, email, pass);
    } catch (err) {
      alert("Login failed: " + err.message);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await signOut(window.auth);
  });

  onAuthStateChanged(window.auth, (user) => {
    if (user && user.email.endsWith("@student.avans.nl")) {
      const username = getUsernameFromEmail(user.email);
      console.log("Logged in as:", username);

      loginBtn.hidden = true;
      regBtn.hidden = true;
      logoutBtn.hidden = false;

      window.currentUser = { uid: user.uid, username, email: user.email };
    } else {
      console.log("Not logged in");

      loginBtn.hidden = false;
      regBtn.hidden = false;
      logoutBtn.hidden = true;

      window.currentUser = null;
    }
  });
}

/* ---------------------------
   Voting System
---------------------------- */
function initializeVotingSystem() {
  function submitVote(postId, type) {
    if (!window.currentUser) {
      alert("You must be logged in to vote!");
      return;
    }
    const voteRef = ref(window.db, `votes/${postId}/${window.currentUser.uid}`);
    set(voteRef, type);
  }

  function listenForVotes(post, postId) {
    const upvoteCountEl = post.querySelector(".upvote-count");
    const downvoteCountEl = post.querySelector(".downvote-count");
    if (!upvoteCountEl || !downvoteCountEl) return;

    const voteRef = ref(window.db, `votes/${postId}`);
    onValue(voteRef, (snapshot) => {
      const votes = snapshot.val() || {};
      const up = Object.values(votes).filter((v) => v === "upvote").length;
      const down = Object.values(votes).filter((v) => v === "downvote").length;
      upvoteCountEl.textContent = up;
      downvoteCountEl.textContent = down;
    });
  }

  document.querySelectorAll(".post").forEach((post) => {
    if (post.classList.contains("upload")) return;
    const postId = post.dataset.id;
    const upvoteBtn = post.querySelector(".btn-vote.upvote");
    const downvoteBtn = post.querySelector(".btn-vote.downvote");

    listenForVotes(post, postId);

    upvoteBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      submitVote(postId, "upvote");
    });

    downvoteBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      submitVote(postId, "downvote");
    });
  });
}

/* ---------------------------
   Upload new memes (URL input)
---------------------------- */
function setupUpload() {
  const uploadTile = document.querySelector(".post.upload");
  if (!uploadTile) return;

  uploadTile.addEventListener("click", async () => {
    if (!window.currentUser) {
      alert("You must be logged in to upload a meme!");
      return;
    }

    const url = prompt("Paste an image/video/YouTube/Imgur URL:");
    if (!url) return;

    let type = "image";

    if (/youtube\.com|youtu\.be/.test(url)) {
      type = "youtube";
    } else if (url.match(/\.(mp4|webm|ogg)$/i)) {
      type = "video";
    } else {
      type = "image";
    }

    const postsRef = ref(window.db, "posts");
    const newPostRef = push(postsRef);

    await set(newPostRef, {
      userId: window.currentUser.uid,
      username: window.currentUser.username,
      email: window.currentUser.email,
      type,
      full: url,
      createdAt: Date.now()
    });
  });
}

/* ---------------------------
   Listen for posts (live feed)
---------------------------- */
function listenForPosts() {
  const grid = document.querySelector(".post-grid");
  const uploadTile = document.querySelector(".post.upload");
  if (!grid) return;

  const postsRef = ref(window.db, "posts");
  onValue(postsRef, (snapshot) => {
    const data = snapshot.val() || {};

    grid.querySelectorAll(".post:not(.upload)").forEach(el => el.remove());

    Object.entries(data)
      .sort((a, b) => b[1].createdAt - a[1].createdAt)
      .forEach(([id, post]) => {
        const card = document.createElement("article");
        card.className = "post";
        card.dataset.id = id;
        card.dataset.type = post.type;
        card.dataset.full = post.full;

        if (post.type === "youtube") {
          const videoId = extractYouTubeId(post.full);
          if (videoId) {
            const iframe = document.createElement("iframe");
            iframe.src = `https://www.youtube.com/embed/${videoId}`;
            iframe.width = "100%";
            iframe.height = "315";
            iframe.allowFullscreen = true;
            card.appendChild(iframe);
          }
        } else if (post.type === "video") {
          const video = document.createElement("video");
          video.src = post.full;
          video.controls = true;
          card.appendChild(video);
        } else {
          const img = document.createElement("img");
          img.src = post.full;
          img.alt = "Uploaded image";
          img.loading = "lazy";
          card.appendChild(img);
        }

        const actions = document.createElement("div");
        actions.className = "post-actions";
        actions.innerHTML = `
          <button class="btn-vote upvote">▲ <span class="upvote-count">0</span></button>
          <button class="btn-vote downvote">▼ <span class="downvote-count">0</span></button>
          <button class="btn-action">Comment</button>
        `;

        // ✅ delete button for owner account
        if (window.currentUser && window.currentUser.email === "rrp.faverey@student.avans.nl") {
          const delBtn = document.createElement("button");
          delBtn.className = "btn-delete";
          delBtn.textContent = "🗑 Delete";
          delBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm("Are you sure you want to delete this post?")) {
              const postRef = ref(window.db, `posts/${id}`);
              set(postRef, null);
            }
          });
          actions.appendChild(delBtn);
        }

        card.appendChild(actions);

        grid.insertBefore(card, uploadTile);
      });

    initializeVotingSystem();
  });
}

/* -----------------------
   DOM Ready
------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();

  initAuth();
  listenForPosts();
  setupUpload();
  initializeVotingSystem();

  const { bindOpenToPosts } = initLightbox();
  bindOpenToPosts();

  console.log("All systems ready!");
});
