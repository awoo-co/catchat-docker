const roomMap = {
  openRoom1: '../videochatroom1/',
  openRoom2: '../videochatroom2/',
  openRoom3: '../videochatroom3/'
};

function navigateTo(url) {
  window.location.href = url;
}

Object.entries(roomMap).forEach(([buttonId, url]) => {
  const button = document.getElementById(buttonId);
  if (button) {
    button.addEventListener('click', () => navigateTo(url));
  }
});

const backButton = document.getElementById('goBack');
if (backButton) {
  backButton.addEventListener('click', () => window.history.back());
}
