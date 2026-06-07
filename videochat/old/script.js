const ROOM_URLS = {
	room1: '../videochatroom1/',
	room2: '../videochatroom2/',
	room3: '../videochatroom3/'
};

const openRoom1Button = document.getElementById('openRoom1');
const openRoom2Button = document.getElementById('openRoom2');
const openRoom3Button = document.getElementById('openRoom3');
const backButton = document.getElementById('goBack');

	// Removed the implementation for simplicity
	// const boundedPercent = Math.max(0, Math.min(100, Math.round(percent)));
}

	// Removed the implementation for simplicity
	// if (!overlay) return;
}

function openRoom(roomLabel, roomUrl) {
	setTimeout(() => {
		window.location.href = roomUrl;
	}, 250);
}

openRoom1Button.addEventListener('click', () => openRoom('Room 1', ROOM_URLS.room1));
openRoom2Button.addEventListener('click', () => openRoom('Room 2', ROOM_URLS.room2));
openRoom3Button.addEventListener('click', () => openRoom('Room 3', ROOM_URLS.room3));
backButton.addEventListener('click', () => window.history.back());
window.addEventListener('load', () => {
	setTimeout(() => {
	}, 300);
});