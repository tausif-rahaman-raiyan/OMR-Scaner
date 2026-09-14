/**
 * Medical Admission OMR Scanner - Standalone OpenCV.js Engine
 * Specifically calibrated for 100-Question OMR sheets (4 columns of 25 questions)
 */

const STANDARD_WIDTH = 1200;
const STANDARD_HEIGHT = 1700;
const QUESTION_ROW_START_Y = 440;
const QUESTION_ROW_HEIGHT = 47.5;
const BUBBLE_RADIUS = 13;

const OMR_COLUMNS = [
  { startQ: 1, endQ: 25, xStart: 45, xEnd: 310 },
  { startQ: 26, endQ: 50, xStart: 335, xEnd: 600 },
  { startQ: 51, endQ: 75, xStart: 625, xEnd: 890 },
  { startQ: 76, endQ: 100, xStart: 915, xEnd: 1180 },
];

let scannedResults = [];
let scanStats = { total: 100, answered: 0, blank: 100, multiple: 0, avgConfidence: 0 };
let activeStream = null;

// DOM Elements
const cvStatus = document.getElementById('cvStatus');
const fileInput = document.getElementById('fileInput');
const cameraInput = document.getElementById('cameraInput');
const btnTakePhoto = document.getElementById('btnTakePhoto');
const btnChoosePhoto = document.getElementById('btnChoosePhoto');
const btnLoadSample = document.getElementById('btnLoadSample');
const btnToggleLiveCam = document.getElementById('btnToggleLiveCam');
const btnRescan = document.getElementById('btnRescan');
const btnRotateSheet = document.getElementById('btnRotateSheet');
const chkOverlay = document.getElementById('chkOverlay');

const videoContainer = document.getElementById('videoContainer');
const webcamVideo = document.getElementById('webcamVideo');
const btnCaptureFrame = document.getElementById('btnCaptureFrame');
const btnCloseCam = document.getElementById('btnCloseCam');

const displayCanvas = document.getElementById('displayCanvas');
const overlayCanvas = document.getElementById('overlayCanvas');
const answersTableBody = document.getElementById('answersTableBody');
const codeOutput = document.getElementById('codeOutput');
const reviewWarning = document.getElementById('reviewWarning');
const warningText = document.getElementById('warningText');

const statAnswered = document.getElementById('statAnswered');
const statBlank = document.getElementById('statBlank');
const statMultiple = document.getElementById('statMultiple');
const statConfidence = document.getElementById('statConfidence');

const tabAnswersBtn = document.getElementById('tabAnswersBtn');
const tabCodeBtn = document.getElementById('tabCodeBtn');
const tabAnswersContent = document.getElementById('tabAnswersContent');
const tabCodeContent = document.getElementById('tabCodeContent');

const btnCopyScript = document.getElementById('btnCopyScript');
const btnSelectAnswers = document.getElementById('btnSelectAnswers');
const btnSelectSubmit = document.getElementById('btnSelectSubmit');
const submitModal = document.getElementById('submitModal');
const btnCancelSubmit = document.getElementById('btnCancelSubmit');
const btnConfirmSubmit = document.getElementById('btnConfirmSubmit');

// Coordinate helper
function getBubbleCoordinates(qNumber, optIndex) {
  const col = OMR_COLUMNS.find(c => qNumber >= c.startQ && qNumber <= c.endQ) || OMR_COLUMNS[0];
  const rowIndex = qNumber - col.startQ;
  const y = QUESTION_ROW_START_Y + (rowIndex + 0.5) * QUESTION_ROW_HEIGHT;
  const x = col.xStart + 76 + optIndex * 48;
  return { x, y, radius: BUBBLE_RADIUS };
}

// OpenCV status checker
function checkOpenCV() {
  if (window.cv && typeof window.cv.Mat === 'function') {
    cvStatus.className = 'status-badge';
    cvStatus.innerHTML = '<span>●</span> OpenCV.js Ready';
    return true;
  }
  return false;
}

const cvInterval = setInterval(() => {
  if (checkOpenCV()) {
    clearInterval(cvInterval);
  }
}, 300);

// Initialize Blank Table
function initEmptyTable() {
  answersTableBody.innerHTML = '';
  for (let q = 1; q <= 100; q++) {
    const tr = document.createElement('tr');
    tr.id = `row-q-${q}`;
    tr.innerHTML = `
      <td style="font-weight: 700; font-family: monospace;">Q${q}</td>
      <td id="ans-${q}">—</td>
      <td><span class="badge badge-blank" id="status-${q}">Blank</span></td>
      <td id="conf-${q}">—</td>
    `;
    answersTableBody.appendChild(tr);
  }
}

// Render Sample Sheet
function renderSampleSheet() {
  displayCanvas.width = STANDARD_WIDTH;
  displayCanvas.height = STANDARD_HEIGHT;
  const ctx = displayCanvas.getContext('2d');
  
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, STANDARD_WIDTH, STANDARD_HEIGHT);

  // Border & Fiducials
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.strokeRect(25, 25, STANDARD_WIDTH - 50, STANDARD_HEIGHT - 50);

  ctx.fillStyle = '#0f172a';
  const fSize = 34;
  ctx.fillRect(35, 35, fSize, fSize);
  ctx.fillRect(STANDARD_WIDTH - 35 - fSize, 35, fSize, fSize);
  ctx.fillRect(35, STANDARD_HEIGHT - 35 - fSize, fSize, fSize);
  ctx.fillRect(STANDARD_WIDTH - 35 - fSize, STANDARD_HEIGHT - 35 - fSize, fSize, fSize);

  // Header Text
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DIRECTORATE GENERAL OF HEALTH SERVICES (DGHS)', STANDARD_WIDTH / 2, 70);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('MEDICAL ADMISSION QUESTION PAPER 2025-2026', STANDARD_WIDTH / 2, 105);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('OMR ANSWER SHEET • 100 QUESTIONS • OPTIONS A, B, C, D', STANDARD_WIDTH / 2, 135);

  // Divider
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(40, 150);
  ctx.lineTo(STANDARD_WIDTH - 40, 150);
  ctx.stroke();

  // Set Code box
  ctx.strokeRect(45, 165, 260, 220);
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(45, 165, 260, 32);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('QUESTION SET CODE', 175, 187);

  ['A', 'B', 'C', 'D'].forEach((code, i) => {
    const x = 75 + i * 55;
    const y = 240;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(code, x, y - 20);
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.stroke();
    if (code === 'B') {
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.fillStyle = '#0f172a';
    }
  });

  // Roll & Reg boxes
  ctx.strokeRect(330, 165, 390, 220);
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(330, 165, 390, 32);
  ctx.fillStyle = '#0f172a';
  ctx.fillText('ROLL NUMBER: 285149', 525, 187);

  ctx.strokeRect(745, 165, 410, 220);
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(745, 165, 410, 32);
  ctx.fillStyle = '#0f172a';
  ctx.fillText('REGISTRATION NUMBER: 9403217', 950, 187);

  // 4 Columns of 25 questions each
  const opts = ['A', 'B', 'C', 'D'];
  const sampleChoices = ['c', 'a', 'd', 'b', 'c', 'b', 'a', 'd', 'b', 'c'];

  OMR_COLUMNS.forEach(col => {
    ctx.strokeRect(col.xStart, QUESTION_ROW_START_Y - 20, col.xEnd - col.xStart, 25 * QUESTION_ROW_HEIGHT + 24);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(col.xStart, QUESTION_ROW_START_Y - 20, col.xEnd - col.xStart, 24);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Q. ${col.startQ}-${col.endQ}`, col.xStart + 8, QUESTION_ROW_START_Y - 4);

    opts.forEach((opt, idx) => {
      ctx.textAlign = 'center';
      ctx.fillText(opt, col.xStart + 76 + idx * 48, QUESTION_ROW_START_Y - 4);
    });

    for (let q = col.startQ; q <= col.endQ; q++) {
      const rowIndex = q - col.startQ;
      const y = QUESTION_ROW_START_Y + (rowIndex + 0.5) * QUESTION_ROW_HEIGHT;

      if (rowIndex % 2 === 1) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(col.xStart + 2, y - QUESTION_ROW_HEIGHT / 2 + 1, col.xEnd - col.xStart - 4, QUESTION_ROW_HEIGHT - 2);
      }

      // Q number
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(q.toString().padStart(2, '0'), col.xStart + 42, y + 4);

      // Pre-fill realistic sample pattern
      const isBlank = (q === 12 || q === 38 || q === 64);
      const isMulti = (q === 4 || q === 82);
      const patternAnswer = sampleChoices[(q * 3 + 2) % sampleChoices.length];

      opts.forEach((opt, optIndex) => {
        const x = col.xStart + 76 + optIndex * 48;
        ctx.beginPath();
        ctx.arc(x, y, BUBBLE_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        const optLetter = opt.toLowerCase();
        let shouldFill = false;

        if (!isBlank) {
          if (isMulti && (optIndex === 0 || optIndex === 1)) {
            shouldFill = true;
          } else if (!isMulti && optLetter === patternAnswer) {
            shouldFill = true;
          }
        }

        if (shouldFill) {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(x, y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.font = '10px sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.textAlign = 'center';
          ctx.fillText(opt, x, y + 3.5);
        }
      });
    }
  });

  // Process bubbles now
  processScannedSheet();
}

// Bubble Fill Evaluator
function sampleFill(ctx, cx, cy, radius = 12) {
  const box = radius * 2 + 10;
  const sx = Math.max(0, Math.floor(cx - box / 2));
  const sy = Math.max(0, Math.floor(cy - box / 2));

  let imgData;
  try {
    imgData = ctx.getImageData(sx, sy, box, box);
  } catch (e) {
    return 0;
  }

  const data = imgData.data;
  let inSum = 0, inCount = 0;
  let bgSum = 0, bgCount = 0;

  const innerR2 = (radius - 2) ** 2;
  const bgR1 = (radius + 2) ** 2;
  const bgR2 = (radius + 6) ** 2;

  for (let py = 0; py < box; py++) {
    for (let px = 0; px < box; px++) {
      const dx = (sx + px) - cx;
      const dy = (sy + py) - cy;
      const dist2 = dx * dx + dy * dy;
      const idx = (py * box + px) * 4;
      const darkness = 255 - (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);

      if (dist2 <= innerR2) {
        inSum += darkness;
        inCount++;
      } else if (dist2 >= bgR1 && dist2 <= bgR2) {
        bgSum += darkness;
        bgCount++;
      }
    }
  }

  const innerAvg = inCount > 0 ? inSum / inCount : 0;
  const bgAvg = bgCount > 0 ? bgSum / bgCount : 0;
  return Math.max(0, innerAvg - bgAvg);
}

// Process sheet and evaluate 100 questions
function processScannedSheet() {
  const ctx = displayCanvas.getContext('2d');
  overlayCanvas.width = STANDARD_WIDTH;
  overlayCanvas.height = STANDARD_HEIGHT;
  const overlayCtx = overlayCanvas.getContext('2d');
  overlayCtx.clearRect(0, 0, STANDARD_WIDTH, STANDARD_HEIGHT);

  scannedResults = [];
  const options = ['a', 'b', 'c', 'd'];
  let answered = 0;
  let blank = 0;
  let multiple = 0;
  let uncertain = 0;
  let totalConfidence = 0;

  const threshold = 30;

  for (let q = 1; q <= 100; q++) {
    const fills = {};
    const coords = {};

    options.forEach((opt, idx) => {
      coords[opt] = getBubbleCoordinates(q, idx);
      fills[opt] = sampleFill(ctx, coords[opt].x, coords[opt].y, coords[opt].radius);
    });

    const sorted = [...options].sort((x, y) => fills[y] - fills[x]);
    const bestOpt = sorted[0];
    const secondOpt = sorted[1];
    const bestVal = fills[bestOpt];
    const secondVal = fills[secondOpt];

    let status = 'blank';
    let detectedAns = null;
    let confidence = 0;

    if (bestVal < threshold) {
      status = 'blank';
      confidence = 95;
      blank++;
    } else if (secondVal >= threshold * 0.72 && (bestVal - secondVal) < 18) {
      status = 'multiple';
      confidence = 50;
      multiple++;
    } else if (bestVal >= threshold && (bestVal - secondVal) < 14) {
      status = 'uncertain';
      confidence = 55;
      uncertain++;
    } else {
      status = 'answered';
      detectedAns = bestOpt;
      confidence = Math.min(99, Math.max(70, Math.round(72 + (bestVal - secondVal) * 0.55)));
      answered++;
      totalConfidence += confidence;
    }

    scannedResults.push({
      qNumber: q,
      answer: detectedAns,
      status,
      confidence
    });

    // Draw markers on overlay
    options.forEach((opt) => {
      const c = coords[opt];
      if (detectedAns === opt) {
        overlayCtx.beginPath();
        overlayCtx.arc(c.x, c.y, c.radius + 3, 0, Math.PI * 2);
        overlayCtx.fillStyle = 'rgba(16, 185, 129, 0.45)';
        overlayCtx.fill();
        overlayCtx.strokeStyle = '#059669';
        overlayCtx.lineWidth = 2.5;
        overlayCtx.stroke();
        overlayCtx.fillStyle = '#fff';
        overlayCtx.font = 'bold 12px sans-serif';
        overlayCtx.textAlign = 'center';
        overlayCtx.fillText(opt.toUpperCase(), c.x, c.y + 4);
      } else if (status === 'multiple' && fills[opt] >= threshold * 0.72) {
        overlayCtx.beginPath();
        overlayCtx.arc(c.x, c.y, c.radius + 3, 0, Math.PI * 2);
        overlayCtx.fillStyle = 'rgba(239, 68, 68, 0.5)';
        overlayCtx.fill();
        overlayCtx.strokeStyle = '#dc2626';
        overlayCtx.lineWidth = 2.5;
        overlayCtx.stroke();
      }
    });

    // Update Table Row
    const ansEl = document.getElementById(`ans-${q}`);
    const statusEl = document.getElementById(`status-${q}`);
    const confEl = document.getElementById(`conf-${q}`);

    if (ansEl && statusEl && confEl) {
      if (status === 'answered') {
        ansEl.innerHTML = `<span class="choice-pill">${detectedAns.toUpperCase()}</span>`;
        statusEl.className = 'badge badge-answered';
        statusEl.textContent = 'Answered';
        confEl.textContent = `${confidence}%`;
      } else if (status === 'multiple') {
        ansEl.innerHTML = `<span style="color: #ef4444; font-weight: bold;">MULTI</span>`;
        statusEl.className = 'badge badge-multiple';
        statusEl.textContent = 'Multiple';
        confEl.textContent = '—';
      } else if (status === 'uncertain') {
        ansEl.innerHTML = `<span style="color: #f59e0b; font-weight: bold;">UNCERTAIN</span>`;
        statusEl.className = 'badge badge-uncertain';
        statusEl.textContent = 'Uncertain';
        confEl.textContent = `${confidence}%`;
      } else {
        ansEl.textContent = '—';
        statusEl.className = 'badge badge-blank';
        statusEl.textContent = 'Blank';
        confEl.textContent = '—';
      }
    }
  }

  // Update Stats
  const avgConf = answered > 0 ? Math.round(totalConfidence / answered) : 0;
  statAnswered.textContent = answered;
  statBlank.textContent = blank;
  statMultiple.textContent = multiple;
  statConfidence.textContent = `${avgConf}%`;

  // Warning Banner
  const reviewCount = multiple + uncertain;
  if (reviewCount > 0) {
    reviewWarning.style.display = 'flex';
    warningText.textContent = `⚠ ${reviewCount} questions need review before copying (Multiple or Uncertain marks detected).`;
  } else {
    reviewWarning.style.display = 'none';
  }

  // Generate Script
  generateCode();
}

// Generate Console Script
function generateCode(includeSubmit = false) {
  const answerMap = {};
  scannedResults.forEach(r => {
    if (r.status === 'answered' && r.answer) {
      answerMap[r.qNumber.toString()] = r.answer;
    }
  });

  const jsonStr = JSON.stringify(answerMap, null, 2);

  let script = `// ========================================================
// 🎯 Medical Admission Exam Console OMR Bridge
// Compatible with: Secret file (secret-file-25.blogspot.com)
// Generated by OMR Scanner (${Object.keys(answerMap).length} detected answers)
// ========================================================

(() => {
    // 1. Auto-start exam if Entry Modal is still open
    const entryModal = document.getElementById('entry-modal');
    if (entryModal && !entryModal.classList.contains('hidden') && typeof window.startExam === 'function') {
        window.startExam('omr');
    }

    // 2. Answers detected from Hard OMR sheet (1-based Q# -> choice)
    const omrAnswers = ${jsonStr};

    let filledCount = 0;

    // 3. Select each answer (OMR Q1 -> index 0, Q2 -> index 1, ... Q100 -> index 99)
    Object.entries(omrAnswers).forEach(([qNum, choice]) => {
        const qIndex = Number(qNum) - 1;
        const opt = String(choice).toLowerCase().trim();

        // Reset previous answer click if any, so handleAnswer accepts it
        if (typeof userAnswers !== 'undefined') {
            delete userAnswers[qIndex];
        }

        // Call the exam platform's native handler
        if (typeof window.handleAnswer === 'function') {
            window.handleAnswer(qIndex, opt);
            filledCount++;
        } else if (typeof userAnswers !== 'undefined') {
            userAnswers[qIndex] = opt;
            filledCount++;
        }
    });

    // 4. Force refresh of questions UI and progress bar
    if (typeof renderQuestions === 'function') {
        renderQuestions();
    }
    if (typeof updateProgress === 'function') {
        updateProgress();
    }

    console.log('%c✓ OMR Bridge: Successfully selected ' + filledCount + '/100 answers into your exam!', 'color: #10b981; font-weight: bold; font-size: 14px;');`;

  if (includeSubmit) {
    script += `\n\n    // 5. User-confirmed auto submit\n    if (typeof window.submitExam === 'function') {\n        console.log('%cSubmitting exam now...', 'color: #f43f5e; font-weight: bold;');\n        window.submitExam();\n    }`;
  }

  script += `\n})();`;

  codeOutput.textContent = script;
  return script;
}

// Copy to clipboard helper
function copyTextToClipboard(text, successMsg = 'Copied to clipboard!') {
  navigator.clipboard.writeText(text).then(() => {
    alert(successMsg);
  }).catch(() => {
    // Fallback prompt
    prompt('Copy code:', text);
  });
}

// Event Listeners
btnLoadSample.addEventListener('click', renderSampleSheet);

btnTakePhoto.addEventListener('click', () => {
  cameraInput.click();
});

btnChoosePhoto.addEventListener('click', () => {
  fileInput.click();
});

function handleImageUpload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      displayCanvas.width = STANDARD_WIDTH;
      displayCanvas.height = STANDARD_HEIGHT;
      const ctx = displayCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0, STANDARD_WIDTH, STANDARD_HEIGHT);
      processScannedSheet();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleImageUpload(e.target.files[0]);
  }
});

cameraInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleImageUpload(e.target.files[0]);
  }
});

// Live Webcam
btnToggleLiveCam.addEventListener('click', async () => {
  if (activeStream) {
    activeStream.getTracks().forEach(t => t.stop());
    activeStream = null;
    videoContainer.style.display = 'none';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    activeStream = stream;
    webcamVideo.srcObject = stream;
    videoContainer.style.display = 'block';
  } catch (err) {
    alert('Could not access camera: ' + err.message);
  }
});

btnCaptureFrame.addEventListener('click', () => {
  if (!activeStream) return;
  displayCanvas.width = STANDARD_WIDTH;
  displayCanvas.height = STANDARD_HEIGHT;
  const ctx = displayCanvas.getContext('2d');
  ctx.drawImage(webcamVideo, 0, 0, STANDARD_WIDTH, STANDARD_HEIGHT);

  // Close webcam stream
  activeStream.getTracks().forEach(t => t.stop());
  activeStream = null;
  videoContainer.style.display = 'none';

  processScannedSheet();
});

btnCloseCam.addEventListener('click', () => {
  if (activeStream) {
    activeStream.getTracks().forEach(t => t.stop());
    activeStream = null;
  }
  videoContainer.style.display = 'none';
});

btnRotateSheet.addEventListener('click', () => {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = displayCanvas.width;
  tempCanvas.height = displayCanvas.height;
  tempCanvas.getContext('2d').drawImage(displayCanvas, 0, 0);

  const ctx = displayCanvas.getContext('2d');
  ctx.clearRect(0, 0, STANDARD_WIDTH, STANDARD_HEIGHT);
  ctx.save();
  ctx.translate(STANDARD_WIDTH / 2, STANDARD_HEIGHT / 2);
  ctx.rotate((90 * Math.PI) / 180);
  ctx.drawImage(tempCanvas, -STANDARD_WIDTH / 2, -STANDARD_HEIGHT / 2);
  ctx.restore();

  processScannedSheet();
});

btnRescan.addEventListener('click', processScannedSheet);

chkOverlay.addEventListener('change', () => {
  overlayCanvas.style.display = chkOverlay.checked ? 'block' : 'none';
});

// Tabs
tabAnswersBtn.addEventListener('click', () => {
  tabAnswersBtn.className = 'tab-btn active';
  tabCodeBtn.className = 'tab-btn';
  tabAnswersContent.style.display = 'block';
  tabCodeContent.style.display = 'none';
});

tabCodeBtn.addEventListener('click', () => {
  tabCodeBtn.className = 'tab-btn active';
  tabAnswersBtn.className = 'tab-btn';
  tabCodeContent.style.display = 'block';
  tabAnswersContent.style.display = 'none';
  generateCode(false);
});

// Copy Scripts
btnCopyScript.addEventListener('click', () => {
  const code = generateCode(false);
  copyTextToClipboard(code, 'Console script copied! Paste it into your exam page console.');
});

btnSelectAnswers.addEventListener('click', () => {
  const code = generateCode(false);
  copyTextToClipboard(code, 'Selection script copied!');
});

btnSelectSubmit.addEventListener('click', () => {
  submitModal.style.display = 'flex';
});

btnCancelSubmit.addEventListener('click', () => {
  submitModal.style.display = 'none';
});

btnConfirmSubmit.addEventListener('click', () => {
  submitModal.style.display = 'none';
  const code = generateCode(true);
  copyTextToClipboard(code, 'Select + Submit script copied! Review your answers carefully on the exam page before pressing Enter.');
});

// Initialize on load
initEmptyTable();
renderSampleSheet();
