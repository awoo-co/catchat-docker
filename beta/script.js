// Hardcode your HTTP backend URL directly since HTTPS is disabled on Tailscale
const BACKEND_URL = window.CATCHAT_BACKEND_URL || 'http://jam-server.opah-pierce.ts.net:3001';
const ROOM_NAME = 'catchatbeta';

let myNickname = null;
let socket = null;
let lastMessageId = 0;
let isSendingMessage = false;
let listenersBound = false;

function generateNickname() {
  const words = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];
  const randomWord = words[Math.floor(Math.random() * words.length)];
  const randomNumber = Math.floor(Math.random() * 200) + 1;
  return `${randomWord}${randomNumber}`;
}

function setConnectionStatus(text) {
  const node = document.getElementById('connectionStatus');
  if (node) node.textContent = text;
}

function setReconnectVisible(visible) {
  const button = document.getElementById('reconnectButton');
  if (button) button.style.display = visible ? 'block' : 'none';
}

function disableLegacyBackupButtons() {
  const uploadButton = document.getElementById('uploadButton');
  const downloadButton = document.getElementById('downloadButton');

  if (uploadButton) {
    uploadButton.disabled = true;
    uploadButton.title = 'Backup moved to backend';
  }

  if (downloadButton) {
    downloadButton.disabled = true;
    downloadButton.title = 'Restore moved to backend';
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildAbsoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${BACKEND_URL}${pathOrUrl}`;
}

function renderMessageBody(message) {
  // Render File Attachments
  if (message.fileUrl) {
    const fileUrl = buildAbsoluteUrl(message.fileUrl);
    const fileName = escapeHtml(message.fileName || 'file');
    const fileType = String(message.fileType || '').toLowerCase();

    // Image files
    if (fileType.startsWith('image/')) {
      return `
        <div class="media-container">
          <img src="${fileUrl}" alt="${fileName}" class="chat-media-img" />
          <br>
          <a href="${fileUrl}" download="${fileName}" target="_blank" class="file-download-link">💾 Download ${fileName}</a>
        </div>`;
    }

    // Video files
    if (fileType.startsWith('video/')) {
      return `
        <div class="media-container">
          <video controls class="chat-media-video">
            <source src="${fileUrl}" type="${fileType}">
            Your browser does not support video playback.
          </video>
          <br>
          <a href="${fileUrl}" download="${fileName}" target="_blank" class="file-download-link">💾 Download ${fileName}</a>
        </div>`;
    }

    // Audio files
    if (fileType.startsWith('audio/')) {
      return `
        <div class="media-container">
          <audio controls>
            <source src="${fileUrl}" type="${fileType}">
          </audio>
          <br>
          <a href="${fileUrl}" download="${fileName}" target="_blank" class="file-download-link">💾 Download ${fileName}</a>
        </div>`;
    }

    // Generic files (Zip, PDF, Docs, etc.)
    return `
      <div class="file-attachment">
        <a href="${fileUrl}" download="${fileName}" target="_blank" class="file-download-button">
          📁 Download ${fileName}
        </a>
      </div>`;
  }

  // Regular text message
  return escapeHtml(message.text || '');
}

function addMessageToDOM(message) {
  if (!message || typeof message.id === 'undefined') return;

  const existingMessage = document.querySelector(`[data-message-id="${message.id}"]`);
  if (existingMessage) return;

  const messagesDiv = document.getElementById('messages');
  if (!messagesDiv) return;

  const messageElement = document.createElement('div');
  messageElement.className = 'message';

  if (message.sender === myNickname) {
    messageElement.classList.add('my-message');
  }

  messageElement.dataset.messageId = message.id;
  const senderName = escapeHtml(message.sender || 'Unknown');
  messageElement.innerHTML = `<strong>${senderName}:</strong> ${renderMessageBody(message)}`;

  messagesDiv.appendChild(messageElement);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  if (Number(message.id) > lastMessageId) {
    lastMessageId = Number(message.id);
  }
}

function clearMessagesDOM() {
  const messagesDiv = document.getElementById('messages');
  if (messagesDiv) messagesDiv.innerHTML = '';
  lastMessageId = 0;
}

async function loadMessages() {
  try {
    clearMessagesDOM();
    const response = await fetch(`${BACKEND_URL}/messages?room=${encodeURIComponent(ROOM_NAME)}&limit=100`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const messages = await response.json();
    messages.forEach(addMessageToDOM);
  } catch (error) {
    console.error('Failed to load messages:', error);
  }
}

function setupSocketHandlers() {
  socket.on('connect', () => {
    setConnectionStatus(`Connected as ${myNickname}`);
    setReconnectVisible(false);
    socket.emit('room:join', ROOM_NAME);
  });

  socket.on('disconnect', () => {
    setConnectionStatus('Disconnected');
    setReconnectVisible(true);
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    setConnectionStatus('Connection error');
    setReconnectVisible(true);
  });

  socket.on('chat:new', (message) => {
    if (message && message.room && message.room !== ROOM_NAME) return;
    addMessageToDOM(message);
  });
}

function initializeSocket() {
  return new Promise((resolve, reject) => {
    myNickname = generateNickname();
    setConnectionStatus('Connecting...');

    socket = io(BACKEND_URL, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10
    });

    setupSocketHandlers();

    socket.once('connect', () => resolve());
    socket.once('connect_error', (error) => reject(error));
  });
}

function sendMessage() {
  if (isSendingMessage || !socket || !socket.connected) return;

  const input = document.getElementById('input');
  if (!input) return;

  const messageText = input.value.trim();
  if (!messageText) return;

  isSendingMessage = true;

  const messageData = {
    id: Date.now(),
    text: messageText,
    sender: myNickname,
    timestamp: new Date().toISOString(),
    room: ROOM_NAME
  };

  socket.emit('chat:send', messageData);
  input.value = '';
  isSendingMessage = false;
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const uploadStatus = document.createElement('div');
  uploadStatus.className = 'upload-status';
  uploadStatus.textContent = `Uploading ${file.name}...`;
  document.getElementById('messages').appendChild(uploadStatus);

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BACKEND_URL}/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }

    const result = await response.json();

    socket.emit('chat:send', {
      id: Date.now(),
      sender: myNickname,
      timestamp: new Date().toISOString(),
      text: file.name,
      fileUrl: result.url,
      fileName: result.name || file.name,
      fileType: result.mime || file.type,
      room: ROOM_NAME
    });

    uploadStatus.remove();
  } catch (error) {
    uploadStatus.textContent = `Upload failed: ${error.message}`;
    setTimeout(() => uploadStatus.remove(), 3000);
  } finally {
    event.target.value = '';
  }
}

function setupEventListeners() {
  if (listenersBound) return;

  const sendButton = document.getElementById('sendButton');
  const inputField = document.getElementById('input');
  const fileUploadButton = document.getElementById('fileUploadButton');
  const fileInput = document.getElementById('fileInput');
  const reconnectButton = document.getElementById('reconnectButton');

  if (sendButton) sendButton.addEventListener('click', sendMessage);
  if (inputField) {
    inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  if (fileUploadButton && fileInput) {
    fileUploadButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);
  }

  if (reconnectButton) {
    reconnectButton.addEventListener('click', async () => {
      reconnectButton.disabled = true;
      try {
        if (socket) socket.disconnect();
        await initializeSocket();
      } catch (error) {
        console.error('Reconnect failed:', error);
      } finally {
        reconnectButton.disabled = false;
      }
    });
  }

  listenersBound = true;
}

async function initializeApp() {
  try {
    setConnectionStatus('Initializing...');
    disableLegacyBackupButtons();
    setupEventListeners();

    await initializeSocket();
    await loadMessages();
  } catch (error) {
    console.error('Initialization failed:', error);
    setConnectionStatus('Initialization failed');
    setReconnectVisible(true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});