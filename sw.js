var CACHE = 'rekam-v1';
var SHELL = ['./', 'index.html', 'manifest.json', 'icon-180.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // 'reload' = lewati cache HTTP GitHub Pages supaya yang tersimpan selalu versi terbaru
      return Promise.all(SHELL.map(function (u) {
        return fetch(new Request(u, { cache: 'reload' })).then(function (r) { if (r.ok) return c.put(u, r); }).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// File aplikasi: ambil dari internet dulu (selalu versi terbaru), jatuh ke cache bila offline atau lambat > 4 detik
function networkFirst(req, cache) {
  return new Promise(function (resolve) {
    var done = false;
    function fromCache() {
      return cache.match(req, { ignoreSearch: true }).then(function (hit) {
        // index.html hanya sebagai cadangan untuk halaman, bukan untuk file script
        return hit || (req.mode === 'navigate' ? cache.match('index.html') : undefined);
      });
    }
    var timer = setTimeout(function () {
      fromCache().then(function (hit) { if (hit && !done) { done = true; resolve(hit); } });
    }, 4000);
    fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) cache.put(req, res.clone());
      if (!done) { done = true; resolve(res); }
    }).catch(function () {
      clearTimeout(timer);
      fromCache().then(function (hit) { if (!done) { done = true; resolve(hit || Response.error()); } });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  var cdn = url.hostname === 'cdn.jsdelivr.net';
  if (!sameOrigin && !cdn) return; // server sinyal PeerJS tidak disentuh

  e.respondWith(caches.open(CACHE).then(function (cache) {
    if (sameOrigin) return networkFirst(req, cache);
    // Pustaka CDN berversi tetap: cache dulu
    return cache.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      });
    });
  }));
});
