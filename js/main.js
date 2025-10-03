// js/main.js
// ---------------------------------------------
// Entry for the feed + uploads + video posters
// ---------------------------------------------

import { initLightbox } from './lightbox.js';

/* ---------------------------
   Helpers: "latest post"
---------------------------- */
function saveLatestPost(obj) {
  try { localStorage.setItem('latestPost', JSON.stringify(obj)); } catch {}
}

function updateLatestFromDocument() {
  const first = document.querySelector('.post-grid .post:not(.upload)');
  if (!first) return;
  const type = first.getAttribute('data-type') || 'image';
  const full = first.getAttribute('data-full');
  if (!full) return;
  const poster = first.querySelector('img.thumb')?.src || null;
  saveLatestPost({ type, full, poster });
}

/* ---------------------------
   Helpers: posters for video
---------------------------- */
async function generatePoster(src, atSec = 0.1) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = true;
    video.src = src;

    const bail = () => reject(new Error('Could not load video: ' + src));
    video.addEventListener('error', bail, { once: true });

    video.addEventListener('loadeddata', async () => {
      try {
        const target = Math.min(atSec, (video.duration || 1) - 0.05);
        if (!Number.isNaN(target)) {
          await new Promise((r) => {
            const on = () => { video.removeEventListener('seeked', on); r(); };
            video.addEventListener('seeked', on);
            video.currentTime = target;
          });
        }
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 360;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch (err) {
        reject(err);
      }
    }, { once: true });
  });
}

async function hydrateVideoThumbnails() {
  const cards = document.querySelectorAll('.post[data-type="video"]');
  for (const card of cards) {
    try {
      const full = card.getAttribute('data-full');
      if (!full) continue;

      let img = card.querySelector('img.thumb');
      if (!img) {
        img = document.createElement('img');
        img.className = 'thumb';
        img.alt = 'Video thumbnail';
        card.prepend(img);
      }

      const key = 'poster:' + full;
      let poster = sessionStorage.getItem(key);
      if (!poster) {
        poster = await generatePoster(full, 0.12);
        sessionStorage.setItem(key, poster);
      }
      img.src = poster;

      if (!card.querySelector('.play-badge')) {
        const badge = document.createElement('span');
        badge.className = 'play-badge';
        badge.textContent = '▶';
        badge.setAttribute('aria-hidden', 'true');
        card.appendChild(badge);
      }
    } catch (err) {
      console.warn('Poster generation failed:', err);
    }
  }
}

/* --------------------------------------
   Upload tile → add image/video to grid
--------------------------------------- */
function setupUpload({ onAfterAdd }) {
  const grid = document.querySelector('.post-grid');
  const uploadTile = document.querySelector('.post.upload');
  if (!grid || !uploadTile) return;

  let fileInput = uploadTile.querySelector('input[type="file"]');
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,video/*';
    fileInput.hidden = true;
    uploadTile.appendChild(fileInput);
  }

  uploadTile.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');
    const id = `u_${Date.now()}`;

    const card = document.createElement('article');
    card.className = 'post';
    card.setAttribute('data-id', id);
    card.setAttribute('data-type', isVideo ? 'video' : 'image');
    card.setAttribute('data-full', url);

    if (isVideo) {
      const img = document.createElement('img');
      img.className = 'thumb';
      img.alt = 'Uploaded video thumbnail';
      card.appendChild(img);
      try { img.src = await generatePoster(url, 0.15); } catch {}
      const badge = document.createElement('span');
      badge.className = 'play-badge';
      badge.textContent = '▶';
      badge.setAttribute('aria-hidden', 'true');
      card.appendChild(badge);
    } else {
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Uploaded image';
      img.loading = 'lazy';
      card.appendChild(img);
    }

    // Post actions
    const actions = document.createElement('div');
    actions.className = 'post-actions';

    const upvoteBtn = document.createElement('button');
    upvoteBtn.className = 'btn-vote upvote';
    upvoteBtn.title = 'Upvote';
    upvoteBtn.innerHTML = '▲ <span class="upvote-count">0</span>';
    actions.appendChild(upvoteBtn);

    const downvoteBtn = document.createElement('button');
    downvoteBtn.className = 'btn-vote downvote';
    downvoteBtn.title = 'Downvote';
    downvoteBtn.innerHTML = '▼ <span class="downvote-count">0</span>';
    actions.appendChild(downvoteBtn);

    const commentBtn = document.createElement('button');
    commentBtn.className = 'btn-action';
    commentBtn.textContent = 'Comment';
    actions.appendChild(commentBtn);

    card.appendChild(actions);

    grid.insertBefore(card, uploadTile);

    if (typeof onAfterAdd === 'function') onAfterAdd(card);

    fileInput.value = '';
  });
}

/* --------------------------------------
   Broken image helper
--------------------------------------- */
function setupImageErrorPlaceholder() {
  document.querySelectorAll('.post img').forEach((img) => {
    img.addEventListener('error', () => {
      console.warn('Image not found:', img.getAttribute('src'));
      const ph = document.createElement('div');
      ph.className = 'post__placeholder';
      ph.textContent = 'Image not found';
      img.replaceWith(ph);
    });
  });
}

/* ---------------------------
   Per-User Voting System
---------------------------- */
function initializeVotingSystem() {
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem('userId', userId);
  }

  let votes = new Map();
  let voteCounts = new Map();

  const savedVotes = localStorage.getItem('postVotes');
  if (savedVotes) votes = new Map(JSON.parse(savedVotes));

  const savedCounts = localStorage.getItem('postVoteCounts');
  if (savedCounts) voteCounts = new Map(JSON.parse(savedCounts));

  function saveVotes() {
    localStorage.setItem('postVotes', JSON.stringify(Array.from(votes.entries())));
    localStorage.setItem('postVoteCounts', JSON.stringify(Array.from(voteCounts.entries())));
  }

  function updateVoteCounts(post, postId) {
    const upvoteCountEl = post.querySelector('.upvote-count');
    const downvoteCountEl = post.querySelector('.downvote-count');
    if (!upvoteCountEl || !downvoteCountEl) return;
    const counts = voteCounts.get(postId) || { up: 0, down: 0 };
    upvoteCountEl.textContent = counts.up;
    downvoteCountEl.textContent = counts.down;
  }

  function updateVoteUI(post, postId) {
    const upvoteBtn = post.querySelector('.btn-vote.upvote');
    const downvoteBtn = post.querySelector('.btn-vote.downvote');
    if (!upvoteBtn || !downvoteBtn) return; // <-- safeguard
    const currentVote = votes.get(postId)?.[userId] || null;
    upvoteBtn.classList.toggle('active', currentVote === 'upvote');
    downvoteBtn.classList.toggle('active', currentVote === 'downvote');
  }

  function handleVote(button) {
    const post = button.closest('.post');
    const postId = post.dataset.id;
    const isUpvote = button.classList.contains('upvote');
    let postVotes = votes.get(postId) || {};
    let currentVote = postVotes[userId] || null;

    if (currentVote === (isUpvote ? 'upvote' : 'downvote')) {
      delete postVotes[userId];
    } else {
      postVotes[userId] = isUpvote ? 'upvote' : 'downvote';
    }

    votes.set(postId, postVotes);

    const up = Object.values(postVotes).filter(v => v === 'upvote').length;
    const down = Object.values(postVotes).filter(v => v === 'downvote').length;
    voteCounts.set(postId, { up, down });

    saveVotes();
    updateVoteCounts(post, postId);
    updateVoteUI(post, postId);
  }

  document.addEventListener('click', (e) => {
    const button = e.target.closest('.btn-vote');
    if (!button) return;
    e.stopPropagation();
    handleVote(button);
  });

  // init counts/UI
  document.querySelectorAll('.post').forEach(post => {
    const postId = post.dataset.id;
    updateVoteCounts(post, postId);
    updateVoteUI(post, postId);
  });
}

/* -----------------------
   Entry: DOM is ready
------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded - initializing...');

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem('userId', userId);
  }

  initializeVotingSystem();
  console.log('Voting system initialized');

  // Lightbox
  const { bindOpenToPosts } = initLightbox();
  bindOpenToPosts();
  console.log('Lightbox initialized');

  hydrateVideoThumbnails();
  console.log('Video thumbnails hydrated');

  updateLatestFromDocument();
  console.log('Latest post updated');

  setupUpload({
    onAfterAdd: (card) => {
      if (card.getAttribute('data-type') === 'video') {
        hydrateVideoThumbnails();
      }
      const type = card.getAttribute('data-type') || 'image';
      const full = card.getAttribute('data-full');
      const poster = card.querySelector('img.thumb')?.src || null;
      if (full) saveLatestPost({ type, full, poster });

      // ensure new posts also get lightbox listeners
      bindOpenToPosts();
    },
  });
  console.log('Upload system initialized');

  setupImageErrorPlaceholder();
  console.log('Image error handling initialized');

  console.log('All systems ready!');
});
