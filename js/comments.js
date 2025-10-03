// js/comments.js
import { ref, push, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { escapeHTML, timeAgo } from "./utils.js";

export function addComment(postId, name, text) {
  if (!window.currentUser) {
    alert("You must be logged in to comment!");
    return;
  }

  const commentsRef = ref(window.db, `comments/${postId}`);
  push(commentsRef, {
    userId: window.currentUser.uid,
    username: name,
    text,
    at: Date.now()
  });
}

export function renderComments(listEl, postId) {
  const commentsRef = ref(window.db, `comments/${postId}`);
  onValue(commentsRef, (snapshot) => {
    const data = snapshot.val() || {};
    const comments = Object.values(data).sort((a, b) => a.at - b.at);

    listEl.innerHTML = comments.length
      ? comments
          .map(
            (c) => `
        <li>
          <div class="meta">${escapeHTML(c.username)} • ${timeAgo(c.at)}</div>
          <div>${escapeHTML(c.text)}</div>
        </li>
      `
          )
          .join("")
      : `<li><div class="meta">No comments yet</div></li>`;
  });
}
