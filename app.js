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
        
        this.modelReady = false;
        this.worker = new Worker('detector.worker.js');
        this.initializeEventListeners();
        this.initializeWorker();
    }

    initializeEventListeners() {
        this.uploadInput.addEventListener('change', (e) => this.handleVideoUpload(e));
        this.recordBtn.addEventListener('click', () => this.startRecording());
    }

    initializeWorker() {
        this.worker.onmessage = (e) => {
            const { type, success, error, detections, frameIndex } = e.data;
            
            switch (type) {
                case 'initialized':
                    this.modelReady = success;
                    if (!success) {
                        console.error('Model initialization failed:', error);
                        alert('Failed to load object detection model');
                    }
                    break;
                    
                case 'detection':
                    this.handleDetections(detections, frameIndex);
                    break;
                    
                case 'error':
                    console.error('Worker error:', e.data.message);
                    break;
            }
        };

        this.worker.onerror = (error) => {
            console.error('Worker error:', error);
            alert('An error occurred in the object detection worker');
        };

        // Initialize the model
        this.worker.postMessage({ type: 'init' });
    }

    async handleVideoUpload(e) {
        if (!this.modelReady) {
            alert('Please wait for the model to load');
            return;
        }

        const file = e.target.files[0];
        if (file) {
            this.video.src = URL.createObjectURL(file);
            this.video.onloadeddata = () => {
                console.log('Video loaded, duration:', this.video.duration);
                this.processVideo();
            };
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
        try {
            console.log('Starting video processing');
            this.canvas.width = 640;
            this.canvas.height = 640;
            this.progressBar.style.display = 'block';
            this.resultsDiv.innerHTML = '';

            if (!this.video.duration) {
                throw new Error('Invalid video duration');
            }

            const frameInterval = 1; // Process 1 frame per second
            const duration = this.video.duration;
            const totalFrames = Math.floor(duration / frameInterval);
            
            console.log(`Processing ${totalFrames} frames...`);
            
            for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
                const currentTime = frameIndex * frameInterval;
                await this.processFrame(currentTime, frameIndex, totalFrames);
            }
            
            console.log('Video processing complete');
        } catch (error) {
            console.error('Error processing video:', error);
            alert('Error processing video: ' + error.message);
        } finally {
            this.progressBar.style.display = 'none';
        }
    }

    async processFrame(time, frameIndex, totalFrames) {
        return new Promise((resolve, reject) => {
            const seekHandler = async () => {
                try {
                    console.log(`Processing frame at time ${time}s`);
                    this.drawFrame();
                    const imageData = this.ctx.getImageData(0, 0, 640, 640);
                    
                    // Create a promise for the detection result
                    const detectionPromise = new Promise((detectionResolve, detectionReject) => {
                        const messageHandler = (e) => {
                            if (e.data.frameIndex === frameIndex) {
                                this.worker.removeEventListener('message', messageHandler);
                                if (e.data.type === 'error') {
                                    detectionReject(new Error(e.data.message));
                                } else {
                                    detectionResolve();
                                }
                            }
                        };
                        this.worker.addEventListener('message', messageHandler);
                    });

                    // Send frame to worker
                    this.worker.postMessage({
                        type: 'detect',
                        data: { imageData, frameIndex }
                    });

                    // Wait for detection
                    await detectionPromise;

                    // Update progress
                    const progress = ((frameIndex + 1) / totalFrames) * 100;
                    this.progressFill.style.width = `${progress}%`;

                    resolve();
                } catch (error) {
                    reject(error);
                }
            };

            this.video.currentTime = time;
            this.video.onseeked = seekHandler;
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