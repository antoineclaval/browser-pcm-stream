'use strict';
//webkitURL is deprecated but nevertheless
URL = window.URL || window.webkitURL;

var gumStream; 						//stream from getUserMedia()
var rec; 							//Recorder.js object
var input; //MediaStreamAudioSourceNode we'll be recording
var fileSource ;	// when we playback from the file						

// shim for AudioContext when it's not avb. 
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext = new AudioContext();

var recordButton = document.getElementById('recordButton');
var stopButton = document.getElementById('stopButton');
var trashButton = document.getElementById('trashButton');
//var micIcon = document.getElementById('mic-icon');
var recordingsList = document.getElementById('recordingsList');
var scope = null ;


function resizeCanvasToDisplaySize(canvas) {
	// look up the size the canvas is being displayed
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
 
	// If it's resolution does not match change it
	if (canvas.width !== width || canvas.height !== height) {
	  canvas.width = width;
	  canvas.height = height;
	  return true;
	}
	return false;
 }

// init Canvas
var canvas = document.getElementById('waveform') ;
resizeCanvasToDisplaySize(canvas);
var ctx = canvas.getContext('2d');
ctx.lineWidth = 2 ;
ctx.shadowBlur = 4 ;
ctx.shadowColor = 'white';

function discardRecording(){
	console.log('Discard recording');
	stopButton.className = 'far fa-stop-circle fa-3x';
	document.getElementById('audioComponent')
	while( recordingsList.firstChild ){
	  recordingsList.removeChild( recordingsList.firstChild );
	}

	// Will always clear the right space
	
	scope.animate(ctx);
	ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
	console.log('Discard recording end');

}

// custom animation loop
function drawLoop () {
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	//var centerX = canvas.width / 2 ; 
	var centerY = 100 ;//canvas.height / 2 ;

	ctx.beginPath();
	// ctx.strokeStyle = 'lightgrey'
	// scope.draw(ctx, 0, -40, canvas.width, centerY)

	ctx.strokeStyle = 'white'
	scope.draw(ctx, 0, -20, canvas.width, centerY)

	// ctx.strokeStyle = 'darkgrey'
	// scope.draw(ctx, 0, 0, canvas.width, centerY);
	ctx.closePath();
	ctx.stroke();

	window.requestAnimationFrame(drawLoop)
}

function startRecording() {
	console.log('recordButton clicked');

	audioContext.resume().then(() => {
		console.log('Playback resumed successfully');
	});

	/*
		Simple constraints object, for more advanced audio features see
		https://addpipe.com/blog/audio-constraints-getusermedia/
	*/
    
    var constraints = { audio: true, video:false }
    stopButton.className = 'far fa-stop-circle fa-3x';
    //micIcon.className = micIcon.className += ' button-glow';

 	/*
    	Disable the record button until we get a success or fail from getUserMedia() 
	*/

	recordButton.disabled = true;
	stopButton.disabled = false;
	/*
    	We're using the standard promise based getUserMedia() 
    	https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
	*/

	navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
		console.log('getUserMedia() success, stream created, initializing Recorder.js ...');
		/*
			create an audio context after getUserMedia is called
			sampleRate might change after getUserMedia is called, like it does on macOS when recording through AirPods
			the sampleRate defaults to the one set in your OS for your playback device

		*/
		//update the format 
		console.log('Format: 1 channel pcm @ '+audioContext.sampleRate/1000+'kHz');
		/*  assign to gumStream for later use  */
		gumStream = stream;
		/* use the stream */
		input = audioContext.createMediaStreamSource(stream);

		/* 
			Create the Recorder object and configure to record mono sound (1 channel)
			Recording 2 channels  will double the file size
		*/
		rec = new Recorder(input,{numChannels:1})

		//start the recording process
		rec.record();
		console.log('recordedStarted');

		// attach oscilloscope
		scope = new Oscilloscope(input);
		drawLoop();
	
		console.log('Recording started');

	}).catch(function(err) {
		  //enable the record button if getUserMedia() fails
		console.error(err);
    	recordButton.disabled = false;
    	stopButton.disabled = true;
	});
}

function createDownloadLink(blob) {
	
	var url = URL.createObjectURL(blob);
	var au = document.createElement('audio');
	var li = document.createElement('li');
	var link = document.createElement('a');

	//add controls to the <audio> element
	au.controls = false;
	au.id = 'audioComponent';
	au.src = url;

	//save to disk link
	link.href = url;
	
	//add the new audio element to li
	li.appendChild(au);

	//add the li element to the ol
	while( recordingsList.firstChild ){
	  recordingsList.removeChild( recordingsList.firstChild );
	}
	recordingsList.appendChild(li);
}

function stopRecording() {
	if ( ! stopButton.disabled ){
		console.log('stopButton clicked');
		//disable the stop button, enable the record, allowing for new recordings
		stopButton.disabled = true;
		recordButton.disabled = false;
		//stopButton.src = 'assets/images/round-keyboard_arrow_right-24px.svg';
		stopButton.className = 'fas fa-play-circle fa-3x';
		//micIcon.className = 'fas fa-microphone-alt fa-2x';
		//tell the recorder to stop the recording
		rec.stop();
	
		//stop microphone access
		gumStream.getAudioTracks()[0].stop();

		//create the wav blob and pass it on to createDownloadLink
		rec.exportWAV(createDownloadLink);
	}
	else if (document.getElementById('audioComponent')) {
		console.log('playButton clicked');
		let audioElement = document.getElementById('audioComponent');
		
		// var audioCtx = new AudioContext();
		if ( ! fileSource ){
			fileSource = audioContext.createMediaElementSource(audioElement);
		}
		scope = new Oscilloscope(fileSource);
		fileSource.connect(audioContext.destination)
		drawLoop()

		audioElement.play();
	}
}

function computeFileName(){
	let filename = new Date().toISOString();

	let timeValue = document.getElementById('appt-time').value ;
	if( timeValue ){
		filename = filename + '--' +  timeValue 
	}

	// read location here. 
	if (!document.getElementById('autocomplete').value) {
		return 'noLocation'
	}
	let locationAsString =  document.getElementById('autocomplete').value.replace(/,/g, '-').replace(/ /g, '');
	locationAsString = locationAsString.concat('#',lat , '#',lng) ; 


	filename = filename.concat('@',locationAsString);
	return filename;
}

function submitRecording(){
	if(computeFileName() === 'noLocation'){
		alert('It looks like we didn\'t get your city, please enter it before submitting.');
		return;
	} 

	let audioElem = recordingsList.firstChild.firstChild;

	var xhr = new XMLHttpRequest();
	xhr.open('GET', audioElem.src, true);
	xhr.responseType = 'blob';
	xhr.onload = function(e) {
	  if (this.status == 200) {
		var myBlob = this.response;
		
		var xhr2=new XMLHttpRequest();
		xhr2.onload=function(e) {
			if(this.readyState === 4) {
				console.log('Server returned: ',e.target.responseText);
			}
			};
		
			var fd=new FormData();
			let fileName = computeFileName();
			fd.append('filename', fileName);
			fd.append('audio_data',myBlob, fileName);
			xhr2.open('POST','upload',true);
			xhr2.send(fd);
	  }
	};
	xhr.send();





	currentSlideNumber++;
	nextItem();
	document.getElementById("thanksPage").scrollIntoView();
}

//add events to those buttons
recordButton.addEventListener('click', startRecording);
stopButton.addEventListener('click', stopRecording);
trashButton.addEventListener('click', discardRecording);
submitButton.addEventListener('click', submitRecording);