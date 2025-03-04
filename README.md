# TopBinz Goal Analysis

A web application that performs real-time object detection on videos using YOLO and ONNX Runtime. The app processes videos locally in the browser, making it privacy-friendly and suitable for mobile devices.

## Features

- Upload or record videos directly in the browser
- Real-time object detection using YOLOv8
- Local processing (no server uploads required)
- Mobile-friendly interface
- Progress tracking during video analysis
- Detailed detection results with coordinates and confidence scores

## Setup

1. Download the required files:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `detector.worker.js`
   - `yolov8n.onnx`

2. Start a local web server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Or using Node.js
   npx http-server
   ```

3. Access the application at `http://localhost:8000`

## Usage

1. Wait for the model to load (indicated by the status message)
2. Either:
   - Click "Upload" to select a video file
   - Click "Record" to capture a 5-second video using your camera
3. The app will process the video frame by frame
4. View detection results below the video player

## Requirements

- Modern web browser with WebAssembly support
- Camera access (for recording feature)
- Local web server for development

## Technical Details

- Frontend: HTML5, CSS3, JavaScript
- Object Detection: YOLOv8 (ONNX format)
- Processing: Web Workers + ONNX Runtime
- Video Processing: HTML5 Canvas API

## Limitations

- Processing speed depends on device capabilities
- Large videos may take longer to process
- Camera recording limited to 5 seconds by default
