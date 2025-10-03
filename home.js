// js/home.js
// Show the top upvoted post full-screen

function extractYouTubeId(url) {
  const match = url?.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?/]+)/);
  return match ? match[1] : null;
}

function renderTopPost({ type, full, poster }) {
  const wrap = document.getElementById('latestMedia');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (type === 'youtube') {
    const videoId = extractYouTubeId(full);
    if (videoId) {
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${videoId}`;
      iframe.width = '100%';
      iframe.height = '100%';
      iframe.allowFullscreen = true;
      iframe.loading = 'lazy';
      iframe.title = 'Top upvoted video';
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      wrap.appendChild(iframe);
      return;
    }
  }

  if (type === 'video') {
    const video = document.createElement('video');
    video.controls = true;
    video.autoplay = false;
    video.playsInline = true;
    video.src = full;
    if (poster) video.poster = poster;
    wrap.appendChild(video);
    return;
  }

  const img = document.createElement('img');
  img.src = full;
  img.alt = 'Top upvoted post';
  wrap.appendChild(img);
}

function readTopPost() {
  try {
    const raw = localStorage.getItem('topPost');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const topPost = readTopPost();
  const note  = document.getElementById('latestNote');

  if (topPost && topPost.full) {
    renderTopPost(topPost);
    if (note) {
      let message = 'Showing the community\'s top upvoted image.';
      if (topPost.type === 'video') message = 'Showing the community\'s top upvoted video.';
      if (topPost.type === 'youtube') message = 'Showing the community\'s top upvoted YouTube clip.';
      note.textContent = message;
    }
  } else {
    const wrap = document.getElementById('latestMedia');
    if (wrap) {
      wrap.innerHTML = `
        <div class="hero__empty">
          <p>No top post yet. Visit the collection, cast some votes, and check back!</p>
        </div>`;
    }
    if (note) note.textContent = 'Tip: upvote posts in the collection to feature them here.';
  }
});
