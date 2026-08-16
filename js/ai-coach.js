/**
 * FORMCOACH AI — AI COACH CONTROLLER
 * Real-time conversational AI coach powered by server-side Gemini 3.7 Flash,
 * speech synthesis audio cues, markdown formatting, and persistent athlete chat.
 */

import { initSharedNavigation, showToast } from "./shared-nav.js";
import { getCoachChatHistory, saveCoachMessage, clearCoachChatHistory, getUserProfile } from "./db.js";

let activeUserUid = null;
let currentProfile = null;
let chatHistory = [];

initSharedNavigation(async (profile, authUser) => {
  activeUserUid = profile.uid || authUser.uid;
  currentProfile = profile;
  await loadChatHistory();
});

document.addEventListener("DOMContentLoaded", () => {
  setupChatForm();
  setupPromptChips();
  setupClearChat();
});

async function loadChatHistory() {
  if (!activeUserUid) return;
  chatHistory = await getCoachChatHistory(activeUserUid);
  renderMessages();
}

function renderMessages() {
  const container = document.getElementById("chatMessagesArea");
  if (!container) return;

  container.innerHTML = "";

  chatHistory.forEach((msg) => {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${msg.sender === "user" ? "user" : "coach"}`;

    const formattedHtml = parseMarkdown(msg.text);
    bubble.innerHTML = formattedHtml;

    // Add audio cue button for coach messages
    if (msg.sender !== "user") {
      const audioBtn = document.createElement("button");
      audioBtn.type = "button";
      audioBtn.className = "btn-speech";
      audioBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
        <span>Listen to Cue</span>
      `;
      audioBtn.onclick = () => speakText(msg.text);
      bubble.appendChild(audioBtn);
    }

    container.appendChild(bubble);
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function setupChatForm() {
  const form = document.getElementById("chatInputForm");
  const input = document.getElementById("chatInputText");
  const sendBtn = document.getElementById("btnSendCoachMessage");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    input.value = "";

    // 1. Append user message immediately
    chatHistory = await saveCoachMessage(activeUserUid, "user", text);
    renderMessages();

    // 2. Loading state
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = `<span>Thinking...</span>`;
    }

    try {
      const response = await fetch("/api/gemini/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: chatHistory.slice(-8),
          profile: currentProfile || {},
        }),
      });

      const data = await response.json();
      const replyText = data.reply || data.fallbackReply || "Keep tension in your kinetic chain and maintain progressive overload.";

      // 3. Append coach reply
      chatHistory = await saveCoachMessage(activeUserUid, "coach", replyText);
      renderMessages();
    } catch (err) {
      console.error("Coach chat error:", err);
      const fallback = "Focus on strict eccentric control (2-3 seconds down), keep your core braced, and hit your daily protein goal.";
      chatHistory = await saveCoachMessage(activeUserUid, "coach", fallback);
      renderMessages();
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<span>Send</span> <span>→</span>`;
      }
      input.focus();
    }
  });
}

function setupPromptChips() {
  const chips = document.querySelectorAll(".prompt-chip");
  const input = document.getElementById("chatInputText");
  const form = document.getElementById("chatInputForm");

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const prompt = chip.getAttribute("data-prompt");
      if (input && form && prompt) {
        input.value = prompt;
        form.dispatchEvent(new Event("submit"));
      }
    });
  });
}

function setupClearChat() {
  const clearBtn = document.getElementById("btnClearChat");
  clearBtn?.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to clear this coaching conversation?")) return;
    chatHistory = await clearCoachChatHistory(activeUserUid);
    renderMessages();
    showToast("Chat history reset.");
  });
}

// Text to Speech
function speakText(rawText) {
  if (!("speechSynthesis" in window)) {
    showToast("Speech synthesis is not supported in this browser.");
    return;
  }

  // Strip markdown symbols for clean audio speech
  const clean = rawText
    .replace(/[#*_`~[\]]/g, "")
    .replace(/\n+/g, ". ");

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
  showToast("Playing voice audio cue...");
}

// Simple fast markdown parser
function parseMarkdown(md) {
  if (!md) return "";
  let html = md
    .replace(/^### (.*$)/gim, '<h4 style="font-size: 0.96rem; font-weight: 700; margin: 8px 0 4px;">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 style="font-size: 1.05rem; font-weight: 800; margin: 10px 0 6px;">$1</h3>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong style="font-weight: 700;">$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/`([^`]+)`/gim, '<code style="background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px; font-size: 0.85em;">$1</code>')
    .replace(/^\s*-\s+(.*$)/gim, "<li>$1</li>")
    .replace(/^\s*\*\s+(.*$)/gim, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gims, '<ul style="margin: 6px 0; padding-left: 18px;">$1</ul>')
    .replace(/\n\n/gim, "</p><p>")
    .replace(/\n/gim, "<br/>");

  return `<p>${html}</p>`;
}
