class VideoObjectDetector {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('frameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.uploadInput = document.getElementById('videoUpload');
        this.recordBtn = document.getElementById('recordBtn');
        this.resultsDiv = document.getElementById('results');
        this.progressBar = document.getElementById('progress');
        this.progressFill = this.progressBar.querySelector('.progress-fill');
        
        this.worker = new Worker('detector.worker.js');
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.uploadInput.addEventListener('change', (e) => this.handleVideoUpload(e));
        this.recordBtn.addEventListener('click', () => this.startRecording());
        
        this.worker.onmessage = (e) => {
            const { type, detections, frameIndex } = e.data;
            if (type === 'detection') {
                this.handleDetections(detections, frameIndex);
            }
        };
    }

    async handleVideoUpload(e) {
        const file = e.target.files[0];
        if (file) {
            this.video.src = URL.createObjectURL(file);
            this.video.onloadeddata = () => this.processVideo();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.video.srcObject = stream;
            this.video.play();

            const mediaRecorder = new MediaRecorder(stream);
            const chunks = [];

            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                this.video.srcObject = null;
                this.video.src = URL.createObjectURL(blob);
                stream.getTracks().forEach(track => track.stop());
                this.processVideo();
            };

            mediaRecorder.start();
            setTimeout(() => mediaRecorder.stop(), 5000); // Record for 5 seconds
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('Could not access camera. Please ensure you have granted permission.');
        }
    }

    async processVideo() {
        this.canvas.width = 640;
        this.canvas.height = 640;
        this.progressBar.style.display = 'block';
        this.resultsDiv.innerHTML = '';

        const frameInterval = 1; // Process 1 frame per second
        const duration = this.video.duration;
        const totalFrames = Math.floor(duration / frameInterval);
        
        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
            const currentTime = frameIndex * frameInterval;
            await this.processFrame(currentTime, frameIndex, totalFrames);
        }

        this.progressBar.style.display = 'none';
    }

    async processFrame(time, frameIndex, totalFrames) {
        return new Promise((resolve) => {
            this.video.currentTime = time;
            this.video.onseeked = () => {
                this.drawFrame();
                const imageData = this.ctx.getImageData(0, 0, 640, 640);
                
                this.worker.postMessage({
                    type: 'detect',
                    data: {
                        imageData,
                        frameIndex
                    }
                });

                // Update progress bar
                const progress = ((frameIndex + 1) / totalFrames) * 100;
                this.progressFill.style.width = `${progress}%`;

                resolve();
            };
        });
    }

    drawFrame() {
        // Clear canvas
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, 640, 640);

        // Calculate scaling to maintain aspect ratio
        const scale = Math.min(
            640 / this.video.videoWidth,
            640 / this.video.videoHeight
        );
        const width = this.video.videoWidth * scale;
        const height = this.video.videoHeight * scale;
        const xOffset = (640 - width) / 2;
        const yOffset = (640 - height) / 2;

        // Draw video frame
        this.ctx.drawImage(
            this.video,
            xOffset,
            yOffset,
            width,
            height
        );
    }

    handleDetections(detections, frameIndex) {
        const time = frameIndex.toFixed(1);
        const resultHTML = `
            <div class="detection-group">
                <h3>Time: ${time}s</h3>
                <ul>
                    ${detections.map(d => `
                        <li>Object detected at: 
                            x: ${d.x.toFixed(2)}, 
                            y: ${d.y.toFixed(2)}, 
                            width: ${d.w.toFixed(2)}, 
                            height: ${d.h.toFixed(2)}, 
                            confidence: ${(d.confidence * 100).toFixed(1)}%
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
        this.resultsDiv.insertAdjacentHTML('beforeend', resultHTML);
    }
}

// Initialize the application
const app = new VideoObjectDetector(); 