// =============================================
// script1.js — flujo original + barra deslizadora para recorte
// =============================================

const documents = [
    "Formato de alta", "Solicitud de empleo", "Copia del acta de nacimiento", "Número de IMSS", "CURP",
    "Copia de comprobante de estudios", "Copia de comprobante de domicilio", "Credencial de elector (Frente)",
    "Credencial de elector (Reverso)", "Guía de entrevista", "Carta de identidad (solo menores)",
    "Permiso firmado por tutor", "Identificación oficial tutor", "Carta responsiva", "Políticas de la empresa",
    "Políticas de propina", "Convenio de manipulaciones", "Convenio de correo electrónico", "Vale de uniforme",
    "Apertura de cuentas", "Contrato laboral", "Responsiva tarjeta de nómina", "Cuenta Santander"
];

const scannedImages = {};
let cropper = null;
let currentDocForCrop = null;
let currentLiveDoc = null;
let liveStream = null;
let cv = null; // Variable para la instancia de OpenCV

const { jsPDF } = window.jspdf; // Mantén esta desestructuración al inicio

// =============================================
// OpenCV listo
// =============================================
function onOpenCvReady() {
    cv = window.cv; // Asigna la instancia de OpenCV a la variable global 'cv'
    if (cv) {
        console.log("OpenCV.js está listo!");
    } else {
        console.error("Error al cargar OpenCV.js");
        alert("Hubo un problema al cargar la librería de procesamiento de imágenes.");
    }
}

// =============================================
// Cargar UI de documentos
// =============================================
window.onload = () => {
    const container = document.getElementById('document-container');

    documents.forEach((docName, index) => {
        const div = document.createElement('div');
        div.className = 'document-box';
        div.innerHTML = `
    <label>${index + 1}. ${docName}</label><br>
    <button onclick="startLiveCamera('${docName}')">📸 Escanear</button>
    <button onclick="openCrop('${docName}')">✂️ Recortar (manual)</button>
    <button onclick="downloadPDF('${docName}')">🖨 Descargar en PDF</button>
    <span id="status-${docName}">❌</span><br>
    <img id="preview-${docName}" class="image-preview" style="display:none;">
`;
        container.appendChild(div);
    });

    // Crear contenedor flex para título + botón "Regresar"
    const header = document.createElement('div');
    header.id = 'header';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '10px';
    header.style.marginBottom = '20px';

    const title = document.querySelector('h1');
    if (title) {
        title.parentNode.insertBefore(header, title);
        header.appendChild(title);

        const backBtn = document.createElement('button');
        backBtn.textContent = '⬅️ Regresar';
        backBtn.style.padding = '15px 20px';
        backBtn.style.cursor = 'pointer';
        backBtn.onclick = () => {
            window.location.href = 'dashboard.html';
        };
        header.appendChild(backBtn);
    }
};

// =============================================
// Cámara en vivo
// =============================================
function startLiveCamera(docName) {
    currentLiveDoc = docName;

    navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        }
    })
        .then((stream) => {
            liveStream = stream;
            document.getElementById("live-video").srcObject = stream;
            document.getElementById("live-camera-modal").style.display = "flex";
        })
        .catch((error) => {
            console.error("Error accediendo a la cámara:", error);
            alert("No se pudo acceder a la cámara de este dispositivo. Asegúrate de dar permisos.");
        });
}

function takePhoto() {
    const video = document.getElementById("live-video");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    closeLiveCamera();

    if (!cv) {
        alert("OpenCV.js no está cargado.");
        const imageDataURL = canvas.toDataURL("image/jpeg", 1.0);
        scannedImages[currentLiveDoc] = imageDataURL;
        document.getElementById(`preview-${currentLiveDoc}`).src = imageDataURL;
        document.getElementById(`preview-${currentLiveDoc}`).style.display = 'block';
        document.getElementById(`status-${currentLiveDoc}`).textContent = '⚠️';
        return;
    }

    processImageWithOpenCV(canvas, currentLiveDoc);
}

function closeLiveCamera() {
    document.getElementById("live-camera-modal").style.display = "none";
    if (liveStream) {
        liveStream.getTracks().forEach(track => track.stop());
        liveStream = null;
    }
}

// =============================================
// Procesamiento con OpenCV (detección documento + warp)
// =============================================
function processImageWithOpenCV(canvasElement, docName) {
    console.log("Iniciando procesamiento con OpenCV.js...");

    let src = cv.imread(canvasElement);
    let dst = new cv.Mat();
    let gray = new cv.Mat();
    let blurred = new cv.Mat();
    let canny = new cv.Mat();
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();

    try {
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
        cv.Canny(blurred, canny, 75, 200, 3, false);

        cv.findContours(canny, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        let maxArea = 0;
        let bestContour = null;

        for (let i = 0; i < contours.size(); ++i) {
            let contour = contours.get(i);
            let area = cv.contourArea(contour);
            if (area < 1000) continue;

            let perimeter = cv.arcLength(contour, true);
            let approx = new cv.Mat();
            cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

            if (approx.rows === 4) {
                if (area > maxArea) {
                    maxArea = area;
                    bestContour = approx;
                }
            }
            approx.delete();
        }

        if (bestContour) {
            let points = [];
            for (let i = 0; i < bestContour.rows; ++i) {
                points.push({ x: bestContour.data32S[i * 2], y: bestContour.data32S[i * 2 + 1] });
            }

            function orderPoints(pts) {
                let rect = new Array(4);
                let s = pts.map(p => p.x + p.y);
                let diff = pts.map(p => p.y - p.x);

                rect[0] = pts[s.indexOf(Math.min(...s))]; // TL
                rect[2] = pts[s.indexOf(Math.max(...s))]; // BR
                rect[1] = pts[diff.indexOf(Math.min(...diff))]; // TR
                rect[3] = pts[diff.indexOf(Math.max(...diff))]; // BL
                return rect;
            }

            let orderedPts = orderPoints(points);
            let [tl, tr, br, bl] = orderedPts;

            let widthA = Math.hypot(br.x - bl.x, br.y - bl.y);
            let widthB = Math.hypot(tr.x - tl.x, tr.y - tl.y);
            let maxWidth = Math.max(parseInt(widthA), parseInt(widthB));

            let heightA = Math.hypot(tr.x - br.x, tr.y - br.y);
            let heightB = Math.hypot(tl.x - bl.x, tl.y - bl.y);
            let maxHeight = Math.max(parseInt(heightA), parseInt(heightB));

            let destCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
                0, 0,
                maxWidth - 1, 0,
                maxWidth - 1, maxHeight - 1,
                0, maxHeight - 1
            ]);
            let srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
                tl.x, tl.y,
                tr.x, tr.y,
                br.x, br.y,
                bl.x, bl.y
            ]);

            let M = cv.getPerspectiveTransform(srcCoords, destCoords);
            let dsize = new cv.Size(maxWidth, maxHeight);
            cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

            srcCoords.delete();
            destCoords.delete();
            M.delete();
            bestContour.delete();

            const finalCanvas = document.createElement('canvas');
            if (docName === "Contrato laboral") {
                let tempGrayForBinarization = new cv.Mat();
                let binarizedMat = new cv.Mat();
                cv.cvtColor(dst, tempGrayForBinarization, cv.COLOR_RGBA2GRAY, 0);
                cv.threshold(tempGrayForBinarization, binarizedMat, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
                cv.imshow(finalCanvas, binarizedMat);
                tempGrayForBinarization.delete();
                binarizedMat.delete();
            } else {
                cv.imshow(finalCanvas, dst);
            }

            const processedDataURL = finalCanvas.toDataURL("image/jpeg", 1.0);

            scannedImages[docName] = processedDataURL;
            document.getElementById(`preview-${docName}`).src = processedDataURL;
            document.getElementById(`preview-${docName}`).style.display = 'block';
            document.getElementById(`status-${docName}`).textContent = '✅';
        } else {
            console.warn("Se guardará la imagen sin procesar.");
            alert("No se detectó un documento claro. Puedes usar la opción 'Recortar (manual)' si es necesario.");
            const originalDataURL = canvasElement.toDataURL("image/jpeg", 1.0);

            scannedImages[docName] = originalDataURL;
            document.getElementById(`preview-${docName}`).src = originalDataURL;
            document.getElementById(`preview-${docName}`).style.display = 'block';
            document.getElementById(`status-${docName}`).textContent = '⚠️';
        }

    } catch (err) {
        console.error("Error durante el procesamiento OpenCV:", err);
        alert("Ocurrió un error al procesar la imagen automáticamente.");
        const originalDataURL = canvasElement.toDataURL("image/jpeg", currentLiveDoc === "Contrato laboral" ? 1.0 : 0.7);
        scannedImages[docName] = originalDataURL;
        document.getElementById(`preview-${docName}`).src = originalDataURL;
        document.getElementById(`preview-${docName}`).style.display = 'block';
        document.getElementById(`status-${docName}`).textContent = '❌';
    } finally {
        src.delete();
        dst.delete();
        gray.delete();
        blurred.delete();
        canny.delete();
        contours.delete();
        hierarchy.delete();
    }
}

// =============================================
// Barra deslizadora para panear la imagen del cropper sin tocarla
// =============================================
// Usa: attachScrollStrip(cropperInstance);
function attachScrollStrip(cropper) {
    const strip = document.getElementById('cropper-scroll-strip');
    const thumb = document.getElementById('scroll-thumb');
    const imgEl = document.getElementById('cropper-image');

    if (!strip || !thumb || !cropper) return;

    function ranges() {
        const ctn = cropper.getContainerData();
        const cvs = cropper.getCanvasData();
        const maxTop = 0;
        const minTop = Math.min(0, ctn.height - cvs.height);
        return { ctn, cvs, minTop, maxTop };
    }

    function setTop(newTop) {
        const { cvs, minTop, maxTop } = ranges();
        const top = Math.max(minTop, Math.min(maxTop, newTop));
        cropper.setCanvasData({ ...cvs, top });
        updateThumb();
    }

    function yToTop(y) {
        const { ctn, cvs, minTop, maxTop } = ranges();
        const stripRect = strip.getBoundingClientRect();
        const usable = stripRect.height - thumb.offsetHeight;
        if (usable <= 0 || cvs.height <= ctn.height) return cvs.top;
        const t = (y - thumb.offsetHeight / 2) / usable; // 0..1
        return minTop + (1 - t) * (maxTop - minTop);
    }

    function topToY() {
        const { ctn, cvs, minTop, maxTop } = ranges();
        const stripRect = strip.getBoundingClientRect();
        const usable = stripRect.height - thumb.offsetHeight;
        if (usable <= 0 || cvs.height <= ctn.height) return 0;
        const t = (cvs.top - minTop) / (maxTop - minTop); // 0..1
        return (1 - t) * usable;
    }

    function updateThumb() {
        const { ctn, cvs } = ranges();
        if (cvs.height <= ctn.height + 1) {
            strip.classList.add('hidden');
            return;
        }
        strip.classList.remove('hidden');

        const ratio = ctn.height / cvs.height;
        const minThumb = 36;
        const h = Math.max(minThumb, Math.round(ratio * (strip.clientHeight - 4)));
        thumb.style.height = h + 'px';

        const y = topToY();
        thumb.style.transform = `translateY(${Math.max(2, y + 2)}px)`;
    }

    let dragging = false;

    const onPointerDown = (e) => {
        dragging = true;
        strip.setPointerCapture(e.pointerId);
        moveToEvent(e);
    };
    const onPointerMove = (e) => {
        if (!dragging) return;
        moveToEvent(e);
    };
    const onPointerUp = () => { dragging = false; };

    function moveToEvent(e) {
        const rect = strip.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const top = yToTop(y);
        setTop(top);
    }

    strip.addEventListener('pointerdown', onPointerDown);
    strip.addEventListener('pointermove', onPointerMove);
    strip.addEventListener('pointerup', onPointerUp);
    strip.addEventListener('pointercancel', onPointerUp);

    strip.addEventListener('wheel', (e) => {
        e.preventDefault();
        const { cvs } = ranges();
        setTop(cvs.top - e.deltaY);
    }, { passive: false });

    imgEl.addEventListener('ready', updateThumb);
    imgEl.addEventListener('zoom', updateThumb);
    imgEl.addEventListener('crop', updateThumb);
    imgEl.addEventListener('cropend', updateThumb);

    new ResizeObserver(updateThumb).observe(document.getElementById('cropper-container'));

    setTimeout(updateThumb, 60);
}

// =============================================
// Modal de recorte manual con Cropper.js
// =============================================
function openCrop(docName) {
    const imageSrc = scannedImages[docName];
    if (!imageSrc) {
        alert("Primero escanea la imagen.");
        return;
    }

    currentDocForCrop = docName;
    const cropperImg = document.getElementById("cropper-image");
    const modal = document.getElementById("cropper-modal");
    const container = document.getElementById('cropper-container');
    const strip = document.getElementById('cropper-scroll-strip');

    modal.style.display = "flex";
    if (container) container.scrollTop = 0;

    if (strip && container) {
        strip.addEventListener('click', () =>
            container.scrollBy({ top: container.clientHeight * 0.8, behavior: 'smooth' })
            , { once: true });
    }

    // Resetear cropper previo si existía
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }

    cropperImg.src = "";
    cropperImg.onload = () => {
        if (cropperImg.src) {
            cropper = new Cropper(cropperImg, {
                viewMode: 1,
                autoCropArea: 0.8,
                responsive: true,
                background: false,
                movable: true,
                zoomable: true,
                dragMode: 'crop',
                toggleDragModeOnDblclick: false
            });
            // 🔗 Conectar barra deslizadora personalizada al cropper
            attachScrollStrip(cropper);
        }
    };
    cropperImg.onerror = () => {
        console.error("Error cargando la imagen para recortar:", imageSrc);
        alert("Hubo un problema cargando la imagen para recortar.");
        closeCrop();
    };
    cropperImg.src = imageSrc;
}

function confirmCrop() {
    if (!cropper) {
        alert("Cropper no está activo.");
        return;
    }

    const canvas = cropper.getCroppedCanvas();
    if (!canvas) {
        alert("No se pudo obtener el área recortada.");
        return;
    }

    const croppedDataUrl = canvas.toDataURL("image/jpeg", 1.0);
    scannedImages[currentDocForCrop] = croppedDataUrl;

    document.getElementById(`preview-${currentDocForCrop}`).src = croppedDataUrl;
    document.getElementById(`preview-${currentDocForCrop}`).style.display = 'block';
    document.getElementById(`status-${currentDocForCrop}`).textContent = '🟩';

    closeCrop();
}

function closeCrop() {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    document.getElementById("cropper-modal").style.display = "none";
}

// =============================================
// ZIP por documento (PDF por archivo)
// =============================================
async function generateZip() {
    const imss = document.getElementById('input-imss').value.trim();
    if (!imss) {
        alert("Por favor, ingresa el Número de IMSS antes de generar el ZIP.");
        return;
    }

    const fecha = getCurrentDateFormatted();
    const zip = new JSZip();
    const pdfPromises = [];
    let index = 1;

    for (const [docName, imageData] of Object.entries(scannedImages)) {
        const promise = new Promise((resolve) => {
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: 'a4'
            });

            const img = new Image();
            img.onload = function () {
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();

                let imgWidth = img.width;
                let imgHeight = img.height;
                const scale = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);

                imgWidth *= scale;
                imgHeight *= scale;

                const x = (pageWidth - imgWidth) / 2;
                const y = (pageHeight - imgHeight) / 2;

                pdf.addImage(img, 'JPEG', x, y, imgWidth, imgHeight);
                pdfOutput = pdf.output('blob'); // (queda global como en tu flujo)
                zip.file(`${imss}_${fecha}_${index++}_${docName}.pdf`, pdfOutput);
                resolve();
            };
            img.src = imageData;
        });

        pdfPromises.push(promise);
    }

    await Promise.all(pdfPromises);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Documentos_${imss}_${fecha}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

// =============================================
// PDF único con todas las imágenes
// =============================================
async function generateOptimizedPDF() {
    const { jsPDF } = window.jspdf;
    const imss = document.getElementById('input-imss').value.trim();
    if (!imss) {
        alert("Por favor, ingresa el Número de IMSS antes de generar el PDF.");
        return;
    }

    const fecha = getCurrentDateFormatted();
    const pdf = new jsPDF();

    const entries = Object.entries(scannedImages);
    for (let i = 0; i < entries.length; i++) {
        const [docName, imageData] = entries[i];
        const imgProps = pdf.getImageProperties(imageData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imageData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    }

    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${imss}_${fecha}_Documentos.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

// =============================================
// Utilidades varias
// =============================================
function compressImage(dataURL, quality) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
            resolve(compressedDataUrl);
        };
        img.src = dataURL;
    });
}

function getCurrentDateFormatted() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

// =============================================
// Descargar PDF por documento
// =============================================
function downloadPDF(docName) {
    const imageData = scannedImages[docName];
    const imss = document.getElementById('input-imss').value.trim();

    if (!imageData) {
        alert(`Debes escanear el documento "${docName}" primero.`);
        return;
    }
    if (!imss) {
        alert("Por favor, ingresa el Número de IMSS antes de descargar el PDF.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const fecha = getCurrentDateFormatted();

    const img = new Image();
    img.onload = () => {
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (img.height * pdfWidth) / img.width;

        pdf.addImage(imageData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${imss}_${docName.replace(/[\s/]/g, '_')}_${fecha}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };
    img.src = imageData;
}
