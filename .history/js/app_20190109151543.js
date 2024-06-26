// NOTE: Register service worker
if ('serviceWorker' in navigator) {
	window.addEventListener('load', function() {
		navigator.serviceWorker.register('/sw.js').then(function(registration) {
			// Registration was successful
			console.log('ServiceWorker registration successful with scope: ', registration.scope);
		}, function(err) {
			// registration failed :(
			console.log('ServiceWorker registration failed: ', err);
		});
	});
}

// NOTE: Get video feed from rear camera and show to user
// Older browsers might not implement mediaDevices at all, so we set an empty object first
if (navigator.mediaDevices === undefined) {
	navigator.mediaDevices = {};
}

// Some browsers partially implement mediaDevices. We can't just assign an object
// with getUserMedia as it would overwrite existing properties.
// Here, we will just add the getUserMedia property if it's missing.
if (navigator.mediaDevices.getUserMedia === undefined) {
	navigator.mediaDevices.getUserMedia = function (constraints) {

		// First get ahold of the legacy getUserMedia, if present
		var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

		// Some browsers just don't implement it - return a rejected promise with an error
		// to keep a consistent interface
		if (!getUserMedia) {
			return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
		}

		// Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
		return new Promise(function (resolve, reject) {
			getUserMedia.call(navigator, constraints, resolve, reject);
		});
	}
}

navigator.mediaDevices.getUserMedia({
	video: {
		facingMode: {
			exact: "environment"
		}
	}
}).then(function (stream) {
	var video = document.querySelector('video');
	// Older browsers may not have srcObject
	if ("srcObject" in video) {
		video.srcObject = stream;
	} else {
		// Avoid using this in new browsers, as it is going away.
		video.src = window.URL.createObjectURL(stream);
	}
	
	video.onloadedmetadata = function (e) {
		video.play();
	};
}).catch(function (err) {
	console.log(err.name + ": " + err.message);
});