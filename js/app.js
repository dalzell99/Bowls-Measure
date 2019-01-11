let _elements = {};
let _sensors = {};
let _deviceSpeed = {x: 0, y: 0, z: 0};
let _devicePosition = {x: 0, y: 0, z: 0};
let _speedResetTracker = {x: 0, y: 0, z: 0};

window.pinkerror = 50;

const linearAccelerationSensorUpdateRate = 60;

// Start app
window.onload = async () => {
	initElementObject();
	await initSensorObject();
	initTracking();
	registerServiceWorker();
	initVideoFeed();
	addEventListeners();
}

initElementObject = () => {
	_elements = {
		photoButton: document.querySelector(".photo-button"),
		reloadButton: document.querySelector(".reload-button"),
		calibrateButton: document.querySelector(".calibrate-button"),
		camera: document.querySelector(".camera"),
		imageContainer: document.querySelector(".image-container"),
		imageCloseButton: document.querySelector(".image-close-button"),
		image: document.querySelector(".image"),
		trackingRectangleContainer: $(".tracking-rectangle-container"),
	};
};

initSensorObject = () => {
	return Promise.all([
		navigator.permissions.query({ name: "accelerometer" }),
		navigator.permissions.query({ name: "magnetometer" }),
		navigator.permissions.query({ name: "gyroscope" })
	]).then(results => {
		if (results.every(result => result.state === "granted")) {
			// // X, Y and Z in the world
			// _sensors.linearAccelerationSensor = new LinearAccelerationSensor({frequency: linearAccelerationSensorUpdateRate});
			// _sensors.linearAccelerationSensor.start();

			// // Rotation sensor
			// _sensors.absoluteOrientationSensor = new AbsoluteOrientationSensor({ frequency: 0.2, referenceFrame: 'device' });
			// _sensors.absoluteOrientationSensor.start();
		} else {
			// console.log("No permissions to use AbsoluteOrientationSensor.");
		}
	});
};

initTracking = () => {
	const colours = {
		white: {r: 255, g: 255, b: 255},
		pink: {r: 196, g: 41, b: 85}
	};

	tracking.ColorTracker.registerColor('white', function(r, g, b) {
		const c = colours.white;
		if (Math.abs(r - c.r) < 20 && Math.abs(g - c.g) < 20 && Math.abs(b - c.b) < 20) {
			return true;
		}
		return false;
	});

	tracking.ColorTracker.registerColor('pink', function(r, g, b) {
		const c = colours.pink;
		if (Math.abs(r - c.r) < window.pinkerror && Math.abs(g - c.g) < window.pinkerror && Math.abs(b - c.b) < window.pinkerror) {
			return true;
		}
		return false;
	});

	var colors = new tracking.ColorTracker(['white', 'pink']);

	colors.on('track', function(event) {
		_elements.trackingRectangleContainer.empty();

		if (event.data.length === 0) {
			// No colors were detected in this frame.
		} else {
			event.data.forEach(function(rect) {
				// console.log(rect.x, rect.y, rect.height, rect.width, rect.color);

				_elements.trackingRectangleContainer.append(`
				<div class="tracking-rectangle" style="left: ${rect.x}px; top: ${rect.y}px; height: ${rect.height}px; width: ${rect.width}px; border-color: rgb(${colours[rect.color].r}, ${colours[rect.color].g}, ${colours[rect.color].b});"></div>
				`)
			});
		}
	});

	tracking.track('#myVideo', colors);
};

// Register service worker
registerServiceWorker = () => {
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
}

// Get video feed from rear camera and show to user
initVideoFeed = () => {
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
			},
			height: { 
				max: window.innerHeight
			},
			aspectRatio: {
				ideal: window.innerWidth / window.innerHeight
			}
		}
	}).then(function (stream) {
		var video = _elements.camera;
		// Older browsers may not have srcObject
		if ("srcObject" in video) {
			video.srcObject = stream;
		} else {
			// Avoid using this in new browsers, as it is going away.
			video.src = URL.createObjectURL(stream);
		}
		
		video.onloadedmetadata = function (e) {
			video.play();
		};
	}).catch(function (err) {
		console.log(err.name + ": " + err.message);
	});
}

addEventListeners = () => {
	_elements.photoButton.addEventListener("click", e => {
		takePhoto();
	});

	_elements.reloadButton.addEventListener("click", e => {
		location.reload();
	});

	_elements.imageCloseButton.addEventListener("click", e => {
		_elements.imageContainer.style.display = "none";
	});

	_elements.calibrateButton.addEventListener("click", e => {
		_devicePosition = {x: 0, y: 0, z: 0};
		_deviceSpeed = {x: 0, y: 0, z: 0};
	});

	// _sensors.linearAccelerationSensor.addEventListener('reading', e => {
	// 	if (Math.abs(_sensors.linearAccelerationSensor.x) < 0.085) {
	// 		_speedResetTracker.x += 1;
	// 	} else {
	// 		_speedResetTracker.x = 0;
	// 	}

	// 	if (_speedResetTracker.x >= linearAccelerationSensorUpdateRate / 2) {
	// 		_deviceSpeed.x = 0;
	// 		_speedResetTracker.x = 0;
	// 		// console.log("_deviceSpeed.x reset");
	// 	} else if (Math.abs(_sensors.linearAccelerationSensor.x) > 0.01) {
	// 		_deviceSpeed.x += (_sensors.linearAccelerationSensor.x / linearAccelerationSensorUpdateRate);

	// 		// console.log("Linear acceleration along the X-axis " + (_sensors.linearAccelerationSensor.x > 0 ? " " : "") + _sensors.linearAccelerationSensor.x.toFixed(3) + ", Speed: " + (_deviceSpeed.x > 0 ? " " : "") + _deviceSpeed.x.toFixed(3) + "m/s");
	// 	}

	// 	if (Math.abs(_sensors.linearAccelerationSensor.y) < 0.085) {
	// 		_speedResetTracker.y += 1;
	// 	} else {
	// 		_speedResetTracker.y = 0;
	// 	}

	// 	if (_speedResetTracker.y >= linearAccelerationSensorUpdateRate / 2) {
	// 		_deviceSpeed.y = 0;
	// 		_speedResetTracker.y = 0;
	// 		// console.log("_deviceSpeed.y reset");
	// 	} else if (Math.abs(_sensors.linearAccelerationSensor.y) > 0.01) {
	// 		_deviceSpeed.y += (_sensors.linearAccelerationSensor.y / linearAccelerationSensorUpdateRate);

	// 		// console.log("Linear acceleration along the y-axis " + (_sensors.linearAccelerationSensor.y > 0 ? " " : "") + _sensors.linearAccelerationSensor.y.toFixed(3) + ", Speed: " + (_deviceSpeed.y > 0 ? " " : "") + _deviceSpeed.y.toFixed(3) + "m/s");
	// 	}

	// 	if (Math.abs(_sensors.linearAccelerationSensor.z) < 0.085) {
	// 		_speedResetTracker.z += 1;
	// 	} else {
	// 		_speedResetTracker.z = 0;
	// 	}

	// 	if (_speedResetTracker.z >= linearAccelerationSensorUpdateRate / 2) {
	// 		_deviceSpeed.z = 0;
	// 		_speedResetTracker.z = 0;
	// 		// console.log("_deviceSpeed.z reset");
	// 	} else if (Math.abs(_sensors.linearAccelerationSensor.z) > 0.01) {
	// 		_deviceSpeed.z += (_sensors.linearAccelerationSensor.z / linearAccelerationSensorUpdateRate);

	// 		// console.log("Linear acceleration along the z-axis " + (_sensors.linearAccelerationSensor.z > 0 ? " " : "") + _sensors.linearAccelerationSensor.z.toFixed(3) + ", Speed: " + (_deviceSpeed.z > 0 ? " " : "") + _deviceSpeed.z.toFixed(3) + "m/s");
	// 	}

	// 	_devicePosition.x += (_deviceSpeed.x / linearAccelerationSensorUpdateRate);
	// 	_devicePosition.y += (_deviceSpeed.y / linearAccelerationSensorUpdateRate);
	// 	_devicePosition.z += (_deviceSpeed.z / linearAccelerationSensorUpdateRate);
	// });

	// setInterval(a => {
	// 	const xSpeed = Math.round(100 * _deviceSpeed.x);
	// 	const ySpeed = Math.round(100 * _deviceSpeed.y);
	// 	const zSpeed = Math.round(100 * _deviceSpeed.z);

	// 	document.querySelector(".speeds .x").innerHTML = (xSpeed >= 0 ? " " : "") + xSpeed;
	// 	document.querySelector(".speeds .y").innerHTML = (ySpeed >= 0 ? " " : "") + ySpeed;
	// 	document.querySelector(".speeds .z").innerHTML = (zSpeed >= 0 ? " " : "") + zSpeed;
	// }, 333);

	// setInterval(a => {
	// 	console.log(_devicePosition);
	// }, 500);

	// _sensors.absoluteOrientationSensor.addEventListener('reading', e => {
	// 	// console.log("Rotation acceleration ", _sensors.absoluteOrientationSensor.quaternion);
	// });
}

takePhoto = () => {
	const video = _elements.camera;
	const mediaStreamTrack = video.srcObject.getVideoTracks()[0];
	const imageCapture = new ImageCapture(mediaStreamTrack);
	imageCapture.takePhoto().then(blob => {
		_elements.image.src = URL.createObjectURL(blob);
		_elements.image.onload = () => { 
			URL.revokeObjectURL(this.src);
		}
	});

	_elements.imageContainer.style.display = "block";
}