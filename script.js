function navigateTo(url) {
  window.location.href = url;
}

document.getElementById('server1').addEventListener('click', function() {
  navigateTo('catchat1/index.html');
});

document.getElementById('server2').addEventListener('click', function() {
  navigateTo('catchat2/index.html');
});

document.getElementById('server3').addEventListener('click', function() {
  navigateTo('catchat3/index.html');
});

document.getElementById('videochat').addEventListener('click', function() {
  navigateTo('videochat/index.html');
});

async function resetBrowserData() {
  localStorage.clear();
  sessionStorage.clear();

  if (window.indexedDB && indexedDB.databases) {
    const databases = await indexedDB.databases();
    await Promise.all(
      databases.map((db) => {
        if (!db || !db.name) {
          return Promise.resolve();
        }
        return new Promise((resolve) => {
          const request = indexedDB.deleteDatabase(db.name);
          request.onsuccess = resolve;
          request.onerror = resolve;
          request.onblocked = resolve;
        });
      })
    );
  }

  if (window.caches && caches.keys) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }

  if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
}

document.getElementById('resetdata').addEventListener('click', async function() {
  const confirmed = window.confirm('Reset all stored data for this site?');
  if (!confirmed) {
    return;
  }

  try {
    await resetBrowserData();
    window.alert('Site data reset. The page will reload.');
    window.location.reload();
  } catch (error) {
    console.error('Failed to reset site data.', error);
    window.alert('Unable to reset all data. Try closing and reopening the browser.');
  }
});
