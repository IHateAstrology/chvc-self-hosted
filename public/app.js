(() => {
  const chatArea = document.getElementById("chatArea");
  const messagesEl = document.getElementById("messages");
  const welcome = document.getElementById("welcome");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");
  const clearBtn = document.getElementById("clearBtn");
  const qrOverlay = document.getElementById("qrOverlay");
  const quickRefBtn = document.getElementById("quickRefBtn");
  const closeQR = document.getElementById("closeQR");

  let sessionId = localStorage.getItem("chvc_session") || crypto.randomUUID();
  localStorage.setItem("chvc_session", sessionId);
  let isLoading = false;

  // ── Quick Reference Panel ──
  quickRefBtn.addEventListener("click", () => {
    qrOverlay.hidden = !qrOverlay.hidden;
  });

  closeQR.addEventListener("click", () => {
    qrOverlay.hidden = true;
  });

  // Close when clicking the backdrop
  qrOverlay.addEventListener("click", (e) => {
    if (e.target === qrOverlay) {
      qrOverlay.hidden = true;
    }
  });

  // ── Auto-resize textarea ──
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
    sendBtn.disabled = !input.value.trim() || isLoading;
  });

  // Enter to send (shift+enter for newline)
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.value.trim() && !isLoading) {
        form.dispatchEvent(new Event("submit"));
      }
    }
  });

  // ── Suggestion buttons ──
  document.querySelectorAll(".suggestion").forEach((btn) => {
    btn.addEventListener("click", () => {
      input.value = btn.dataset.q;
      sendBtn.disabled = false;
      form.dispatchEvent(new Event("submit"));
    });
  });

  // ── Clear conversation ──
  clearBtn.addEventListener("click", () => {
    sessionId = crypto.randomUUID();
    localStorage.setItem("chvc_session", sessionId);
    messagesEl.innerHTML = "";
    welcome.classList.remove("hidden");
    input.value = "";
    input.style.height = "auto";
    sendBtn.disabled = true;
  });

  // ── Markdown rendering ──
  function renderMarkdown(text) {
    // Escape HTML
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const lines = html.split("\n");
    const blocks = [];
    let currentList = null;

    function flushList() {
      if (currentList) {
        const tag = currentList.type;
        const items = currentList.items.map((i) => `<li>${i}</li>`).join("");
        blocks.push(`<${tag}>${items}</${tag}>`);
        currentList = null;
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Headers
      const headerMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headerMatch) {
        flushList();
        const level = Math.min(headerMatch[1].length + 1, 6);
        blocks.push(`<h${level}>${headerMatch[2]}</h${level}>`);
        continue;
      }

      // Numbered list
      const olMatch = line.match(/^\d+\.\s+(.+)$/);
      if (olMatch) {
        if (currentList && currentList.type !== "ol") flushList();
        if (!currentList) currentList = { type: "ol", items: [] };
        currentList.items.push(olMatch[1]);
        continue;
      }

      // Bullet list
      const ulMatch = line.match(/^[-*]\s+(.+)$/);
      if (ulMatch) {
        if (currentList && currentList.type !== "ul") flushList();
        if (!currentList) currentList = { type: "ul", items: [] };
        currentList.items.push(ulMatch[1]);
        continue;
      }

      // Empty line
      if (!line.trim()) {
        flushList();
        blocks.push("");
        continue;
      }

      // Regular text
      flushList();
      blocks.push(line);
    }
    flushList();

    // Group consecutive text lines into paragraphs
    const result = [];
    let textBuf = [];

    function flushText() {
      if (textBuf.length) {
        result.push(`<p>${textBuf.join("<br>")}</p>`);
        textBuf = [];
      }
    }

    for (const block of blocks) {
      if (!block) {
        flushText();
      } else if (block.startsWith("<")) {
        flushText();
        result.push(block);
      } else {
        textBuf.push(block);
      }
    }
    flushText();

    html = result.join("");

    // Inline formatting
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    return html;
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  }

  // ── Copy to clipboard ──
  function createCopyButton(rawText) {
    const btn = document.createElement("button");
    btn.className = "btn-copy";
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy`;

    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(rawText);
        btn.classList.add("copied");
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Copied`;
        setTimeout(() => {
          btn.classList.remove("copied");
          btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy`;
        }, 2000);
      } catch {
        // Fallback
      }
    });

    return btn;
  }

  // ── Add message to chat ──
  function addMessage(role, content) {
    const div = document.createElement("div");
    div.className = `message ${role}`;

    const avatarSvg =
      role === "assistant"
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="10"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

    const bodyContent =
      role === "assistant" ? renderMarkdown(content) : escapeHtml(content);

    const msgContent = document.createElement("div");
    msgContent.className = "msg-content";

    const body = document.createElement("div");
    body.className = "msg-body";
    body.innerHTML = bodyContent;
    msgContent.appendChild(body);

    // Add copy button for assistant messages
    if (role === "assistant") {
      const actions = document.createElement("div");
      actions.className = "msg-actions";
      actions.appendChild(createCopyButton(content));
      msgContent.appendChild(actions);
    }

    div.innerHTML = `<div class="msg-avatar">${avatarSvg}</div>`;
    div.appendChild(msgContent);
    messagesEl.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  // ── Typing indicator ──
  function showTyping() {
    const div = document.createElement("div");
    div.className = "message assistant";
    div.id = "typing";
    div.innerHTML = `
      <div class="msg-avatar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="10"/></svg>
      </div>
      <div class="msg-content">
        <div class="msg-body typing">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;
    messagesEl.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function removeTyping() {
    document.getElementById("typing")?.remove();
  }

  // ── Submit ──
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message || isLoading) return;

    welcome.classList.add("hidden");
    qrOverlay.hidden = true;
    addMessage("user", message);

    input.value = "";
    input.style.height = "auto";
    sendBtn.disabled = true;
    isLoading = true;

    showTyping();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId }),
      });

      const data = await res.json();
      removeTyping();

      if (res.ok) {
        addMessage("assistant", data.response);
      } else {
        addMessage(
          "assistant",
          "Something went wrong. Please try again in a moment."
        );
      }
    } catch {
      removeTyping();
      addMessage(
        "assistant",
        "Unable to reach the server. Please check your connection."
      );
    }

    isLoading = false;
    sendBtn.disabled = !input.value.trim();
    input.focus();
  });

  input.focus();
})();
