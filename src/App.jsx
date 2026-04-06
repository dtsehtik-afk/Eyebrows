import { useState, useRef, useEffect } from "react";

// MediaPipe eyebrow landmark indices (468-point model)
const RIGHT_BROW_IDX = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107];
const LEFT_BROW_IDX  = [276, 283, 282, 295, 285, 300, 293, 334, 296, 336];

let _landmarker = null;
let _landmarkerLoading = null;

async function getFaceLandmarker() {
  if (_landmarker) return _landmarker;
  if (_landmarkerLoading) return _landmarkerLoading;
  _landmarkerLoading = (async () => {
    const { FaceLandmarker, FilesetResolver } = window;
    if (!FaceLandmarker || !FilesetResolver) throw new Error("MediaPipe not loaded");
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    _landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "IMAGE",
      numFaces: 1,
    });
    return _landmarker;
  })();
  return _landmarkerLoading;
}

// Returns { right: {x,y,w,h}, left: {x,y,w,h} } in normalized [0,1] coords, or null
async function detectBrowBoxes(imageBase64) {
  try {
    const landmarker = await getFaceLandmarker();
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const result = landmarker.detect(img);
          if (!result.faceLandmarks?.length) { resolve(null); return; }
          const lm = result.faceLandmarks[0];
          const browBox = (indices, padX = 0.012, padY = 0.018) => {
            const xs = indices.map(i => lm[i].x);
            const ys = indices.map(i => lm[i].y);
            const minX = Math.max(0, Math.min(...xs) - padX);
            const minY = Math.max(0, Math.min(...ys) - padY);
            const maxX = Math.min(1, Math.max(...xs) + padX);
            const maxY = Math.min(1, Math.max(...ys) + padY);
            return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
          };
          resolve({ right: browBox(RIGHT_BROW_IDX), left: browBox(LEFT_BROW_IDX) });
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = `data:image/jpeg;base64,${imageBase64}`;
    });
  } catch { return null; }
}

// Resize image to max 1024px and compress before sending to API
function resizeImage(base64, maxSize = 1024, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
    };
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

// ─── Eyebrow style definitions ────────────────────────────────────────────────
// spine: normalized points along the brow
//   x: 0 = inner corner (near nose), 1 = outer corner (near ear)
//   y: 0 = top of browBox, 1 = bottom of browBox
//   t: thickness as fraction of browBox height at this point
const BROW_STYLES = [
  {
    id: "natural", name_he: "טבעי", name_en: "Natural",
    spine: [
      { x: 0, y: 0.72, t: 0.16 },
      { x: 0.22, y: 0.38, t: 0.30 },
      { x: 0.52, y: 0.24, t: 0.32 },
      { x: 0.78, y: 0.32, t: 0.22 },
      { x: 1,    y: 0.56, t: 0.10 },
    ],
  },
  {
    id: "highArch", name_he: "קשת גבוהה", name_en: "High Arch",
    spine: [
      { x: 0, y: 0.78, t: 0.14 },
      { x: 0.20, y: 0.50, t: 0.26 },
      { x: 0.44, y: 0.14, t: 0.30 },
      { x: 0.70, y: 0.26, t: 0.20 },
      { x: 1,    y: 0.62, t: 0.09 },
    ],
  },
  {
    id: "straight", name_he: "ישר ומלא", name_en: "Straight & Full",
    spine: [
      { x: 0, y: 0.58, t: 0.24 },
      { x: 0.25, y: 0.40, t: 0.38 },
      { x: 0.55, y: 0.36, t: 0.38 },
      { x: 0.80, y: 0.40, t: 0.28 },
      { x: 1,    y: 0.58, t: 0.14 },
    ],
  },
  {
    id: "thin", name_he: "דק ומוגדר", name_en: "Thin & Defined",
    spine: [
      { x: 0, y: 0.72, t: 0.09 },
      { x: 0.25, y: 0.42, t: 0.16 },
      { x: 0.55, y: 0.28, t: 0.17 },
      { x: 0.80, y: 0.36, t: 0.13 },
      { x: 1,    y: 0.62, t: 0.06 },
    ],
  },
  {
    id: "bold", name_he: "בולד ודרמטי", name_en: "Bold & Dramatic",
    spine: [
      { x: 0, y: 0.74, t: 0.18 },
      { x: 0.18, y: 0.46, t: 0.36 },
      { x: 0.42, y: 0.16, t: 0.42 },
      { x: 0.66, y: 0.24, t: 0.32 },
      { x: 1,    y: 0.65, t: 0.12 },
    ],
  },
  {
    id: "softFull", name_he: "רך ועגול", name_en: "Soft & Round",
    spine: [
      { x: 0, y: 0.68, t: 0.20 },
      { x: 0.22, y: 0.34, t: 0.34 },
      { x: 0.50, y: 0.22, t: 0.36 },
      { x: 0.76, y: 0.30, t: 0.28 },
      { x: 1,    y: 0.55, t: 0.13 },
    ],
  },
];

const BROW_COLORS = [
  { label_he: "שחור",      label_en: "Black",        hex: "#18100a" },
  { label_he: "חום כהה",   label_en: "Dark Brown",   hex: "#3b1f0a" },
  { label_he: "חום בינוני",label_en: "Medium Brown",  hex: "#6b3d1a" },
  { label_he: "חום בהיר",  label_en: "Light Brown",   hex: "#9b6240" },
  { label_he: "טאופ",      label_en: "Taupe",         hex: "#7a6858" },
];

// ─── Canvas eyebrow application ───────────────────────────────────────────────
function sampleSkinColor(ctx, x, y, w, h) {
  const data = ctx.getImageData(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.data.length; i += 4) { r += data.data[i]; g += data.data[i+1]; b += data.data[i+2]; }
  const n = data.data.length / 4;
  return `rgb(${Math.round(r/n)},${Math.round(g/n)},${Math.round(b/n)})`;
}

function coverBrow(ctx, bx, by, bw, bh, skinColor) {
  ctx.save();
  ctx.filter = `blur(${Math.round(bh * 0.4)}px)`;
  ctx.fillStyle = skinColor;
  ctx.fillRect(bx - bh * 0.3, by - bh * 0.2, bw + bh * 0.6, bh + bh * 0.4);
  ctx.filter = "none";
  ctx.restore();
}

async function applyEyebrowStyle(imageBase64, browBoxes, styleIndex, colorHex) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const style = BROW_STYLES[styleIndex] || BROW_STYLES[0];

      // browBoxes is { right, left } from MediaPipe, or null (fallback to split estimate)
      let rightBox, leftBox;
      if (browBoxes?.right && browBoxes?.left) {
        rightBox = browBoxes.right;
        leftBox  = browBoxes.left;
      } else {
        // Fallback: split the Gemini browBox 50/50
        const box = browBoxes || { x: 0.10, y: 0.30, w: 0.80, h: 0.13 };
        const gap = box.w * 0.04;
        const hw = (box.w - gap) / 2;
        rightBox = { x: box.x,        y: box.y, w: hw, h: box.h };
        leftBox  = { x: box.x + hw + gap, y: box.y, w: hw, h: box.h };
      }

      const applyOne = (box, flip) => {
        const bx = box.x * img.width;
        const by = box.y * img.height;
        const bw = box.w * img.width;
        const bh = box.h * img.height;
        // Sample skin from just above the brow
        const skinY = Math.max(0, by - bh * 0.8);
        const skinColor = sampleSkinColor(ctx, bx + bw*0.1, skinY, bw*0.8, Math.max(4, bh*0.4));
        coverBrow(ctx, bx, by, bw, bh, skinColor);
        drawBrowShape(ctx, bx, by, bw, bh, style.spine, colorHex, flip);
      };

      applyOne(rightBox, false); // person's right brow — not flipped
      applyOne(leftBox,  true);  // person's left brow  — mirrored

      resolve(canvas.toDataURL("image/jpeg", 0.93));
    };
    img.src = `data:image/jpeg;base64,${imageBase64}`;
  });
}

function drawBrowShape(ctx, x, y, w, h, spine, colorHex, flip) {
  const r = parseInt(colorHex.slice(1, 3), 16);
  const g = parseInt(colorHex.slice(3, 5), 16);
  const b = parseInt(colorHex.slice(5, 7), 16);

  // Build top and bottom edge points of the brow
  const top = spine.map(p => ({
    x: x + (flip ? 1 - p.x : p.x) * w,
    y: y + (p.y - p.t / 2) * h,
  }));
  const bottom = spine.map(p => ({
    x: x + (flip ? 1 - p.x : p.x) * w,
    y: y + (p.y + p.t / 2) * h,
  })).reverse();

  // Soft glow / blur layer for feathered edges
  ctx.save();
  ctx.filter = `blur(${Math.round(h * 0.1)}px)`;
  ctx.beginPath();
  drawSmoothPath(ctx, [...top, ...bottom]);
  ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
  ctx.fill();
  ctx.filter = "none";
  ctx.restore();

  // Main filled shape
  ctx.save();
  ctx.beginPath();
  drawSmoothPath(ctx, [...top, ...bottom]);
  ctx.fillStyle = `rgba(${r},${g},${b},0.80)`;
  ctx.fill();
  ctx.restore();

  // Hair texture layer
  drawHairTexture(ctx, x, y, w, h, spine, r, g, b, flip);
}

function drawSmoothPath(ctx, pts) {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.closePath();
}

function drawHairTexture(ctx, x, y, w, h, spine, r, g, b, flip) {
  const numStrokes = Math.round(w * 2.0);
  ctx.lineCap = "round";

  for (let i = 0; i < numStrokes; i++) {
    const t = (i + Math.random() * 0.6 - 0.3) / numStrokes;
    const ct = Math.max(0, Math.min(1, t));

    // Interpolate spine position
    const si = ct * (spine.length - 1);
    const si0 = Math.min(Math.floor(si), spine.length - 2);
    const f = si - si0;
    const s0 = spine[si0], s1 = spine[si0 + 1];

    const sxNorm = s0.x + (s1.x - s0.x) * f;
    const syNorm = s0.y + (s1.y - s0.y) * f;
    const stNorm = s0.t + (s1.t - s0.t) * f;

    const px = x + (flip ? 1 - sxNorm : sxNorm) * w;
    const py = y + syNorm * h;
    const thick = stNorm * h;

    // Edge fade: thinner at inner/outer corners
    const innerFade = Math.min(ct * 7, 1);
    const outerFade = Math.min((1 - ct) * 9, 1);
    const edgeFade = innerFade * outerFade;
    const opacity = (0.25 + Math.random() * 0.45) * edgeFade;

    // Hair angle: more vertical at inner corner, more diagonal at outer
    const innerT = flip ? 1 - ct : ct;
    const baseAngle = -(Math.PI / 2) + innerT * 0.45;
    const angle = baseAngle + (Math.random() - 0.5) * 0.28;
    const hairLen = thick * (0.65 + Math.random() * 0.65);

    const startX = px + (Math.random() - 0.5) * thick * 0.5;
    const startY = py + thick * 0.45 * (0.3 + Math.random() * 0.5);

    ctx.beginPath();
    ctx.strokeStyle = `rgba(${r},${g},${b},${opacity.toFixed(2)})`;
    ctx.lineWidth = 0.35 + Math.random() * 0.65;
    ctx.moveTo(startX, startY);
    ctx.lineTo(
      startX + Math.cos(angle) * hairLen * 0.25,
      startY + Math.sin(angle) * hairLen,
    );
    ctx.stroke();
  }
}

// ─── i18n ────────────────────────────────────────────────────────────────────
const T = {
  he: {
    title: "ייעוץ גבות חכם",
    subtitle: "העלי תמונה וקבלי המלצה מותאמת אישית",
    langToggle: "English",
    steps: ["העלאה", "ניתוח", "המלצה", "הדמיה"],
    uploadTitle: "בחרי כיצד להוסיף תמונה",
    uploadBtn: "📁 העלאת תמונה מהגלריה",
    cameraBtn: "📷 צלמי סלפי עכשיו",
    uploadHint: "סלפי ברור של הפנים — ככה נקבל את ההמלצה הכי מדויקת",
    captureBtn: "📸 צלמי",
    retakeBtn: "חזרה",
    analyzeBtn: "נתחי את הגבות שלי ✨",
    changeBtn: "החלפה",
    analyzingTitle: "מנתחת את הפנים שלך...",
    analyzingSubtitle: "זה לוקח כמה שניות",
    faceShape: "צורת פנים",
    technique: "טכניקה מומלצת",
    recommendedTitle: "🎨 עיצוב מומלץ:",
    colorLabel: "גוון מומלץ:",
    tipsTitle: "💡 טיפים אישיים:",
    stylesTitle: "בחרי סגנון גבה:",
    colorPickerTitle: "גוון:",
    applyBtn: "✨ הדמיה מיידית!",
    bookBtn: "📅 קבעי ייעוץ חינם עם המומחית",
    applyingTitle: "מחילה את הסגנון...",
    applyingSubtitle: "שנייה אחת ✨",
    before: "לפני",
    after: "אחרי ✨",
    loveIt: "אוהבת את מה שרואה? 😍",
    loveItSub: "הגבות האלה מחכות לך אצלנו",
    bookNow: "📅 אני רוצה לקבוע תור!",
    tryAnother: "נסי עם תמונה אחרת",
    privacy: "התמונה שלך לא נשמרת ומשמשת לניתוח בלבד 🔒",
    bookAlert: "מעולה! נציגה שלנו תחזור אלייך בהקדם 💕",
    consultAlert: "נשלחה בקשה לתיאום ייעוץ! נחזור אלייך בקרוב 💕",
    errorAnalyze: "שגיאה בניתוח התמונה. נסי שנית.",
    errorGenerate: "שגיאה ביצירת ההדמיה. נסי שנית.",
    cameraError: "לא ניתן לגשת למצלמה. בדקי הרשאות.",
  },
  en: {
    title: "Smart Brow Advisor",
    subtitle: "Upload a photo and get a personalized recommendation",
    langToggle: "עברית",
    steps: ["Upload", "Analysis", "Result", "Simulation"],
    uploadTitle: "How would you like to add a photo?",
    uploadBtn: "📁 Upload from Gallery",
    cameraBtn: "📷 Take a Selfie Now",
    uploadHint: "A clear selfie — this gives us the most accurate recommendation",
    captureBtn: "📸 Capture",
    retakeBtn: "Back",
    analyzeBtn: "Analyze My Brows ✨",
    changeBtn: "Change Photo",
    analyzingTitle: "Analyzing your face...",
    analyzingSubtitle: "This takes a few seconds",
    faceShape: "Face Shape",
    technique: "Recommended Technique",
    recommendedTitle: "🎨 Recommended Style:",
    colorLabel: "Recommended Shade:",
    tipsTitle: "💡 Personal Tips:",
    stylesTitle: "Choose a brow style:",
    colorPickerTitle: "Color:",
    applyBtn: "✨ Instant Simulation!",
    bookBtn: "📅 Book a Free Consultation",
    applyingTitle: "Applying style...",
    applyingSubtitle: "One moment ✨",
    before: "Before",
    after: "After ✨",
    loveIt: "Love what you see? 😍",
    loveItSub: "These brows are waiting for you",
    bookNow: "📅 I Want to Book an Appointment!",
    tryAnother: "Try with another photo",
    privacy: "Your photo is not saved and is used for analysis only 🔒",
    bookAlert: "Great! Our specialist will get back to you shortly 💕",
    consultAlert: "Consultation request sent! We'll be in touch soon 💕",
    errorAnalyze: "Error analyzing image. Please try again.",
    errorGenerate: "Error generating simulation. Please try again.",
    cameraError: "Cannot access camera. Please check permissions.",
  },
};

const STEPS = {
  UPLOAD: "upload",
  CAMERA: "camera",
  ANALYZING: "analyzing",
  RECOMMENDATION: "recommendation",
  GENERATING: "generating",
  RESULT: "result",
};

export default function EyebrowAgent() {
  const [lang, setLang] = useState("he");
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(0);
  const [selectedColor, setSelectedColor] = useState(BROW_COLORS[1]);
  const [error, setError] = useState(null);

  const fileRef = useRef();
  const videoRef = useRef();
  const canvasRef = useRef();
  const streamRef = useRef();

  const t = T[lang];
  const dir = lang === "he" ? "rtl" : "ltr";

  useEffect(() => {
    // Preload MediaPipe model in background on mount
    getFaceLandmarker().catch(() => {});
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setStep(STEPS.CAMERA);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch {
      setError(t.cameraError);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setImage(dataUrl);
    resizeImage(dataUrl.split(",")[1]).then(setImageBase64);
    stopCamera();
    setStep(STEPS.UPLOAD);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = (ev) => resizeImage(ev.target.result.split(",")[1]).then(setImageBase64);
    reader.readAsDataURL(file);
  };

  const analyzeWithClaude = async () => {
    if (!imageBase64) return;
    setStep(STEPS.ANALYZING);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, lang }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRecommendation(data);
      setStep(STEPS.RECOMMENDATION);
    } catch (err) {
      console.error("Analyze error:", err);
      setError(err.message || t.errorAnalyze);
      setStep(STEPS.UPLOAD);
    }
  };

  const applyBrowStyle = async (styleIdx = selectedStyle, colorHex = selectedColor.hex) => {
    setStep(STEPS.GENERATING);
    setError(null);
    try {
      // Detect precise brow positions with MediaPipe; fall back to Gemini's browBox
      const browBoxes = await detectBrowBoxes(imageBase64) || recommendation?.browBox;
      const resultDataUrl = await applyEyebrowStyle(imageBase64, browBoxes, styleIdx, colorHex);
      setResultImage(resultDataUrl);
      setStep(STEPS.RESULT);
    } catch (err) {
      console.error("Apply error:", err);
      setError(err.message || t.errorGenerate);
      setStep(STEPS.RECOMMENDATION);
    }
  };

  const reset = () => {
    stopCamera();
    setStep(STEPS.UPLOAD);
    setImage(null);
    setImageBase64(null);
    setRecommendation(null);
    setResultImage(null);
    setSelectedStyle(0);
    setSelectedColor(BROW_COLORS[1]);
    setError(null);
  };

  const progressMap = {
    [STEPS.UPLOAD]: 0, [STEPS.CAMERA]: 0,
    [STEPS.ANALYZING]: 1, [STEPS.RECOMMENDATION]: 2,
    [STEPS.GENERATING]: 3, [STEPS.RESULT]: 3,
  };
  const progressIndex = progressMap[step] ?? 0;

  const btnPrimary = { width: "100%", padding: "15px", background: "linear-gradient(135deg,#e8a0c8,#c060a0)", border: "none", borderRadius: "12px", color: "white", fontSize: "15px", fontWeight: "700", cursor: "pointer", marginBottom: "10px", display: "block" };
  const btnSecondary = { width: "100%", padding: "13px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,100,160,0.25)", borderRadius: "12px", color: "#e8a0c8", fontSize: "14px", fontWeight: "600", cursor: "pointer", marginBottom: "10px", display: "block" };
  const btnGhost = { width: "100%", padding: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", color: "#c4a0b8", fontSize: "13px", cursor: "pointer", display: "block" };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1a0a0f 0%,#2d1020 50%,#1a0a0f 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "'Segoe UI',Arial,sans-serif" }} dir={dir}>
      <div style={{ width: "100%", maxWidth: "500px" }}>

        {/* Lang toggle */}
        <div style={{ display: "flex", justifyContent: dir === "rtl" ? "flex-start" : "flex-end", marginBottom: "12px" }}>
          <button onClick={() => setLang(l => l === "he" ? "en" : "he")}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,100,160,0.3)", borderRadius: "20px", color: "#e8a0c8", fontSize: "13px", padding: "6px 16px", cursor: "pointer" }}>
            {t.langToggle}
          </button>
        </div>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "40px", marginBottom: "8px" }}>✨</div>
          <h1 style={{ color: "#f0d4e8", fontSize: "26px", fontWeight: "700", margin: "0 0 8px" }}>{t.title}</h1>
          <p style={{ color: "#c4a0b8", fontSize: "14px", margin: 0 }}>{t.subtitle}</p>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "4px", marginBottom: "24px" }}>
          {t.steps.map((label, i) => {
            const active = i <= progressIndex;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: active ? "linear-gradient(135deg,#e8a0c8,#c060a0)" : "#3d1a2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: active ? "white" : "#7a5068", fontWeight: "700", transition: "all 0.3s" }}>
                    {active && i < progressIndex ? "✓" : i + 1}
                  </div>
                  <span style={{ fontSize: "10px", color: active ? "#f0d4e8" : "#7a5068", whiteSpace: "nowrap" }}>{label}</span>
                </div>
                {i < t.steps.length - 1 && (
                  <div style={{ width: "24px", height: "2px", background: i < progressIndex ? "#c060a0" : "#3d1a2e", marginBottom: "14px", transition: "all 0.3s", borderRadius: "1px" }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "20px", border: "1px solid rgba(200,100,160,0.2)", padding: "28px", backdropFilter: "blur(10px)" }}>

          {error && (
            <div style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: "10px", padding: "12px", marginBottom: "16px", color: "#ff9090", fontSize: "14px", textAlign: "center" }}>
              {error}
            </div>
          )}

          {/* ── UPLOAD ── */}
          {step === STEPS.UPLOAD && (
            <div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              {!image ? (
                <>
                  <p style={{ color: "#c4a0b8", fontSize: "14px", textAlign: "center", margin: "0 0 20px", fontWeight: "600" }}>{t.uploadTitle}</p>
                  <button onClick={() => fileRef.current.click()} style={btnPrimary}>{t.uploadBtn}</button>
                  <button onClick={startCamera} style={btnSecondary}>{t.cameraBtn}</button>
                  <p style={{ color: "#5a3860", fontSize: "12px", textAlign: "center", margin: "12px 0 0" }}>{t.uploadHint}</p>
                </>
              ) : (
                <>
                  <img src={image} alt="preview" style={{ width: "100%", borderRadius: "12px", maxHeight: "300px", objectFit: "cover", marginBottom: "16px" }} />
                  <button onClick={analyzeWithClaude} style={btnPrimary}>{t.analyzeBtn}</button>
                  <button onClick={reset} style={btnGhost}>{t.changeBtn}</button>
                </>
              )}
            </div>
          )}

          {/* ── CAMERA ── */}
          {step === STEPS.CAMERA && (
            <div style={{ textAlign: "center" }}>
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <div style={{ position: "relative", marginBottom: "16px" }}>
                <video ref={videoRef} autoPlay playsInline muted
                  style={{ width: "100%", borderRadius: "12px", maxHeight: "320px", objectFit: "cover", transform: "scaleX(-1)" }} />
                <div style={{ position: "absolute", inset: 0, border: "3px solid rgba(200,100,160,0.5)", borderRadius: "12px", pointerEvents: "none" }} />
              </div>
              <button onClick={capturePhoto} style={btnPrimary}>{t.captureBtn}</button>
              <button onClick={() => { stopCamera(); setStep(STEPS.UPLOAD); }} style={btnGhost}>{t.retakeBtn}</button>
            </div>
          )}

          {/* ── ANALYZING ── */}
          {step === STEPS.ANALYZING && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
              <div style={{ fontSize: "52px", marginBottom: "20px", animation: "spin 2s linear infinite", display: "inline-block" }}>🔍</div>
              <p style={{ color: "#f0d4e8", fontSize: "18px", fontWeight: "700", margin: "0 0 8px" }}>{t.analyzingTitle}</p>
              <p style={{ color: "#9a7088", fontSize: "14px", margin: 0, animation: "pulse 1.5s ease-in-out infinite" }}>{t.analyzingSubtitle}</p>
            </div>
          )}

          {/* ── RECOMMENDATION ── */}
          {step === STEPS.RECOMMENDATION && recommendation && (
            <div>
              {/* Face info chip */}
              <div style={{ background: "rgba(200,100,160,0.08)", borderRadius: "12px", padding: "14px 16px", marginBottom: "20px", border: "1px solid rgba(200,100,160,0.15)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ color: "#9a7088", fontSize: "12px" }}>{t.faceShape}</span>
                  <span style={{ color: "#f0d4e8", fontWeight: "700", fontSize: "15px" }}>
                    {lang === "he" ? recommendation.faceShapeHebrew : recommendation.faceShapeEnglish} ✨
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#9a7088", fontSize: "12px" }}>{t.technique}</span>
                  <span style={{ color: "#e8a0c8", fontWeight: "600", fontSize: "13px" }}>
                    {lang === "he" ? recommendation.technique_he : recommendation.technique_en}
                  </span>
                </div>
              </div>

              {/* Style desc */}
              <h3 style={{ color: "#f0d4e8", fontSize: "16px", margin: "0 0 10px", fontWeight: "700" }}>
                {t.recommendedTitle} {recommendation.recommendedStyle}
              </h3>
              <p style={{ color: "#c4a0b8", fontSize: "14px", lineHeight: "1.7", margin: "0 0 14px" }}>
                {lang === "he" ? recommendation.recommendedStyleDesc_he : recommendation.recommendedStyleDesc_en}
              </p>

              {/* Tips */}
              <h3 style={{ color: "#f0d4e8", fontSize: "13px", margin: "0 0 10px", fontWeight: "600" }}>{t.tipsTitle}</h3>
              <div style={{ marginBottom: "24px" }}>
                {(lang === "he" ? recommendation.tips_he : recommendation.tips_en)?.map((tip, i) => (
                  <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <span style={{ color: "#c060a0", flexShrink: 0 }}>•</span>
                    <span style={{ color: "#c4a0b8", fontSize: "14px", lineHeight: "1.5" }}>{tip}</span>
                  </div>
                ))}
              </div>

              {/* Style picker */}
              <h3 style={{ color: "#f0d4e8", fontSize: "14px", margin: "0 0 12px", fontWeight: "700" }}>{t.stylesTitle}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "16px" }}>
                {BROW_STYLES.map((style, i) => (
                  <button key={style.id} onClick={() => setSelectedStyle(i)}
                    style={{
                      padding: "10px 6px", borderRadius: "10px", cursor: "pointer", fontSize: "12px", fontWeight: "600",
                      background: selectedStyle === i ? "rgba(200,100,160,0.25)" : "rgba(255,255,255,0.04)",
                      border: selectedStyle === i ? "1.5px solid #c060a0" : "1px solid rgba(200,100,160,0.15)",
                      color: selectedStyle === i ? "#f0d4e8" : "#9a7088",
                      transition: "all 0.2s",
                    }}>
                    {lang === "he" ? style.name_he : style.name_en}
                  </button>
                ))}
              </div>

              {/* Color picker */}
              <h3 style={{ color: "#f0d4e8", fontSize: "14px", margin: "0 0 10px", fontWeight: "700" }}>{t.colorPickerTitle}</h3>
              <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
                {BROW_COLORS.map((color) => (
                  <button key={color.hex} onClick={() => setSelectedColor(color)}
                    title={lang === "he" ? color.label_he : color.label_en}
                    style={{
                      width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer",
                      background: color.hex,
                      border: selectedColor.hex === color.hex ? "3px solid #e8a0c8" : "2px solid rgba(255,255,255,0.15)",
                      transition: "all 0.2s",
                    }} />
                ))}
              </div>

              <button onClick={applyBrowStyle} style={btnPrimary}>{t.applyBtn}</button>
              <button onClick={() => alert(t.consultAlert)} style={btnSecondary}>{t.bookBtn}</button>
            </div>
          )}

          {/* ── GENERATING (applying) ── */}
          {step === STEPS.GENERATING && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: "52px", marginBottom: "20px" }}>🪄</div>
              <p style={{ color: "#f0d4e8", fontSize: "18px", fontWeight: "700", margin: "0 0 8px" }}>{t.applyingTitle}</p>
              <p style={{ color: "#9a7088", fontSize: "14px", margin: "0 0 28px", animation: "pulse 1.5s ease-in-out infinite" }}>{t.applyingSubtitle}</p>
              <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#c060a0", animation: `pulse 1.2s ease-in-out ${i * 0.25}s infinite` }} />
                ))}
              </div>
            </div>
          )}

          {/* ── RESULT ── */}
          {step === STEPS.RESULT && resultImage && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div>
                  <p style={{ color: "#9a7088", fontSize: "12px", textAlign: "center", margin: "0 0 8px" }}>{t.before}</p>
                  <img src={image} style={{ width: "100%", borderRadius: "10px", aspectRatio: "1", objectFit: "cover" }} />
                </div>
                <div>
                  <p style={{ color: "#e8a0c8", fontSize: "12px", textAlign: "center", margin: "0 0 8px", fontWeight: "700" }}>{t.after}</p>
                  <img src={resultImage} style={{ width: "100%", borderRadius: "10px", aspectRatio: "1", objectFit: "cover", border: "2px solid rgba(200,100,160,0.5)" }} />
                </div>
              </div>

              {/* Style switcher in result */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "6px", marginBottom: "12px" }}>
                {BROW_STYLES.map((style, i) => (
                  <button key={style.id}
                    onClick={() => { setSelectedStyle(i); applyBrowStyle(i, selectedColor.hex); }}
                    style={{
                      padding: "8px 4px", borderRadius: "8px", cursor: "pointer", fontSize: "11px", fontWeight: "600",
                      background: selectedStyle === i ? "rgba(200,100,160,0.25)" : "rgba(255,255,255,0.04)",
                      border: selectedStyle === i ? "1.5px solid #c060a0" : "1px solid rgba(200,100,160,0.12)",
                      color: selectedStyle === i ? "#f0d4e8" : "#7a5068",
                    }}>
                    {lang === "he" ? style.name_he : style.name_en}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "20px", justifyContent: "center" }}>
                {BROW_COLORS.map((color) => (
                  <button key={color.hex}
                    onClick={() => { setSelectedColor(color); applyBrowStyle(selectedStyle, color.hex); }}
                    style={{
                      width: "28px", height: "28px", borderRadius: "50%", cursor: "pointer",
                      background: color.hex,
                      border: selectedColor.hex === color.hex ? "3px solid #e8a0c8" : "2px solid rgba(255,255,255,0.15)",
                    }} />
                ))}
              </div>

              <div style={{ background: "linear-gradient(135deg,rgba(200,100,160,0.1),rgba(200,100,160,0.05))", borderRadius: "12px", padding: "16px", marginBottom: "20px", textAlign: "center", border: "1px solid rgba(200,100,160,0.15)" }}>
                <p style={{ color: "#f0d4e8", fontSize: "16px", fontWeight: "700", margin: "0 0 4px" }}>{t.loveIt}</p>
                <p style={{ color: "#9a7088", fontSize: "13px", margin: 0 }}>{t.loveItSub}</p>
              </div>

              <button onClick={() => alert(t.bookAlert)} style={btnPrimary}>{t.bookNow}</button>
              <button onClick={reset} style={btnGhost}>{t.tryAnother}</button>
            </div>
          )}

        </div>

        <p style={{ textAlign: "center", color: "#5a3850", fontSize: "12px", marginTop: "16px" }}>{t.privacy}</p>
      </div>
    </div>
  );
}
