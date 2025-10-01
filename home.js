// js/home.js
// Show the latest uploaded/seen meme full-screen

function renderLatest({ type, full, poster }) {
  const wrap = document.getElementById('latestMedia');
  wrap.innerHTML = '';

  if (type === 'video') {
    const video = document.createElement('video');
    video.controls = true;
    video.autoplay = false;
    video.playsInline = true;
    video.src = full;
    if (poster) video.poster = poster;
    wrap.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = full;
    img.alt = 'Latest meme';
    wrap.appendChild(img);
  }
}

function readLatest() {
  try {
    const raw = localStorage.getItem('latestPost');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // footer year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  const latest = readLatest();
  const note  = document.getElementById('latestNote');

  if (latest && latest.full) {
    renderLatest(latest);
    if (note) {
      note.textContent = latest.type === 'video'
        ? 'Showing the latest uploaded video.'
        : 'Showing the latest uploaded image.';
    }
  } else {
    // Fallback UI (first visit / nothing saved)
    const wrap = document.getElementById('latestMedia');
    wrap.innerHTML = `
      <div class="hero__empty">
        <p>No latest post yet. Head to the collection and add something!</p>
      </div>`;
    if (note) note.textContent = 'Tip: upload a post in your collection first.';
  }
});
