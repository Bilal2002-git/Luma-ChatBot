const messages = document.querySelector('#messages');
const input = document.querySelector('#messageInput');
const composer = document.querySelector('#composer');
const sendButton = document.querySelector('#sendButton');
const suggestions = document.querySelector('#suggestions');
const welcomeBlock = document.querySelector('#welcomeBlock');
const breadcrumbTitle = document.querySelector('#breadcrumbTitle');
const conversationList = document.querySelector('#conversationList');
const sidebar = document.querySelector('#sidebar');
const loginOverlay = document.querySelector('#loginOverlay');
const loginForm = document.querySelector('#loginForm');
const loginName = document.querySelector('#loginName');
const loginEmail = document.querySelector('#loginEmail');
const greetingName = document.querySelector('#greetingName');
const sidebarUserName = document.querySelector('#sidebarUserName');
const sidebarAvatar = document.querySelector('#sidebarAvatar');
const topbarAvatar = document.querySelector('#topbarAvatar');
const profileButton = document.querySelector('#profileButton');
let conversations = getStoredConversations();
let chatHistory = [];
let isSending = false;

function getStoredConversations() {
  try { return JSON.parse(localStorage.getItem('luma-conversations') || '[]'); } catch { return []; }
}

function getProfile() {
  try { return JSON.parse(localStorage.getItem('luma-profile') || 'null'); } catch { return null; }
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'LU';
}

function renderProfile(profile) {
  const firstName = profile.name.split(/\s+/)[0] || 'there';
  const userInitials = initials(profile.name);
  greetingName.textContent = firstName;
  sidebarUserName.textContent = profile.name;
  sidebarAvatar.textContent = userInitials;
  topbarAvatar.textContent = userInitials;
}

function showLogin() {
  loginOverlay.classList.remove('hidden');
  setTimeout(() => loginName.focus(), 50);
}

function hideLogin() {
  loginOverlay.classList.add('hidden');
  setTimeout(() => input.focus(), 250);
}

function setComposerBusy(isBusy) {
  sendButton.disabled = isBusy;
  input.disabled = isBusy;
  sendButton.textContent = isBusy ? '…' : '↑';
}

function timeNow() {
  return new Intl.DateTimeFormat([], { hour:'numeric', minute:'2-digit' }).format(new Date());
}

function addMessage(text, role, showTime = true) {
  const row = document.createElement('div');
  row.className = `message ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = text;
  if (role === 'assistant') {
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '✦';
    row.append(avatar, bubble);
  } else {
    row.append(bubble);
  }
  let stamp;
  if (showTime) {
    stamp = document.createElement('span');
    stamp.className = 'message-time';
    stamp.textContent = timeNow();
    row.append(stamp);
  }
  messages.append(row);
  scrollToMessage(row);
  return { row, bubble, stamp };
}

function addMessageTime(message) {
  if (message.stamp) return;
  const stamp = document.createElement('span');
  stamp.className = 'message-time';
  stamp.textContent = timeNow();
  message.row.append(stamp);
}

function scrollToMessage(message) {
  message.scrollIntoView({ behavior:'smooth', block:'end' });
}

function renderHistory() {
  conversationList.innerHTML = '';
  conversations.slice(-4).reverse().forEach((conversation) => {
    const item = document.createElement('button');
    item.className = 'conversation-item';
    item.title = conversation.title;
    item.innerHTML = `<span>◌</span>${conversation.title}`;
    conversationList.append(item);
  });
}

function saveConversation(title) {
  conversations = conversations.filter((item) => item.title !== title);
  conversations.push({ title, createdAt: Date.now() });
  localStorage.setItem('luma-conversations', JSON.stringify(conversations));
  renderHistory();
}

function showTypingIndicator() {
  const typing = document.createElement('div');
  typing.className = 'message assistant';
  typing.innerHTML = '<div class="message-avatar">✦</div><div class="message-bubble"><span class="typing"><i></i><i></i><i></i></span></div>';
  messages.append(typing);
  scrollToMessage(typing);
  return typing;
}

function parseSseEvent(block) {
  let eventName = 'message';
  const dataLines = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  return { eventName, data: dataLines.join('\n') };
}

function extractTextChunk(data) {
  const payload = JSON.parse(data);
  if (payload.error?.message) throw new Error(payload.error.message);
  return (payload.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('');
}

function consumeStreamBlock(block, update) {
  if (!block.trim()) return;
  const event = parseSseEvent(block);
  if (event.eventName === 'error') {
    const errorPayload = JSON.parse(event.data || '{}');
    throw new Error(errorPayload.error || 'The response stream stopped unexpectedly.');
  }
  if (!event.data || event.data === '[DONE]') return;
  const chunk = extractTextChunk(event.data);
  if (chunk) update(chunk);
}

async function assistantReply() {
  isSending = true;
  setComposerBusy(true);
  const typing = showTypingIndicator();
  let assistantMessage;
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Unable to reach Luma right now.');
    }
    if (!response.body) throw new Error('The response stream is unavailable.');

    assistantMessage = addMessage('', 'assistant', false);
    typing.remove();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let eventBuffer = '';
    let completeAnswer = '';
    const appendChunk = (chunk) => {
      completeAnswer += chunk;
      assistantMessage.bubble.textContent = completeAnswer;
      scrollToMessage(assistantMessage.row);
    };

    while (true) {
      const { done, value } = await reader.read();
      eventBuffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const blocks = eventBuffer.split(/\r?\n\r?\n/);
      eventBuffer = blocks.pop();
      blocks.forEach((block) => consumeStreamBlock(block, appendChunk));
      if (done) break;
    }
    consumeStreamBlock(eventBuffer, appendChunk);
    if (!completeAnswer) throw new Error('Luma did not return any text. Please try again.');
    chatHistory.push({ role: 'assistant', content: completeAnswer });
    addMessageTime(assistantMessage);
  } catch (error) {
    if (assistantMessage) assistantMessage.row.remove();
    const message = error instanceof Error ? error.message : 'Unable to reach Luma right now.';
    addMessage(`Sorry, I couldn’t respond: ${message}`, 'assistant');
  } finally {
    typing.remove();
    isSending = false;
    setComposerBusy(false);
    input.focus();
  }
}

function sendMessage(text) {
  const cleanText = text.trim();
  if (!cleanText || isSending) return;
  welcomeBlock.style.display = 'none';
  suggestions.style.display = 'none';
  breadcrumbTitle.textContent = cleanText.length > 25 ? `${cleanText.slice(0, 25)}…` : cleanText;
  addMessage(cleanText, 'user');
  chatHistory.push({ role: 'user', content: cleanText });
  saveConversation(cleanText.length > 32 ? `${cleanText.slice(0, 32)}…` : cleanText);
  input.value = '';
  input.style.height = 'auto';
  assistantReply();
}

composer.addEventListener('submit', (event) => {
  event.preventDefault();
  sendMessage(input.value);
});

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
});

document.querySelectorAll('[data-prompt]').forEach((button) => button.addEventListener('click', () => {
  input.value = button.dataset.prompt;
  sendMessage(input.value);
}));

document.querySelector('#newChatButton').addEventListener('click', () => {
  if (isSending) return;
  messages.innerHTML = '';
  chatHistory = [];
  welcomeBlock.style.display = '';
  suggestions.style.display = '';
  breadcrumbTitle.textContent = 'New conversation';
  input.value = '';
  input.focus();
  sidebar.classList.remove('open');
});

document.querySelector('#menuButton').addEventListener('click', () => sidebar.classList.add('open'));
document.querySelector('#sidebarClose').addEventListener('click', () => sidebar.classList.remove('open'));

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = loginName.value.trim();
  if (!name) return;
  const profile = { name, email: loginEmail.value.trim() };
  localStorage.setItem('luma-profile', JSON.stringify(profile));
  renderProfile(profile);
  hideLogin();
});

profileButton.addEventListener('click', () => {
  if (!window.confirm('Sign out of this local Luma profile?')) return;
  localStorage.removeItem('luma-profile');
  chatHistory = [];
  messages.innerHTML = '';
  welcomeBlock.style.display = '';
  suggestions.style.display = '';
  breadcrumbTitle.textContent = 'New conversation';
  showLogin();
});

const storedProfile = getProfile();
if (storedProfile?.name) {
  renderProfile(storedProfile);
  hideLogin();
} else {
  showLogin();
}
renderHistory();
