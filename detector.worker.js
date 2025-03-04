importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js');

let session = null;

async function initModel() {
    if (!session) {
        session = await ort.InferenceSession.create('./yolov8n.onnx');
    }
}

async function detectObjects(imageData) {
    const input = preprocessImage(imageData);
    const tensor = new ort.Tensor('float32', input, [1, 3, 640, 640]);
    const feeds = { [session.inputNames[0]]: tensor };
    const outputMap = await session.run(feeds);
    const output = outputMap[session.outputNames[0]].data;
    return postProcess(output);
}

function preprocessImage(imageData) {
    const input = new Float32Array(3 * 640 * 640);
    for (let i = 0, j = 0; i < imageData.data.length; i += 4, j++) {
        input[j] = imageData.data[i] / 255.0;
        input[j + 640*640] = imageData.data[i+1] / 255.0;
        input[j + 2*640*640] = imageData.data[i+2] / 255.0;
    }
    return input;
}

function postProcess(output) {
    const detections = [];
    const numDetections = output.length / 6;
    
    for (let i = 0; i < numDetections; i++) {
        const base = i * 6;
        const confidence = output[base + 4];
        
        if (confidence > 0.5) {
            detections.push({
                x: output[base],
                y: output[base + 1],
                w: output[base + 2],
                h: output[base + 3],
                confidence,
                class: output[base + 5]
            });
        }
    }
    
    return detections;
}

onmessage = async function(e) {
    const { type, data } = e.data;
    
    switch (type) {
        case 'init':
            await initModel();
            postMessage({ type: 'initialized' });
            break;
            
        case 'detect':
            const detections = await detectObjects(data.imageData);
            postMessage({ 
                type: 'detection',
                detections,
                frameIndex: data.frameIndex 
            });
            break;
    }
}; 