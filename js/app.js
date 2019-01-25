let _elements = {};
// let _sensors = {};
// let _deviceSpeed = {x: 0, y: 0, z: 0};
// let _devicePosition = {x: 0, y: 0, z: 0};
// let _speedResetTracker = {x: 0, y: 0, z: 0};
// let _linearAccelerationSensorReadings = [];

// window.pinkerror = 50;

// const linearAccelerationSensorUpdateRate = 60;
// const linearAccelerationSensorAverage = 10;

const NONE = 0;
const JACK = 1;
const BOWLS = 2;
let clickState = NONE;
let _imageArray;

// Start app
window.onload = async () => {
	initElementObject();
	// await initSensorObject();
	// initTracking();
	registerServiceWorker();
	initVideoFeed();
	addEventListeners();
}

initElementObject = () => {
	_elements = {
		photoButton: document.querySelector(".photo-button"),
		reloadButton: document.querySelector(".reload-button"),
		// calibrateButton: document.querySelector(".calibrate-button"),
		camera: document.querySelector(".camera"),
		imageContainer: document.querySelector(".image-container"),
		imageCloseButton: document.querySelector(".image-close-button"),
		image: document.querySelector(".image"),
		// trackingRectangleContainer: $(".tracking-rectangle-container"),
	};
};

initSensorObject = () => {
	return Promise.all([
		navigator.permissions.query({ name: "accelerometer" }),
		navigator.permissions.query({ name: "magnetometer" }),
		navigator.permissions.query({ name: "gyroscope" })
	]).then(results => {
		if (results.every(result => result.state === "granted")) {
			// X, Y and Z in the world
			_sensors.linearAccelerationSensor = new LinearAccelerationSensor({frequency: linearAccelerationSensorUpdateRate});
			_sensors.linearAccelerationSensor.start();

			// Rotation sensor
			_sensors.absoluteOrientationSensor = new AbsoluteOrientationSensor({ frequency: 0.2, referenceFrame: 'device' });
			_sensors.absoluteOrientationSensor.start();
		} else {
			console.log("No permissions to use AbsoluteOrientationSensor.");
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
			event.data.forEach(rect => {
				const colour = colours[rect.color];
				let size, top, left;
				if (rect.width > rect.height) {
					size = rect.width;
					top = rect.y - (rect.width - rect.height);
					left = rect.x;
				} else {
					size = rect.height;
					top = rect.y;
					left = rect.x - (rect.height - rect.width);
				}

				_elements.trackingRectangleContainer.append(`
					<div class="tracking-rectangle" style="left: ${left}px; top: ${top}px; height: ${size}px; width: ${size}px; border-color: rgb(${colour.r}, ${colour.g}, ${colour.b});"></div>
				`);
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
		clickState = JACK;
		takePhoto();
	});

	_elements.reloadButton.addEventListener("click", e => {
		location.reload();
	});

	_elements.imageCloseButton.addEventListener("click", e => {
		_elements.imageContainer.style.display = "none";
	});

	_elements.image.addEventListener("click", e => {
		const colour = _imageArray[e.offsetY][e.offsetX];

		$(".clickMarker").css({
			top: e.offsetY,
			left: e.offsetX
		});

		if (clickState === JACK) {
			const bounds = getColourBoundaries(colour, e.offsetX, e.offsetY);
			
			$(".leftMarker").css({
				top: e.offsetY,
				left: bounds.xMin
			});

			$(".rightMarker").css({
				top: e.offsetY,
				left: bounds.xMax
			});

			$(".topMarker").css({
				top: bounds.yMin,
				left: e.offsetX
			});

			$(".bottomMarker").css({
				top: bounds.yMax,
				left: e.offsetX
			});

			const xCenter = Math.round((bounds.xMin + bounds.xMax) / 2);
			const yCenter = Math.round((bounds.yMin + bounds.yMax) / 2);

			$(".centerMarker").css({
				top: yCenter,
				left: xCenter
			});

			const newBounds = getColourBoundaries(colour, xCenter, yCenter);

			$(".leftMarker2").css({
				top: yCenter,
				left: Math.min(newBounds.xMin, bounds.xMin)
			});

			$(".rightMarker2").css({
				top: yCenter,
				left: Math.max(newBounds.xMax, bounds.xMax)
			});

			$(".topMarker2").css({
				top: Math.min(newBounds.yMin, bounds.yMin),
				left: xCenter
			});

			$(".bottomMarker2").css({
				top: Math.max(newBounds.yMax, bounds.yMax),
				left: xCenter
			});

			$(".boundingCircle").css({
				top:Math.min(newBounds.yMin, bounds.yMin),
				left: Math.min(newBounds.xMin, bounds.xMin),
				height: Math.max(newBounds.yMax, bounds.yMax) - Math.min(newBounds.yMin, bounds.yMin),
				width: Math.max(newBounds.xMax, bounds.xMax) - Math.min(newBounds.xMin, bounds.xMin)
			});

			// clickState = BOWLS;
		} else if (clickState === BOWLS) {

		}
	});

	// _elements.calibrateButton.addEventListener("click", e => {
	// 	_devicePosition = {x: 0, y: 0, z: 0};
	// 	_deviceSpeed = {x: 0, y: 0, z: 0};
	// });

	// _sensors.linearAccelerationSensor.addEventListener('reading', e => {
	// 	_linearAccelerationSensorReadings.push(_sensors.linearAccelerationSensor)
	// 	_linearAccelerationSensorReadings = _linearAccelerationSensorReadings.slice(-1 * linearAccelerationSensorAverage);

	// 	if (_linearAccelerationSensorReadings.length >= linearAccelerationSensorAverage) {
	// 		const lasX = _linearAccelerationSensorReadings.reduce((sum, reading) => sum + reading.x, 0) / linearAccelerationSensorAverage;
	// 		const lasY = _linearAccelerationSensorReadings.reduce((sum, reading) => sum + reading.y, 0) / linearAccelerationSensorAverage;
	// 		const lasZ = _linearAccelerationSensorReadings.reduce((sum, reading) => sum + reading.z, 0) / linearAccelerationSensorAverage;

	// 		if (Math.abs(_sensors.linearAccelerationSensor.x) < 0.085) {
	// 			_speedResetTracker.x += 1;
	// 		} else {
	// 			_speedResetTracker.x = 0;
	// 		}

	// 		if (_speedResetTracker.x >= linearAccelerationSensorUpdateRate / 4) {
	// 			_deviceSpeed.x = 0;
	// 			_speedResetTracker.x = 0;
	// 			console.log("_deviceSpeed.x reset");
	// 		} else {
	// 			_deviceSpeed.x += (lasX / linearAccelerationSensorUpdateRate);
	// 			_speedResetTracker.x = 0;

	// 			console.log("Linear acceleration along the X-axis " + (lasX > 0 ? " " : "") + lasX.toFixed(3) + ", Speed: " + (_deviceSpeed.x > 0 ? " " : "") + _deviceSpeed.x.toFixed(3) + "m/s");
	// 		}

	// 		if (Math.abs(_sensors.linearAccelerationSensor.y) < 0.085) {
	// 			_speedResetTracker.y += 1;
	// 		} else {
	// 			_speedResetTracker.y = 0;
	// 		}

	// 		if (_speedResetTracker.y >= linearAccelerationSensorUpdateRate / 2) {
	// 			_deviceSpeed.y = 0;
	// 			_speedResetTracker.y = 0;
	// 			// console.log("_deviceSpeed.y reset");
	// 		} else if (Math.abs(_sensors.linearAccelerationSensor.y) > 0.01) {
	// 			_deviceSpeed.y += (_sensors.linearAccelerationSensor.y / linearAccelerationSensorUpdateRate);

	// 			console.log("Linear acceleration along the y-axis " + (_sensors.linearAccelerationSensor.y > 0 ? " " : "") + _sensors.linearAccelerationSensor.y.toFixed(3) + ", Speed: " + (_deviceSpeed.y > 0 ? " " : "") + _deviceSpeed.y.toFixed(3) + "m/s");
	// 		}

	// 		if (Math.abs(_sensors.linearAccelerationSensor.z) < 0.085) {
	// 			_speedResetTracker.z += 1;
	// 		} else {
	// 			_speedResetTracker.z = 0;
	// 		}

	// 		if (_speedResetTracker.z >= linearAccelerationSensorUpdateRate / 2) {
	// 			_deviceSpeed.z = 0;
	// 			_speedResetTracker.z = 0;
	// 			// console.log("_deviceSpeed.z reset");
	// 		} else if (Math.abs(_sensors.linearAccelerationSensor.z) > 0.01) {
	// 			_deviceSpeed.z += (_sensors.linearAccelerationSensor.z / linearAccelerationSensorUpdateRate);

	// 			console.log("Linear acceleration along the z-axis " + (_sensors.linearAccelerationSensor.z > 0 ? " " : "") + _sensors.linearAccelerationSensor.z.toFixed(3) + ", Speed: " + (_deviceSpeed.z > 0 ? " " : "") + _deviceSpeed.z.toFixed(3) + "m/s");
	// 		}

	// 		_devicePosition.x += (_deviceSpeed.x / linearAccelerationSensorUpdateRate);
	// 		_devicePosition.y += (_deviceSpeed.y / linearAccelerationSensorUpdateRate);
	// 		_devicePosition.z += (_deviceSpeed.z / linearAccelerationSensorUpdateRate);
	// 	}
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

			_elements.canvas = document.createElement('canvas');
			_elements.canvas.width = _elements.image.width;
			_elements.canvas.height = _elements.image.height;
			_elements.canvas.getContext('2d').drawImage(_elements.image, 0, 0, _elements.image.width, _elements.image.height);

			var imageWidth = Number(getComputedStyle(_elements.image).width.replace("px", ""));
			var imageHeight = Number(getComputedStyle(_elements.image).height.replace("px", ""));
			var data = _elements.canvas.getContext('2d').getImageData(0, 0, imageWidth, imageHeight).data;
			var pixelCount = imageHeight * imageWidth;
			_imageArray = [];

			for (var i = 0; i < pixelCount; i += 1) {
				if (i % imageWidth === 0) {
					_imageArray.push([]);
				}
				
				_imageArray[_imageArray.length - 1].push({
					r: data[i * 4 + 0],
					g: data[i * 4 + 1],
					b: data[i * 4 + 2]
				});
			}
		}
	});

	_elements.imageContainer.style.display = "block";
}

getColourBoundaries = (colour, x, y) => {
	const imageWidth = Number(getComputedStyle(_elements.image).width.replace("px", ""));
	const imageHeight = Number(getComputedStyle(_elements.image).height.replace("px", ""));

	const bounds = {
		xMin: Infinity,
		xMax: -Infinity,
		yMin: Infinity,
		yMax: -Infinity
	};

	const colourDelta = 40;

	// get left boundary
	let leftFound = 0;
	for (var i = x; i >= 0 && leftFound < 50; i -= 1) {
		const selectedColour = _imageArray[y][i];
		if (
			Math.abs(selectedColour.r - colour.r) <= colourDelta && 
			Math.abs(selectedColour.g - colour.g) <= colourDelta && 
			Math.abs(selectedColour.b - colour.b) <= colourDelta
		) {
			bounds.xMin = i;
			leftFound = 0;
		} else {
			leftFound += 1;
		}
	}
	
	// get right boundary
	let rightFound = 0;
	for (var j = x; j < imageWidth && rightFound < 50; j += 1) {
		const selectedColour = _imageArray[y][j];
		if (
			Math.abs(selectedColour.r - colour.r) <= colourDelta && 
			Math.abs(selectedColour.g - colour.g) <= colourDelta && 
			Math.abs(selectedColour.b - colour.b) <= colourDelta
		) {
			bounds.xMax = j;
			rightFound = 0;
		} else {
			rightFound += 1;
		}
	}

	// get top boundary
	let topFound = 0;
	for (var k = y; k >= 0 && topFound < 50; k -= 1) {
		const selectedColour = _imageArray[k][x];
		if (
			Math.abs(selectedColour.r - colour.r) <= colourDelta && 
			Math.abs(selectedColour.g - colour.g) <= colourDelta && 
			Math.abs(selectedColour.b - colour.b) <= colourDelta
		) {
			bounds.yMin = k;
			topFound = 0;
		} else {
			topFound += 1;
		}
	}

	// get bottom boundary
	let bottomFound = 0;
	for (var l = y; l < imageHeight && bottomFound < 50; l += 1) {
		const selectedColour = _imageArray[l][x];
		if (
			Math.abs(selectedColour.r - colour.r) <= colourDelta && 
			Math.abs(selectedColour.g - colour.g) <= colourDelta && 
			Math.abs(selectedColour.b - colour.b) <= colourDelta
		) {
			bounds.yMax = l;
			bottomFound = 0;
		} else {
			bottomFound += 1;
		}
	}

	return bounds;
}