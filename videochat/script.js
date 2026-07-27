// Point this to your running Node.js signaling backend
const BACKEND_URL = 'http://jam-server.opah-pierce.ts.net:3031'; 

let socket = null;
let localStream = null;
let peerConnection = null;
let currentRoomId = null;

// Standard public STUN configuration
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
    // Add your TURN server credentials here if configured:
    // { urls: 'turn:YOUR_TURN_SERVER:3478', username: 'catchatuser', credential: 'catchatpassword' }
  ]
};

// UI Elements
const statusText = document.getElementById('status-text');
const roomControls = document.getElementById('roomControls');
const videoContainer = document.getElementById('videoContainer');
const leaveRoomBtn = document.getElementById('leaveRoom');
const backButton = document.getElementById('goBack');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// Connect to room button clicks
const roomMap = {
  openRoom1: 'videochatroom1',
  openRoom2: 'videochatroom2',
  openRoom3: 'videochatroom3'
};

Object.entries(roomMap).forEach(([buttonId, roomId]) => {
  const button = document.getElementById(buttonId);
  if (button) {
    button.addEventListener('click', () => joinRoom(roomId));
  }
});

if (backButton) {
  backButton.addEventListener('click', () => window.history.back());
}

if (leaveRoomBtn) {
  leaveRoomBtn.addEventListener('click', leaveRoom);
}

async function joinRoom(roomId) {
  currentRoomId = roomId;
  statusText.innerText = `Connecting to ${roomId}...`;

  try {
    // 1. Initialize local video/audio stream
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    // 2. Connect to Socket.IO backend
    if (!socket) {
      socket = io(BACKEND_URL);
      setupSocketListeners();
    }

    // 3. Update UI
    roomControls.style.display = 'none';
    videoContainer.style.display = 'flex';
    leaveRoomBtn.style.display = 'inline-block';
    statusText.innerText = `In room: ${roomId}. Waiting for a peer to join...`;

    // 4. Emit join-room event to signaling backend
    socket.emit('join-room', roomId);

  } catch (err) {
    console.error('Error accessing media devices:', err);
    statusText.innerText = 'Could not access camera or microphone.';
  }
}

function setupSocketListeners() {
  // When another user joins the room
  socket.on('user-connected', async (targetId) => {
    statusText.innerText = 'Peer connected. Initiating video call...';
    peerConnection = createPeerConnection(targetId);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', { targetId, offer });
  });

  // Handle incoming WebRTC Offer
  socket.on('offer', async ({ senderId, offer }) => {
    statusText.innerText = 'Receiving call...';
    peerConnection = createPeerConnection(senderId);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', { targetId: senderId, answer });
  });

  // Handle incoming WebRTC Answer
  socket.on('answer', async ({ answer }) => {
    statusText.innerText = 'Connected!';
    if (peerConnection) {
      await peerConnection.setRemoteDescription(answer);
    }
  });

  // Handle ICE Candidates
  socket.on('ice-candidate', async ({ candidate }) => {
    if (peerConnection && candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  });
}

function createPeerConnection(targetId) {
  const pc = new RTCPeerConnection(rtcConfig);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', { targetId, candidate: event.candidate });
    }
  };

  pc.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
    statusText.innerText = 'Connected to peer!';
  };

  return pc;
}

function leaveRoom() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  // Reset UI
  roomControls.style.display = 'block';
  videoContainer.style.display = 'none';
  leaveRoomBtn.style.display = 'none';
  statusText.innerText = 'Select a room or enter a room ID to start video chat.';
}