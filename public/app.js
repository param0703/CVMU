document.addEventListener('DOMContentLoaded', async () => {
    // Load face-api models
    await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models')
    ]);

    const video = document.getElementById('video');
    const overlay = document.getElementById('overlay');
    const capturedCanvas = document.getElementById('capturedImage');
    const captureBtn = document.getElementById('captureBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const skinTypeResult = document.getElementById('skinTypeResult');
    const metricsResult = document.getElementById('metricsResult');
    const recommendations = document.getElementById('recommendations');

    // Start video stream
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
                width: 640,
                height: 480,
                facingMode: 'user'
            }
        });
        video.srcObject = stream;
    } catch (err) {
        console.error('Error accessing camera:', err);
        alert('Please enable camera access to use this application.');
    }

    // Face detection on video stream
    video.addEventListener('play', () => {
        overlay.width = video.width;
        overlay.height = video.height;
        const displaySize = { width: video.width, height: video.height };

        setInterval(async () => {
            const detections = await faceapi.detectAllFaces(
                video,
                new faceapi.TinyFaceDetectorOptions()
            ).withFaceLandmarks();

            const ctx = overlay.getContext('2d');
            ctx.clearRect(0, 0, overlay.width, overlay.height);

            if (detections.length > 0) {
                const resizedDetections = faceapi.resizeResults(detections, displaySize);
                faceapi.draw.drawFaceLandmarks(overlay, resizedDetections);
                captureBtn.disabled = false;
            } else {
                captureBtn.disabled = true;
            }
        }, 100);
    });

    // Capture image
    captureBtn.addEventListener('click', () => {
        capturedCanvas.width = video.width;
        capturedCanvas.height = video.height;
        const ctx = capturedCanvas.getContext('2d');
        ctx.drawImage(video, 0, 0, capturedCanvas.width, capturedCanvas.height);
        analyzeBtn.disabled = false;
    });

    // Analyze skin
    analyzeBtn.addEventListener('click', async () => {
        loadingIndicator.style.display = 'block';
        skinTypeResult.innerHTML = '';
        metricsResult.innerHTML = '';
        recommendations.innerHTML = '';

        try {
            const imageData = capturedCanvas.getContext('2d').getImageData(
                0, 0, capturedCanvas.width, capturedCanvas.height
            );
            
            const analysis = await analyzeSkin(imageData);
            displayResults(analysis);
        } catch (err) {
            console.error('Analysis error:', err);
            alert('Error during analysis. Please try again.');
        }
        
        loadingIndicator.style.display = 'none';
    });

    // Skin analysis function
    async function analyzeSkin(imageData) {
        // Get face detection for the captured image
        const detections = await faceapi.detectAllFaces(
            capturedCanvas,
            new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks();

        if (detections.length === 0) {
            throw new Error('No face detected in the captured image');
        }

        const detection = detections[0];
        const landmarks = detection.landmarks;
        const faceBox = detection.detection.box;

        // Sample points from different facial regions
        const foreheadPoint = landmarks.positions[20];
        const cheekPoint = landmarks.positions[1];
        const chinPoint = landmarks.positions[8];

        // Analyze skin characteristics at each point
        const regions = {
            forehead: getSkinMetrics(imageData, foreheadPoint.x, foreheadPoint.y),
            cheek: getSkinMetrics(imageData, cheekPoint.x, cheekPoint.y),
            chin: getSkinMetrics(imageData, chinPoint.x, chinPoint.y)
        };

        // Calculate overall metrics
        const brightness = (regions.forehead.brightness + regions.cheek.brightness + regions.chin.brightness) / 3;
        const redness = (regions.forehead.redness + regions.cheek.redness + regions.chin.redness) / 3;
        const oiliness = (regions.forehead.oiliness + regions.cheek.oiliness + regions.chin.oiliness) / 3;

        // Determine skin type
        const skinType = determineSkinType(brightness, redness, oiliness);
        
        return {
            skinType,
            metrics: {
                brightness: Math.round(brightness * 100),
                redness: Math.round(redness * 100),
                oiliness: Math.round(oiliness * 100)
            },
            recommendations: getRecommendations(skinType)
        };
    }

    // Helper function to get skin metrics at a specific point
    function getSkinMetrics(imageData, x, y) {
        const index = (Math.round(y) * imageData.width + Math.round(x)) * 4;
        const r = imageData.data[index];
        const g = imageData.data[index + 1];
        const b = imageData.data[index + 2];

        return {
            brightness: (r + g + b) / (3 * 255),
            redness: r / (g + b + 1),
            oiliness: g / (r + b + 1)
        };
    }

    // Determine skin type based on metrics
    function determineSkinType(brightness, redness, oiliness) {
        if (redness > 0.6) return 'Sensitive';
        if (oiliness > 0.5) return 'Oily';
        if (brightness < 0.4) return 'Dry';
        if (Math.abs(oiliness - 0.5) < 0.1) return 'Combination';
        return 'Normal';
    }

    // Get skincare recommendations
    function getRecommendations(skinType) {
        const recommendations = {
            'Sensitive': [
                'Use gentle, fragrance-free products',
                'Avoid harsh exfoliants',
                'Always patch test new products',
                'Use sunscreen daily'
            ],
            'Oily': [
                'Use oil-free products',
                'Try salicylic acid cleansers',
                'Don\'t skip moisturizer',
                'Use clay masks weekly'
            ],
            'Dry': [
                'Use cream-based cleansers',
                'Apply moisturizer to damp skin',
                'Consider using facial oils',
                'Avoid hot water when washing'
            ],
            'Combination': [
                'Use different products for different areas',
                'Focus on balance',
                'Try gel-based moisturizers',
                'Use mild cleansers'
            ],
            'Normal': [
                'Maintain current routine',
                'Use sunscreen daily',
                'Stay hydrated',
                'Regular gentle exfoliation'
            ]
        };

        return recommendations[skinType];
    }

    // Display results
    function displayResults(analysis) {
        skinTypeResult.innerHTML = `
            <h2>Your Skin Type: ${analysis.skinType}</h2>
        `;

        metricsResult.innerHTML = `
            <h3>Skin Metrics:</h3>
            <div class="metrics">
                <p>Brightness: ${analysis.metrics.brightness}%</p>
                <div class="metric-bar">
                    <div class="metric-fill" style="width: ${analysis.metrics.brightness}%"></div>
                </div>
                
                <p>Redness: ${analysis.metrics.redness}%</p>
                <div class="metric-bar">
                    <div class="metric-fill" style="width: ${analysis.metrics.redness}%"></div>
                </div>
                
                <p>Oiliness: ${analysis.metrics.oiliness}%</p>
                <div class="metric-bar">
                    <div class="metric-fill" style="width: ${analysis.metrics.oiliness}%"></div>
                </div>
            </div>
        `;

        recommendations.innerHTML = `
            <h3>Recommendations:</h3>
            <ul>
                ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        `;
    }
});