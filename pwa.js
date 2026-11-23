/* Solvo Timer — registers the service worker on the standalone website. */
(function () {
  if (!('serviceWorker' in navigator) || window.claude || !/^https?:$/.test(location.protocol)) return;
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { }); });
})();
