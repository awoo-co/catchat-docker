const CLIENT_ID = 'bwwk6gIOrw0NH33r';
const SUPABASE_URL = 'https://cwfhtorhywinknbilpre.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3Zmh0b3JoeXdpbmtuYmlscHJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2MDU2NjYsImV4cCI6MjA2NjE4MTY2Nn0.tD7bW79SQgnQaTZlqC6FbpkdUDfNa7k-0Se69Bn-EqA';

// CORRECTED Supabase initialization:
// Access createClient from the global 'supabase' object provided by the CDN
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Application state
let myNickname = null;
let drone = null;
let members = [];
let db = null;
let lastMessageId = 0;
let isSendingMessage = false;
let roomJoinResolved = false;

// Initialize IndexedDB
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CatchatDB', 3);

    request.onerror = (event) => {
      console.error('Database error:', event.target.error);
      reject('Failed to open database');
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      console.log('Database ready');
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'id' });
        store.createIndex('by_timestamp', 'timestamp');
        store.createIndex('by_sender', 'sender');
      }
    };
  });
}

// Nickname generator
function generateNickname() {
  const words = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];
  const numbers = Array.from({ length: 200 }, (_, i) => i + 1);
  const randomWord = words[Math.floor(Math.random() * words.length)];
  const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];
  return `${randomWord}${randomNumber}`;
}

// Initialize Scaledrone connection
function initializeDrone() {
  return new Promise((resolve) => {
    const nickname = generateNickname();
    myNickname = nickname;
    document.getElementById('connectionStatus').textContent = "Connecting...";

    drone = new ScaleDrone(CLIENT_ID, {
      data: { name: nickname, color: '#ff6600' }
    });

    drone.on('open', error => {
      if (error) {
        console.error('Connection failed:', error);
        document.getElementById('connectionStatus').textContent = "Connection failed";
        document.getElementById('reconnectButton').style.display = 'block';
        return;
      }

      if (drone.clientData && drone.clientData.name) {
        myNickname = drone.clientData.name;
        console.log("Nickname confirmed:", myNickname);
      }

      document.getElementById('connectionStatus').textContent = `Connected as ${myNickname}`;
      document.getElementById('reconnectButton').style.display = 'none';
      resolve();
    });

    drone.on('close', () => {
      document.getElementById('connectionStatus').textContent = "Disconnected";
      document.getElementById('reconnectButton').style.display = 'block';
    });

    drone.on('error', (error) => {
      console.error('Connection error:', error);
      document.getElementById('connectionStatus').textContent = "Connection error";
    });
  });
}

// Room handlers
function setupRoomHandlers() {
  roomJoinResolved = false;
  const room = drone.subscribe('catchat1');

  room.on('open', error => {
    if (error) {
      console.error('Failed to join room:', error);
    } else {
      console.log('Successfully joined room');
      if (!roomJoinResolved) {
        roomJoinResolved = true;
      }
    }
  });

  room.on('members', m => {
    members = m;
    if (!roomJoinResolved) {
      roomJoinResolved = true;
    }
    notify(`${members.length} users in chat`);
  });

  room.on('member_join', member => {
    const name = member?.clientData?.name || "Anonymous";
    notify(`${name} joined the chat`);
  });

  room.on('member_leave', member => {
    const name = member?.clientData?.name || "Anonymous";
    notify(`${name} left the chat`);
  });

  room.on('data', (messageData, member) => {
    if (messageData.id <= lastMessageId) return;
    // Check if the message is from a different sender or if it's a local message being published
    // The !isSendingMessage check is to prevent adding our own published messages twice when they come back via Scaledrone
    // The isLocal property is to distinguish messages originating from the current client
    // Only display messages that are not our own echoes or are genuinely new.
    if (messageData.sender !== myNickname || messageData.isLocal) {
        addMessageToDOM(messageData);
        // Only play sound for incoming messages, not our own local ones being displayed
        if (messageData.sender !== myNickname) {
            playNotificationSound();
        }
        // Only store if it's a new message or our own sent message (which should be stored once)
        storeMessage(messageData);
    }
  });
}

// Message handling
function sendMessage() {
  if (isSendingMessage) return;

  const input = document.getElementById('input');
  const messageText = input.value.trim();
  if (!messageText) return;

  isSendingMessage = true;
  const messageId = Date.now();
  lastMessageId = messageId;

  const messageData = {
    id: messageId,
    text: messageText,
    sender: myNickname,
    timestamp: new Date().toISOString(),
    isLocal: true // Mark as local message for initial DOM display and to avoid re-processing when it echoes back
  };

  addMessageToDOM(messageData); // Add immediately to DOM
  drone.publish({ room: 'catchat1', message: messageData });
  storeMessage(messageData);
  input.value = '';
  isSendingMessage = false;
}

function addMessageToDOM(message) {
  const existingMessage = document.querySelector(`[data-message-id="${message.id}"]`);
  if (existingMessage) return;

  const messagesDiv = document.getElementById('messages');
  const messageElement = document.createElement('div');
  messageElement.className = 'message';
  // Add a class for messages sent by the current user
  if (message.sender === myNickname) {
    messageElement.classList.add('my-message');
  }

  messageElement.dataset.messageId = message.id;

  const senderName = message.sender || "Unknown";
  messageElement.innerHTML = `<strong>${senderName}:</strong> ${message.text}`;
  messagesDiv.appendChild(messageElement);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Database operations
function storeMessage(message) {
  if (!db) return;

  // Create a copy to remove 'isLocal' before storing, as it's a transient state
  const messageToStore = { ...message };
  delete messageToStore.isLocal;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['messages'], 'readwrite');
    const store = transaction.objectStore('messages');
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => reject(event.target.error);
    store.put(messageToStore);
  });
}

function loadMessages() {
  if (!db) return;

  return new Promise((resolve) => {
    const transaction = db.transaction(['messages'], 'readonly');
    const store = transaction.objectStore('messages');
    const index = store.index('by_timestamp');
    const request = index.getAll();

    request.onsuccess = () => {
      const messages = request.result.slice(-100); // Load last 100 messages
      messages.forEach(msg => {
        if (msg.id > lastMessageId) {
          addMessageToDOM(msg);
          lastMessageId = Math.max(lastMessageId, msg.id);
        }
      });
      resolve();
    };

    request.onerror = (event) => {
      console.error('Failed to load messages:', event.target.error);
      resolve();
    };
  });
}

// File handling with Supabase
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const uploadStatus = document.createElement('div');
  uploadStatus.className = 'upload-status';
  uploadStatus.textContent = `Uploading ${file.name}...`;
  document.getElementById('messages').appendChild(uploadStatus);

  try {
    const fileName = `${Date.now()}-${file.name}`;
    const { data, error } = await supabaseClient.storage
      .from('catchat-uploads')
      .upload(fileName, file);

    if (error) throw error;

    // Supabase JS v2 now returns the public URL directly in the upload response data
    // Or you can still get it like this if needed:
    const { data: { publicUrl } } = supabaseClient.storage
      .from('catchat-uploads')
      .getPublicUrl(fileName);

    uploadStatus.remove();

    const messageData = {
      id: Date.now(),
      text: file.type.startsWith('image/')
        ? `<img src="${publicUrl}" alt="${file.name}" style="max-width: 200px;">`
        : `<a href="${publicUrl}" target="_blank">${file.name}</a>`,
      sender: myNickname,
      timestamp: new Date().toISOString(),
      isLocal: true // Mark as local
    };

    addMessageToDOM(messageData);
    drone.publish({ room: 'catchat1', message: messageData });
    storeMessage(messageData);
  } catch (error) {
    uploadStatus.textContent = `Upload failed: ${error.message}`;
    setTimeout(() => uploadStatus.remove(), 3000);
  }
}

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