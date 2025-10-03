import { renderComments, addComment } from './comments.js';

export function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  const lbMedia  = document.getElementById('lbMedia');
  const lbComments = document.getElementById('lbComments');
  const lbForm   = document.getElementById('lbForm');
  const lbName   = document.getElementById('lbName');
  const lbText   = document.getElementById('lbText');
  const lbClose  = lightbox?.querySelector('.lightbox__close');

  let currentPostId = null;

  function openLightbox(article) {
    const id = article.getAttribute('data-id');
    if (!id) return;

    const thumbImg = article.querySelector('img');
    const full =
      article.getAttribute('data-full') ||
      thumbImg?.getAttribute('data-full') ||
      thumbImg?.getAttribute('src');

    if (!full) {
      console.warn('No media src found for post:', id, article);
      return;
    }

    let type = article.getAttribute('data-type');
    if (!type) {
      type = /\.(mp4|webm|ogg)(\?|#|$)/i.test(full) ? 'video' : 'image';
    }

    currentPostId = id;

    lbMedia.innerHTML = '';
    if (type === 'video') {
      const video = document.createElement('video');
      video.src = full;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.onerror = () => {
        lbMedia.innerHTML =
          `<div class="lb-error">Could not load video: <code>${full}</code></div>`;
      };
      lbMedia.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = full;
      img.alt = 'Full post';
      img.loading = 'eager';
      img.decoding = 'async';
      img.onerror = () => {
        lbMedia.innerHTML =
          `<div class="lb-error">Could not load image: <code>${full}</code></div>`;
      };
      lbMedia.appendChild(img);
    }

    renderComments(lbComments, id);

    // show
    lightbox.classList.add('is-open');
    lightbox.removeAttribute('hidden');
    lightbox.setAttribute('aria-hidden', 'false');

    // focus name input by default
    if (lbName) lbName.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('hidden', '');
    lightbox.setAttribute('aria-hidden', 'true');
    lbMedia.innerHTML = '';
    lbComments.innerHTML = '';
    try { lbForm.reset(); } catch {}
    currentPostId = null;
  }

  // ------ DELEGATED BINDING (idempotent) ------
  let _delegatedBound = false;
  function bindOpenToPosts() {
    if (_delegatedBound) return;
    _delegatedBound = true;

    document.addEventListener('click', (e) => {
      // 1) If Comment button clicked -> open and focus textarea
      const commentBtn = e.target.closest('.btn-action');
      if (commentBtn) {
        const card = commentBtn.closest('.post');
        if (!card || card.classList.contains('upload')) return;
        e.preventDefault();
        e.stopPropagation();
        openLightbox(card);
        setTimeout(() => {
          const t = document.getElementById('lbText');
          if (t) t.focus();
        }, 100);
        return;
      }

      // 2) Click somewhere on a post (but not on post-actions/buttons) -> open
      const card = e.target.closest('.post');
      if (!card || card.classList.contains('upload')) return;
      if (e.target.closest('.post-actions') || e.target.closest('button')) return;
      openLightbox(card);
    });
  }

  // Comment form handler
  lbForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentPostId) return;
    const name = lbName.value.trim();
    const text = lbText.value.trim();
    if (!name || !text) return;
    addComment(currentPostId, name, text);
    lbText.value = '';
    renderComments(lbComments, currentPostId);
  });

  // Close handlers
  lbClose?.addEventListener('click', closeLightbox);
  lightbox?.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox?.classList.contains('is-open')) {
      closeLightbox();
    }
  });

  return { bindOpenToPosts };
}
