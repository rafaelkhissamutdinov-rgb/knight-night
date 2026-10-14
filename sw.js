// Свежая игра без Ctrl+F5 (v0.73): GitHub Pages разрешает браузеру держать файлы 10 минут — после обновления
// у игроков оставалась старая версия. Этот сервис-воркер каждый раз спрашивает сервер, не изменился ли файл
// (cache: 'no-cache' — проверка по ETag, неизменённое не скачивается заново). Без сети — что есть в кэше браузера.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).catch(() => fetch(req)));
});
