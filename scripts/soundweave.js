let isStreaming = false;
let peerConnection = null;

// GM-only function to start or stop streaming audio to all players
async function toggleAudioStreaming() {
  if (!isStreaming) {
    // Set up the WebRTC peer-to-peer connection
    peerConnection = new RTCPeerConnection();
  
    // Get the audio output from the GM's machine and send it over the peer-to-peer connection
    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioSource = audioContext.createMediaStreamSource(audioStream);
    audioSource.connect(peerConnection.createTrack('audio', audioStream.getAudioTracks()[0]));
  
    // Send the audio data over the peer-to-peer connection
    peerConnection.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        const socket = game.socketlib.getModule('soundweave');
        socket.emit('iceCandidate', event.candidate);
      }
    });
  
    // Listen for incoming audio data on the peer-to-peer connection and play it in real-time
    peerConnection.addEventListener('track', (event) => {
      const audio = new Audio();
      audio.srcObject = new MediaStream([event.track]);
      audio.play();
    });
  
    // Offer the peer-to-peer connection to all connected players
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    const socket = game.socketlib.getModule('soundweave');
    socket.emit('offer', offer);

    isStreaming = true;
  } else {
    stopAudioStreaming();
  }
}

// GM-only function to stop streaming audio to all players
function stopAudioStreaming() {
  if (isStreaming && peerConnection) {
    peerConnection.close();
    peerConnection = null;
    isStreaming = false;
  }
}

Hooks.once('socketlib.ready', () => {
  // Set up the socket connection
  const socket = socketlib.registerModule('soundweave');
  socket.on('connect', () => console.log('Connected to soundweave socket'));

  // Listen for incoming WebRTC messages
  peerConnection = new RTCPeerConnection();
  socket.on('offer', async (offer) => {
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer);
  });
  socket.on('answer', async (answer) => {
    await peerConnection.setRemoteDescription(answer);
  });
  socket.on('iceCandidate', (candidate) => {
    peerConnection.addIceCandidate(candidate);
  });

  // Add a button to the Audio Controls for GMs to toggle audio streaming
  const audioControls = document.querySelector('.audio-control-buttons');
  const toggleButton = document.createElement('button');
  toggleButton.innerText = 'Toggle Audio Streaming';
  toggleButton.addEventListener('click', () => {
    toggleAudioStreaming();
    toggleButton.innerText = isStreaming ? 'Stop Audio Streaming' : 'Start Audio Streaming';
  });
  audioControls.appendChild(toggleButton);
});