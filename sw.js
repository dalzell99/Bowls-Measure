var CACHE_NAME = 'my-site-cache-v2';
var urlsToCache = [
	"css/reset.css",
	"node_modules/@fortawesome/fontawesome-free/css/all.min.css",
	"node_modules/@fortawesome/fontawesome-free/webfonts/fa-solid-900.woff2",
	"node_modules/image-capture/lib/imagecapture.min.js"
];

self.addEventListener('install', function (event) {
	// Perform install steps
	event.waitUntil(
		caches.open(CACHE_NAME).then(function (cache) {
			console.log('Opened cache');
			return cache.addAll(urlsToCache);
		})
	);
});

self.addEventListener('fetch', function (event) {
	event.respondWith(
		caches.match(event.request).then(function (response) {
			// Cache hit - return response
			if (response) {
				return response;
			}
			return fetch(event.request);
		})
	);
});
