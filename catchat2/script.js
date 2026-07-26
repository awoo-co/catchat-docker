// Hardcode your HTTP backend URL directly since HTTPS is disabled on Tailscale
const BACKEND_URL = window.CATCHAT_BACKEND_URL || 'http://jam-server.opah-pierce.ts.net:3001';
const ROOM_NAME = 'catchat2';

// ... (keep rest of your helper functions unchanged) ...

function initializeSocket() {
  return new Promise((resolve, reject) => {
    myNickname = generateNickname();
    setConnectionStatus('Connecting...');

    socket = io(BACKEND_URL, {
      // Start with HTTP polling first, then upgrade to WebSocket
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10
    });

    setupSocketHandlers();

    // Use .once to prevent promise state issues on reconnects
    socket.once('connect', () => resolve());
    socket.once('connect_error', (error) => reject(error));
  });
};

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
  if (message.fileUrl) {
    const fileUrl = buildAbsoluteUrl(message.fileUrl);
    const fileName = escapeHtml(message.fileName || 'uploaded file');
    const fileType = String(message.fileType || '').toLowerCase();

    if (fileType.startsWith('image/')) {
      return `<img src="${fileUrl}" alt="${fileName}" style="max-width: 200px; border-radius: 6px;">`;
    }

    return `<a href="${fileUrl}" target="_blank" rel="noopener noreferrer">${fileName}</a>`;
  }

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

async function loadMessages() {
  try {
    const response = await fetch(`${BACKEND_URL}/messages?limit=100`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const messages = await response.json();
    messages.forEach(addMessageToDOM);
  } catch (error) {
    console.error('Failed to load messages:', error);
  }
}

function playNotificationSound() {
  try {
    const audio = new Audio('/src/ding.mp3');
    audio.volume = 0.3;
    audio.play().catch((e) => console.log('Audio play prevented or error:', e));
  } catch (e) {
    console.log('Failed to play sound:', e);
  }
}

function notify(message) {
  try {
    const isBackground = typeof document !== 'undefined'
      ? document.visibilityState !== 'visible'
      : true;

    if (isBackground && Notification.permission === 'granted') {
      new Notification('New message', { body: message });
    }
  } catch (e) {
    console.log('Notification error:', e);
  }
}

async function requestNotificationPermission() {
  try {
    if (Notification.permission !== 'granted') {
      await Notification.requestPermission();
    }
  } catch (e) {
    console.log('Notification permission error:', e);
  }
}

function setupSocketHandlers() {
  socket.on('connect', () => {
    setConnectionStatus(`Connected as ${myNickname}`);
    setReconnectVisible(false);
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

    if (message && message.sender && message.sender !== myNickname) {
      playNotificationSound();
      notify(`${message.sender}: ${message.text || message.fileName || 'sent an attachment'}`);
    }
  });
}

function initializeSocket() {
  return new Promise((resolve, reject) => {
    myNickname = generateNickname();
    setConnectionStatus('Connecting...');

    socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10
    });

    socket.on('connect', () => resolve());
    socket.on('connect_error', (error) => reject(error));

    setupSocketHandlers();
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
      text: `${file.name}`,
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
    await requestNotificationPermission();
  } catch (error) {
    console.error('Initialization failed:', error);
    setConnectionStatus('Initialization failed');
    setReconnectVisible(true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});


// Backup functions with Supabase
async function uploadDatabaseToSupabase() {
  if (!db) {
    alert("Database not ready");
    return;
  }

  const status = document.createElement('div');
  status.className = 'backup-status';
  status.textContent = "Preparing backup...";
  document.getElementById('messages').appendChild(status);

  try {
    const transaction = db.transaction(['messages'], 'readonly');
    const store = transaction.objectStore('messages');
    const request = store.getAll();

    request.onsuccess = async () => {
      status.textContent = "Uploading backup...";
      const messages = request.result;
      const blob = new Blob([JSON.stringify(messages)], { type: 'application/json' });
      const fileName = `backup-${Date.now()}.json`;

      const { error } = await supabaseClient.storage
        .from('catchat-uploads')
        .upload(fileName, blob);

      if (error) throw error;

      status.textContent = "Backup successful!";
      setTimeout(() => status.remove(), 3000);
    };

    request.onerror = () => {
      status.textContent = "Failed to prepare backup";
      setTimeout(() => status.remove(), 3000);
    };
  } catch (error) {
    status.textContent = `Backup failed: ${error.message}`;
    setTimeout(() => status.remove(), 3000);
  }
}

async function loadDatabaseFromSupabase() {
  const url = prompt("Enter Supabase file URL:");
  if (!url) return;

  const status = document.createElement('div');
  status.className = 'restore-status';
  status.textContent = "Restoring backup...";
  document.getElementById('messages').appendChild(status);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch backup');
    const messages = await response.json();

    const transaction = db.transaction(['messages'], 'readwrite');
    const store = transaction.objectStore('messages');

    // Clear existing messages before adding new ones
    await new Promise((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        const putPromises = messages.map(msg => {
          return new Promise((res, rej) => {
            const putRequest = store.put(msg);
            putRequest.onsuccess = res;
            putRequest.onerror = rej;
          });
        });

        Promise.all(putPromises)
          .then(() => {
            status.textContent = "Restore successful!";
            // Clear current DOM messages and reload from DB to ensure consistency
            document.getElementById('messages').innerHTML = '';
            lastMessageId = 0; // Reset lastMessageId
            loadMessages();
            setTimeout(() => status.remove(), 3000);
            resolve();
          })
          .catch(err => {
            console.error("Error during message put:", err);
            status.textContent = "Partial restore completed or failed";
            document.getElementById('messages').innerHTML = ''; // Clear anyway
            lastMessageId = 0;
            loadMessages(); // Load whatever was restored
            setTimeout(() => status.remove(), 3000);
            reject(err); // Propagate error
          });
      };
      clearRequest.onerror = (event) => reject(event.target.error);
    });
  } catch (error) {
    status.textContent = `Restore failed: ${error.message}`;
    setTimeout(() => status.remove(), 3000);
  }
}

// Utilities
function playNotificationSound() {
  try {
    const audio = new Audio('/src/ding.mp3'); // Make sure this path is correct relative to your HTML
    audio.volume = 0.3;
    audio.play().catch(e => console.log('Audio play prevented or error:', e));
  } catch (e) {
    console.log('Failed to play sound:', e);
  }
}

function notify(message) {
  try {
    const isBackground = typeof document !== 'undefined'
      ? document.visibilityState !== 'visible'
      : true;
    if (isBackground && Notification.permission === 'granted') {
      new Notification('New message', { body: message });
    }
  } catch (e) {
    console.log('Notification error:', e);
  }
}

async function requestNotificationPermission() {
  try {
    if (Notification.permission !== 'granted') {
      await Notification.requestPermission();
    }
  } catch (e) {
    console.log('Notification permission error:', e);
  }
}

// Initialize application
async function initializeApp() {
  try {
    document.getElementById('connectionStatus').textContent = "Initializing...";
    await initializeDatabase();

    await initializeDrone();
    setupRoomHandlers();
    await loadMessages();
    await requestNotificationPermission();

    setupEventListeners();

  } catch (error) {
    console.error('Initialization failed:', error);
    document.getElementById('connectionStatus').textContent = "Initialization failed";
    document.getElementById('reconnectButton').style.display = 'block';
  }
}

// Event listeners
function setupEventListeners() {
  const sendButton = document.getElementById('sendButton');
  const inputField = document.getElementById('input');
  const fileUploadButton = document.getElementById('fileUploadButton');
  const fileInput = document.getElementById('fileInput');
  const uploadButton = document.getElementById('uploadButton');
  const downloadButton = document.getElementById('downloadButton');
  const reconnectButton = document.getElementById('reconnectButton');

  sendButton.addEventListener('click', () => sendMessage());
  inputField.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
  fileUploadButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleFileUpload(e));
  uploadButton.addEventListener('click', () => uploadDatabaseToSupabase());
  downloadButton.addEventListener('click', () => loadDatabaseFromSupabase());
  reconnectButton.addEventListener('click', () => initializeApp());
}

// Start the app
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

window.addEventListener('load', () => {
});