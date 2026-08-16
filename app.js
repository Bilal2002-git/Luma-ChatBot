const messages = document.querySelector('#messages');
const input = document.querySelector('#messageInput');
const composer = document.querySelector('#composer');
const suggestions = document.querySelector('#suggestions');
const welcomeBlock = document.querySelector('#welcomeBlock');
const breadcrumbTitle = document.querySelector('#breadcrumbTitle');
const conversationList = document.querySelector('#conversationList');
const sidebar = document.querySelector('#sidebar');
let conversations = JSON.parse(localStorage.getItem('luma-conversations') || '[]');
let chatHistory = [];

function timeNow() { return new Intl.DateTimeFormat([], { hour:'numeric', minute:'2-digit' }).format(new Date()); }
function addMessage(text, role, showTime = true) {
  const row = document.createElement('div'); row.className = `message ${role}`;
  const bubble = document.createElement('div'); bubble.className = 'message-bubble'; bubble.textContent = text;
  if (role === 'assistant') { const avatar = document.createElement('div'); avatar.className = 'message-avatar'; avatar.textContent = '✦'; row.append(avatar, bubble); } else row.append(bubble);
  if (showTime) { const stamp = document.createElement('span'); stamp.className = 'message-time'; stamp.textContent = timeNow(); row.append(stamp); }
  messages.append(row); row.scrollIntoView({ behavior:'smooth', block:'end' });
}
function renderHistory() {
  conversationList.innerHTML = '';
  conversations.slice(-4).reverse().forEach((conversation) => { const item = document.createElement('button'); item.className = 'conversation-item'; item.title = conversation.title; item.innerHTML = `<span>◌</span>${conversation.title}`; conversationList.append(item); });
}
function saveConversation(title) {
  conversations = conversations.filter((item) => item.title !== title); conversations.push({ title, createdAt: Date.now() }); localStorage.setItem('luma-conversations', JSON.stringify(conversations)); renderHistory();
}
function showTypingIndicator() {
  const typing = document.createElement('div'); typing.className = 'message assistant'; typing.innerHTML = '<div class="message-avatar">✦</div><div class="message-bubble"><span class="typing"><i></i><i></i><i></i></span></div>'; messages.append(typing);
  return typing;
}
async function assistantReply() {
  const typing = showTypingIndicator();
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Unable to reach Luma right now.');
    chatHistory.push({ role: 'assistant', content: payload.answer });
    addMessage(payload.answer, 'assistant');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reach Luma right now.';
    addMessage(`Sorry, I couldn’t respond: ${message}`, 'assistant');
  } finally {
    typing.remove();
  }
}
function sendMessage(text) {
  const cleanText = text.trim(); if (!cleanText) return;
  welcomeBlock.style.display = 'none'; suggestions.style.display = 'none'; breadcrumbTitle.textContent = cleanText.length > 25 ? `${cleanText.slice(0, 25)}…` : cleanText;
  addMessage(cleanText, 'user'); chatHistory.push({ role: 'user', content: cleanText }); saveConversation(cleanText.length > 32 ? `${cleanText.slice(0, 32)}…` : cleanText); input.value = ''; input.style.height = 'auto'; assistantReply();
}
composer.addEventListener('submit', (event) => { event.preventDefault(); sendMessage(input.value); });
input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 120)}px`; });
document.querySelectorAll('[data-prompt]').forEach((button) => button.addEventListener('click', () => { input.value = button.dataset.prompt; input.focus(); sendMessage(input.value); }));
document.querySelector('#newChatButton').addEventListener('click', () => { messages.innerHTML = ''; chatHistory = []; welcomeBlock.style.display = ''; suggestions.style.display = ''; breadcrumbTitle.textContent = 'New conversation'; input.value = ''; input.focus(); sidebar.classList.remove('open'); });
document.querySelector('#menuButton').addEventListener('click', () => sidebar.classList.add('open'));
document.querySelector('#sidebarClose').addEventListener('click', () => sidebar.classList.remove('open'));
renderHistory();
