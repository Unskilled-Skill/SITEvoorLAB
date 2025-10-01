import { escapeHTML, timeAgo } from './utils.js';

// Simple in-memory store (swap with API/localStorage later)
export const commentsStore = {
  m1: [
    { name: 'Alex', text: 'lol this one got me 🤣', at: Date.now() - 3600_000 },
    { name: 'Sam',  text: 'Peak comedy.',         at: Date.now() - 7200_000 },
  ],
  m2: [], m3: [], m4: [], m5: [], m6: [],
  v1: [{ name: 'Pat', text: 'Sound on 🔊', at: Date.now() - 1800_000 }],
};

export function getComments(id) {
  return commentsStore[id] || [];
}

export function addComment(id, name, text) {
  commentsStore[id] ||= [];
  commentsStore[id].unshift({ name, text, at: Date.now() });
}

export function renderComments(listEl, id) {
  const list = getComments(id);
  listEl.innerHTML = list.length
    ? list.map(c => `
        <li>
          <div class="meta">${escapeHTML(c.name)} • ${timeAgo(c.at)}</div>
          <div>${escapeHTML(c.text)}</div>
        </li>
      `).join('')
    : `<li><div class="meta">No comments yet</div></li>`;
}
