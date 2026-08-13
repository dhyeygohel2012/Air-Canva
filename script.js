// ==================================================
// AIR CANVAS — V2
// Pen + Eraser + Flower Brush + Undo/Redo
// ==================================================

const video = document.getElementById("video");
const drawCanvas = document.getElementById("drawCanvas");
const cursorCanvas = document.getElementById("cursorCanvas");

const drawCtx = drawCanvas.getContext("2d");
const cursorCtx = cursorCanvas.getContext("2d");

const stage = document.querySelector(".stage");

const message = document.getElementById("message");
const handStatus = document.getElementById("handStatus");
const toolStatus = document.getElementById("toolStatus");

const brushSize = document.getElementById("brushSize");
const brushValue = document.getElementById("brushValue");

const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");

const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");

const penTool = document.getElementById("penTool");
const flowerTool = document.getElementById("flowerTool");


// ==================================================
// STATE
// ==================================================

let currentColor = "#ff3b30";
let selectedTool = "pen";

let lastPoint = null;
let smoothPoint = null;
let lastFlowerPoint = null;

let currentStroke = null;


// ==================================================
// UNDO / REDO
// ==================================================

const strokes = [];
const redoStack = [];

function updateUndoRedoButtons() {

    undoBtn.disabled = strokes.length === 0;
    redoBtn.disabled = redoStack.length === 0;

    undoBtn.style.opacity =
        strokes.length === 0 ? "0.4" : "1";

    redoBtn.style.opacity =
        redoStack.length === 0 ? "0.4" : "1";
}


function undo() {

    if (strokes.length === 0) {
        return;
    }

    const stroke =
        strokes.pop();

    redoStack.push(stroke);

    endStroke();

    replayStrokes();

    updateUndoRedoButtons();
}


function redo() {

    if (redoStack.length === 0) {
        return;
    }

    const stroke =
        redoStack.pop();

    strokes.push(stroke);

    replayStrokes();

    updateUndoRedoButtons();
}


// ==================================================
// GESTURE STATE
// ==================================================

let rawGesture = "idle";
let committedGesture = "idle";

let gestureCount = 0;

const DEBOUNCE_FRAMES = 4;


// ==================================================
// PROJECTION
// ==================================================

let projection = null;

let dpr =
    window.devicePixelRatio || 1;


// ==================================================
// ANGLE CALCULATION
// ==================================================

function angleAtJoint(a, b, c) {

    const BA = {
        x: a.x - b.x,
        y: a.y - b.y,
        z: (a.z || 0) - (b.z || 0)
    };

    const BC = {
        x: c.x - b.x,
        y: c.y - b.y,
        z: (c.z || 0) - (b.z || 0)
    };

    const dot =
        BA.x * BC.x +
        BA.y * BC.y +
        BA.z * BC.z;

    const magBA =
        Math.sqrt(
            BA.x ** 2 +
            BA.y ** 2 +
            BA.z ** 2
        );

    const magBC =
        Math.sqrt(
            BC.x ** 2 +
            BC.y ** 2 +
            BC.z ** 2
        );

    if (!magBA || !magBC) {
        return 0;
    }

    const cosine =
        Math.max(
            -1,
            Math.min(
                1,
                dot / (magBA * magBC)
            )
        );

    return Math.acos(cosine) *
        180 / Math.PI;
}


// ==================================================
// GESTURE DETECTION
// ==================================================

function isExtended(angle) {
    return angle >= 150;
}


function detectGesture(landmarks) {

    const indexAngle =
        angleAtJoint(
            landmarks[5],
            landmarks[6],
            landmarks[8]
        );

    const middleAngle =
        angleAtJoint(
            landmarks[9],
            landmarks[10],
            landmarks[12]
        );

    const ringAngle =
        angleAtJoint(
            landmarks[13],
            landmarks[14],
            landmarks[16]
        );

    const pinkyAngle =
        angleAtJoint(
            landmarks[17],
            landmarks[18],
            landmarks[20]
        );


    const indexExtended =
        isExtended(indexAngle);

    const middleExtended =
        isExtended(middleAngle);

    const ringExtended =
        isExtended(ringAngle);

    const pinkyExtended =
        isExtended(pinkyAngle);


    // ☝️ ONE FINGER = DRAW

    if (
        indexExtended &&
        !middleExtended &&
        !ringExtended &&
        !pinkyExtended
    ) {
        return "pen";
    }


    // ✌️ TWO FINGERS = ERASER

    if (
        indexExtended &&
        middleExtended &&
        !ringExtended &&
        !pinkyExtended
    ) {
        return "eraser";
    }


    // 🖐️ OPEN PALM = PAUSE

    if (
        indexExtended &&
        middleExtended &&
        ringExtended &&
        pinkyExtended
    ) {
        return "idle";
    }


    // ✊ CLOSED HAND = PAUSE

    return "idle";
}


// ==================================================
// GESTURE DEBOUNCE
// ==================================================

function updateGesture(raw) {

    if (raw === rawGesture) {

        gestureCount++;

    } else {

        rawGesture = raw;
        gestureCount = 1;
    }


    if (
        gestureCount >= DEBOUNCE_FRAMES &&
        committedGesture !== rawGesture
    ) {

        committedGesture =
            rawGesture;

        endStroke();
    }


    return committedGesture;
}


// ==================================================
// CAMERA / CANVAS PROJECTION
// ==================================================

function updateProjection() {

    const width =
        stage.clientWidth;

    const height =
        stage.clientHeight;

    if (!width || !height) {
        return;
    }


    const videoWidth =
        video.videoWidth || 1280;

    const videoHeight =
        video.videoHeight || 720;


    const scale =
        Math.max(
            width / videoWidth,
            height / videoHeight
        );


    const drawW =
        videoWidth * scale;

    const drawH =
        videoHeight * scale;


    const offsetX =
        (width - drawW) / 2;

    const offsetY =
        (height - drawH) / 2;


    projection = {
        width,
        height,
        drawW,
        drawH,
        offsetX,
        offsetY
    };
}


// ==================================================
// RESIZE CANVASES
// ==================================================

function resizeCanvases() {

    updateProjection();

    if (!projection) {
        return;
    }


    const oldStrokes =
        strokes.slice();


    dpr =
        window.devicePixelRatio || 1;


    drawCanvas.width =
        projection.width * dpr;

    drawCanvas.height =
        projection.height * dpr;


    cursorCanvas.width =
        projection.width * dpr;

    cursorCanvas.height =
        projection.height * dpr;


    drawCanvas.style.width =
        projection.width + "px";

    drawCanvas.style.height =
        projection.height + "px";


    cursorCanvas.style.width =
        projection.width + "px";

    cursorCanvas.style.height =
        projection.height + "px";


    drawCtx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );

    cursorCtx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );


    if (oldStrokes.length) {
        replayStrokes();
    }
}


const resizeObserver =
    new ResizeObserver(() => {
        resizeCanvases();
    });


resizeObserver.observe(stage);


// ==================================================
// NORMALIZED POINT → SCREEN
// ==================================================

function projectPoint(point) {

    if (!projection) {
        updateProjection();
    }

    if (!projection) {
        return {
            x: 0,
            y: 0
        };
    }


    const x =
        projection.offsetX +
        point.x * projection.drawW;

    const y =
        projection.offsetY +
        point.y * projection.drawH;


    return {
        x: projection.width - x,
        y
    };
}


function getNormalizedPoint(landmark) {

    return {
        x: landmark.x,
        y: landmark.y
    };
}


// ==================================================
// SMOOTHING
// ==================================================

function smooth(point) {

    const alpha = 0.35;


    if (!smoothPoint) {

        smoothPoint = {
            ...point
        };

        return smoothPoint;
    }


    smoothPoint.x +=
        (point.x - smoothPoint.x)
        * alpha;

    smoothPoint.y +=
        (point.y - smoothPoint.y)
        * alpha;


    return smoothPoint;
}


// ==================================================
// PALM CENTER
// ==================================================

function getPalmCenter(landmarks) {

    const ids = [
        0,
        5,
        9,
        13,
        17
    ];


    let x = 0;
    let y = 0;


    ids.forEach(id => {

        x += landmarks[id].x;
        y += landmarks[id].y;

    });


    return {
        x: x / ids.length,
        y: y / ids.length
    };
}


// ==================================================
// STROKES
// ==================================================

function beginStroke(type, point) {

    currentStroke = {

        type,

        color:
            currentColor,

        width:
            Number(brushSize.value) || 8,

        points: [
            {
                x: point.x,
                y: point.y
            }
        ]
    };


    strokes.push(currentStroke);

    // New drawing invalidates redo history

    redoStack.length = 0;

    updateUndoRedoButtons();
}


function endStroke() {

    currentStroke = null;

    lastPoint = null;

    smoothPoint = null;

    lastFlowerPoint = null;
}


// ==================================================
// DRAW LINE
// ==================================================

function drawSegment(
    from,
    to,
    color,
    width
) {

    const a =
        projectPoint(from);

    const b =
        projectPoint(to);


    drawCtx.globalCompositeOperation =
        "source-over";

    drawCtx.strokeStyle =
        color;

    drawCtx.lineWidth =
        width;

    drawCtx.lineCap =
        "round";

    drawCtx.lineJoin =
        "round";


    drawCtx.beginPath();

    drawCtx.moveTo(
        a.x,
        a.y
    );

    drawCtx.lineTo(
        b.x,
        b.y
    );

    drawCtx.stroke();
}


// ==================================================
// ERASER
// ==================================================

function eraseSegment(
    from,
    to,
    width
) {

    const a =
        projectPoint(from);

    const b =
        projectPoint(to);


    drawCtx.globalCompositeOperation =
        "destination-out";

    drawCtx.lineWidth =
        width * 4;

    drawCtx.lineCap =
        "round";

    drawCtx.lineJoin =
        "round";


    drawCtx.beginPath();

    drawCtx.moveTo(
        a.x,
        a.y
    );

    drawCtx.lineTo(
        b.x,
        b.y
    );

    drawCtx.stroke();


    drawCtx.globalCompositeOperation =
        "source-over";
}


// ==================================================
// FLOWER BRUSH
// ==================================================

function drawFlower(
    normalizedPoint,
    color,
    size
) {

    const p =
        projectPoint(normalizedPoint);


    const radius =
        Math.max(
            5,
            size * 1.4
        );


    const rotation =
        Math.random() *
        Math.PI * 2;


    drawCtx.save();

    drawCtx.translate(
        p.x,
        p.y
    );

    drawCtx.rotate(rotation);


    drawCtx.globalCompositeOperation =
        "source-over";

    drawCtx.fillStyle =
        color;


    for (let i = 0; i < 5; i++) {

        const angle =
            i *
            (Math.PI * 2 / 5);


        const x =
            Math.cos(angle) *
            radius;

        const y =
            Math.sin(angle) *
            radius;


        drawCtx.beginPath();

        drawCtx.arc(
            x,
            y,
            radius * 0.55,
            0,
            Math.PI * 2
        );

        drawCtx.fill();
    }


    // Flower center

    drawCtx.fillStyle =
        "#ffd84d";


    drawCtx.beginPath();

    drawCtx.arc(
        0,
        0,
        radius * 0.45,
        0,
        Math.PI * 2
    );

    drawCtx.fill();


    drawCtx.restore();
}


// ==================================================
// CURSOR
// ==================================================

function drawCursor(
    normalizedPoint,
    gesture
) {

    cursorCtx.clearRect(
        0,
        0,
        projection.width,
        projection.height
    );


    if (gesture === "idle") {
        return;
    }


    const p =
        projectPoint(normalizedPoint);


    cursorCtx.save();


    if (gesture === "eraser") {

        const size =
            (Number(brushSize.value) || 8)
            * 2;


        cursorCtx.beginPath();

        cursorCtx.arc(
            p.x,
            p.y,
            size,
            0,
            Math.PI * 2
        );


        cursorCtx.strokeStyle =
            "#ff4d6d";

        cursorCtx.lineWidth = 3;

        cursorCtx.setLineDash([
            8,
            6
        ]);

        cursorCtx.stroke();

    } else {

        cursorCtx.beginPath();

        cursorCtx.arc(
            p.x,
            p.y,
            10,
            0,
            Math.PI * 2
        );


        cursorCtx.strokeStyle =
            currentColor;

        cursorCtx.lineWidth = 3;

        cursorCtx.shadowBlur = 18;

        cursorCtx.shadowColor =
            currentColor;

        cursorCtx.stroke();
    }


    cursorCtx.restore();
}


// ==================================================
// DRAWING HANDLER
// ==================================================

function handleDrawing(
    point,
    gesture
) {

    // ================= PEN =================

    if (gesture === "pen") {

        const smoothed =
            smooth(point);


        if (!currentStroke) {

            if (selectedTool === "flower") {

                beginStroke(
                    "flower",
                    smoothed
                );


                drawFlower(
                    smoothed,
                    currentColor,
                    Number(brushSize.value)
                );


                lastFlowerPoint = {
                    ...smoothed
                };

            } else {

                beginStroke(
                    "pen",
                    smoothed
                );


                lastPoint = {
                    ...smoothed
                };
            }

            return;
        }


        // FLOWER

        if (
            selectedTool === "flower"
        ) {

            const dx =
                smoothed.x -
                (lastFlowerPoint?.x ??
                    smoothed.x);

            const dy =
                smoothed.y -
                (lastFlowerPoint?.y ??
                    smoothed.y);


            const distance =
                Math.sqrt(
                    dx * dx +
                    dy * dy
                );


            if (distance > 0.035) {

                drawFlower(
                    smoothed,
                    currentColor,
                    Number(brushSize.value)
                );


                currentStroke.points.push({
                    x: smoothed.x,
                    y: smoothed.y
                });


                lastFlowerPoint = {
                    ...smoothed
                };
            }

        }

        // NORMAL PEN

        else {

            drawSegment(
                lastPoint,
                smoothed,
                currentColor,
                Number(brushSize.value)
            );


            currentStroke.points.push({
                x: smoothed.x,
                y: smoothed.y
            });


            lastPoint = {
                ...smoothed
            };
        }
    }


    // ================= ERASER =================

    else if (gesture === "eraser") {

        const smoothed =
            smooth(point);


        if (!currentStroke) {

            beginStroke(
                "eraser",
                smoothed
            );


            lastPoint = {
                ...smoothed
            };

            return;
        }


        eraseSegment(
            lastPoint,
            smoothed,
            Number(brushSize.value)
        );


        currentStroke.points.push({
            x: smoothed.x,
            y: smoothed.y
        });


        lastPoint = {
            ...smoothed
        };
    }
}


// ==================================================
// REPLAY
// ==================================================

function replayStrokes() {

    if (!projection) {
        return;
    }


    drawCtx.clearRect(
        0,
        0,
        projection.width,
        projection.height
    );


    for (const stroke of strokes) {

        if (!stroke.points.length) {
            continue;
        }


        // ERASER

        if (stroke.type === "eraser") {

            for (
                let i = 1;
                i < stroke.points.length;
                i++
            ) {

                eraseSegment(
                    stroke.points[i - 1],
                    stroke.points[i],
                    stroke.width
                );
            }
        }


        // FLOWERS

        else if (
            stroke.type === "flower"
        ) {

            stroke.points.forEach(point => {

                drawFlower(
                    point,
                    stroke.color,
                    stroke.width
                );

            });
        }


        // PEN

        else {

            for (
                let i = 1;
                i < stroke.points.length;
                i++
            ) {

                drawSegment(
                    stroke.points[i - 1],
                    stroke.points[i],
                    stroke.color,
                    stroke.width
                );
            }
        }
    }


    drawCtx.globalCompositeOperation =
        "source-over";
}


// ==================================================
// MEDIAPIPE
// ==================================================

const hands =
    new Hands({

        locateFile: (file) => {

            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;

        }

    });


hands.setOptions({

    maxNumHands: 1,

    modelComplexity: 1,

    minDetectionConfidence: 0.6,

    minTrackingConfidence: 0.6

});


hands.onResults(
    handleResults
);


// ==================================================
// RESULTS
// ==================================================

function handleResults(results) {

    if (!projection) {
        resizeCanvases();
    }


    if (!projection) {
        return;
    }


    cursorCtx.clearRect(
        0,
        0,
        projection.width,
        projection.height
    );


    // NO HAND

    if (
        !results.multiHandLandmarks ||
        results.multiHandLandmarks.length === 0
    ) {

        if (handStatus) {

            handStatus.innerHTML =
                '<span class="dot red"></span> No Hand';
        }


        if (message) {

            message.textContent =
                "Show your hand 👋";
        }


        endStroke();

        return;
    }


    // HAND FOUND

    if (handStatus) {

        handStatus.innerHTML =
            '<span class="dot green"></span> Hand Detected';
    }


    const landmarks =
        results.multiHandLandmarks[0];


    const detected =
        detectGesture(landmarks);


    const gesture =
        updateGesture(detected);


    // ================= PEN =================

    if (gesture === "pen") {

        const point =
            getNormalizedPoint(
                landmarks[8]
            );


        drawCursor(
            point,
            gesture
        );


        handleDrawing(
            point,
            gesture
        );


        if (message) {

            message.textContent =
                selectedTool === "flower"
                    ? "🌸 Flower Brush"
                    : "☝️ Drawing";
        }


        if (toolStatus) {

            toolStatus.textContent =
                selectedTool === "flower"
                    ? "🌸 Flower"
                    : "✦ Pen";
        }
    }


    // ================= ERASER =================

    else if (
        gesture === "eraser"
    ) {

        const palm =
            getPalmCenter(
                landmarks
            );


        drawCursor(
            palm,
            gesture
        );


        handleDrawing(
            palm,
            gesture
        );


        if (message) {
            message.textContent =
                "✌️ Erasing";
        }


        if (toolStatus) {
            toolStatus.textContent =
                "🧽 Eraser";
        }
    }


    // ================= IDLE =================

    else {

        endStroke();


        if (message) {

            message.textContent =
                "🖐️ Paused";
        }


        if (toolStatus) {

            toolStatus.textContent =
                "✦ Idle";
        }
    }
}


// ==================================================
// CAMERA
// ==================================================

const camera =
    new Camera(

        video,

        {

            onFrame: async () => {

                await hands.send({
                    image: video
                });

            },

            width: 1280,

            height: 720

        }
    );


camera.start();


message.textContent =
    "Starting hand tracking...";


// ==================================================
// COLORS
// ==================================================

document
    .querySelectorAll(".color")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                currentColor =
                    button.dataset.color;


                document
                    .querySelectorAll(".color")
                    .forEach(b => {

                        b.classList.remove(
                            "active"
                        );

                    });


                button.classList.add(
                    "active"
                );
            }
        );
    });


// ==================================================
// TOOLS
// ==================================================

penTool.addEventListener(
    "click",
    () => {

        selectedTool = "pen";

        penTool.classList.add(
            "active"
        );

        flowerTool.classList.remove(
            "active"
        );
    }
);


flowerTool.addEventListener(
    "click",
    () => {

        selectedTool = "flower";

        flowerTool.classList.add(
            "active"
        );

        penTool.classList.remove(
            "active"
        );
    }
);


// ==================================================
// BRUSH SIZE
// ==================================================

brushSize.addEventListener(
    "input",
    () => {

        brushValue.textContent =
            brushSize.value;
    }
);


// ==================================================
// UNDO / REDO BUTTONS
// ==================================================

undoBtn.addEventListener(
    "click",
    undo
);


redoBtn.addEventListener(
    "click",
    redo
);


// ==================================================
// KEYBOARD SHORTCUTS
// ==================================================

document.addEventListener(
    "keydown",
    (event) => {

        // Ctrl + Z

        if (
            event.ctrlKey &&
            event.key.toLowerCase() === "z"
        ) {

            event.preventDefault();

            undo();
        }


        // Ctrl + Y

        if (
            event.ctrlKey &&
            event.key.toLowerCase() === "y"
        ) {

            event.preventDefault();

            redo();
        }
    }
);


// ==================================================
// CLEAR
// ==================================================

clearBtn.addEventListener(
    "click",
    () => {

        strokes.length = 0;

        redoStack.length = 0;

        endStroke();


        if (projection) {

            drawCtx.clearRect(
                0,
                0,
                projection.width,
                projection.height
            );
        }


        updateUndoRedoButtons();
    }
);


// ==================================================
// SAVE
// ==================================================

saveBtn.addEventListener(
    "click",
    () => {

        const link =
            document.createElement("a");


        link.download =
            "air-canvas-drawing.png";


        link.href =
            drawCanvas.toDataURL(
                "image/png"
            );


        link.click();
    }
);


// ==================================================
// INITIALIZE
// ==================================================

resizeCanvases();

updateUndoRedoButtons();

brushValue.textContent =
    brushSize.value;