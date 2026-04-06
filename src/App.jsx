import { useState, useRef, useEffect } from "react";

// ─── Canvas eyebrow drawing ──────────────────────────────────────────────────

function sampleBrowColor(ctx, W, H) {
  // Sample skin just below the brow zone (~37% height, center strip)
  const sx = Math.round(W * 0.42);
  const sy = Math.round(H * 0.375);
  const sw = Math.round(W * 0.16);
  const data = ctx.getImageData(sx, sy, sw, 1).data;
  let r = 0, g = 0, b = 0;
  const n = sw;
  for (let i = 0; i < n; i++) { r += data[i * 4]; g += data[i * 4 + 1]; b += data[i * 4 + 2]; }
  r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
  // Darken to brow tone (multiply down toward dark brown)
  return {
    r: Math.round(r * 0.38),
    g: Math.round(g * 0.27),
    b: Math.round(b * 0.22),
  };
}

function drawBrow(ctx, x1, x2, centerY, thickness, archFactor, color) {
  const bw = x2 - x1;
  const peakX = x1 + bw * 0.62;
  const peakY = centerY - thickness * archFactor;
  const { r, g, b } = color;

  const makePath = () => {
    ctx.beginPath();
    // Top edge: head → arch peak → tail
    ctx.moveTo(x1, centerY - thickness * 0.5);
    ctx.bezierCurveTo(
      x1 + bw * 0.28, centerY - thickness * archFactor * 0.75,
      peakX - bw * 0.06, peakY,
      x2, centerY - thickness * 0.2
    );
    // Bottom edge: tail → back to head
    ctx.bezierCurveTo(
      peakX + bw * 0.04, peakY + thickness * 1.4,
      x1 + bw * 0.26, centerY + thickness * 0.55,
      x1, centerY + thickness * 0.5
    );
    ctx.closePath();
  };

  // Clip strictly to the brow bounding box
  const pad = thickness * 1.2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x1 - pad, centerY - thickness * 3 - pad, bw + pad * 2, thickness * 4 + pad * 2);
  ctx.clip();

  // Layer 1: outer soft glow
  ctx.filter = `blur(${Math.round(thickness * 1.1)}px)`;
  ctx.fillStyle = `rgba(${r},${g},${b},0.45)`;
  makePath(); ctx.fill();

  // Layer 2: main body
  ctx.filter = `blur(${Math.round(thickness * 0.38)}px)`;
  ctx.fillStyle = `rgba(${r},${g},${b},0.82)`;
  makePath(); ctx.fill();

  // Layer 3: crisp center (no blur)
  ctx.filter = "none";
  ctx.fillStyle = `rgba(${r},${g},${b},0.48)`;
  makePath(); ctx.fill();

  ctx.restore();
}

function getArchFactor(recommendation) {
  const style = (recommendation?.recommendedStyle || "").toLowerCase();
  if (style.includes("high") || style.includes("ארוך") || style.includes("קשת")) return 2.4;
  if (style.includes("straight") || style.includes("ישר")) return 0.5;
  if (style.includes("soft") || style.includes("רך") || style.includes("natural") || style.includes("טבעי")) return 1.4;
  if (style.includes("bold") || style.includes("עבה") || style.includes("thick")) return 1.7;
  return 1.6;
}

function applyEyebrowStyle(imageBase64, recommendation) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const W = canvas.width;
      const H = canvas.height;

      const color = sampleBrowColor(ctx, W, H);
      const archFactor = getArchFactor(recommendation);

      // Brows at 34% height (calibrated to face guide oval)
      const browCenterY = H * 0.34;
      const browThickness = H * 0.027;

      // Left brow: 13%–37% width, Right brow: 63%–87%
      drawBrow(ctx, W * 0.13, W * 0.37, browCenterY, browThickness, archFactor, color);
      drawBrow(ctx, W * 0.63, W * 0.87, browCenterY, browThickness, archFactor, color);

      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = `data:image/jpeg;base64,${imageBase64}`;
  });
}

// Fixed oval mask covering the eye+brow area (calibrated to face guide oval)
function createEyeMask(imageBase64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width * 0.5;
      const cy = canvas.height * 0.34;
      const rx = canvas.width * 0.44;
      const ry = canvas.height * 0.095;
      ctx.filter = `blur(${Math.round(canvas.height * 0.022)}px)`;
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.filter = "none";
      resolve(canvas.toDataURL("image/png").split(",")[1]);
    };
    img.src = `data:image/jpeg;base64,${imageBase64}`;
  });
}

function resizeImage(base64, maxSize = 1024, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
    };
    img.src = `data:image/jpeg;base64,${base64}`;
  });
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
    positionHint: "כוונני את הפנים שלך בתוך המסגרת",
    positionDrag: "גרירה להזזה  •  צביטה לזום",
    confirmBtn: "✓ אשרי ונתחי",
    analyzeBtn: "נתחי את הגבות שלי ✨",
    changeBtn: "החלפה",
    analyzingTitle: "מנתחת את הפנים שלך...",
    analyzingSubtitle: "זה לוקח כמה שניות",
    faceShape: "צורת פנים",
    technique: "טכניקה מומלצת",
    recommendedTitle: "🎨 עיצוב מומלץ:",
    colorLabel: "גוון מומלץ:",
    tipsTitle: "💡 טיפים אישיים:",
    generateBtn: "🪄 צרי לי הדמיה!",
    bookBtn: "📅 קבעי ייעוץ חינם עם המומחית",
    generatingTitle: "יוצרת את ההדמיה...",
    generatingSubtitle: "מכינה לך את הגבות המושלמות ✨",
    before: "לפני",
    after: "אחרי ✨",
    loveIt: "אוהבת את מה שרואה? 😍",
    loveItSub: "הגבות האלה מחכות לך אצלנו",
    bookNow: "📅 אני רוצה לקבוע תור!",
    tryAnother: "נסי עם תמונה אחרת",
    privacy: "התמונה שלך לא נשמרת ומשמשת לניתוח בלבד 🔒",
    bookAlert: "מעולה! נציגה שלנו תחזור אלייך בהקדם 💕",
    consultAlert: "נשלחה בקשה לתיאום ייעוץ! נחזור אלייך בקרוב 💕",
    leadTitle: "כמעט שם! 🎉",
    leadSubtitle: "השאירי פרטים וניצור איתך קשר לקביעת תור",
    leadName: "שם מלא",
    leadPhone: "טלפון",
    leadBtn: "🪄 צרי לי הדמיה!",
    leadSkip: "דלגי",
    shareBtn: "📤 שתפי את התוצאה",
    closeLightbox: "✕",
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
    positionHint: "Position your face inside the frame",
    positionDrag: "Drag to move  •  Pinch to zoom",
    confirmBtn: "✓ Confirm & Analyze",
    analyzeBtn: "Analyze My Brows ✨",
    changeBtn: "Change Photo",
    analyzingTitle: "Analyzing your face...",
    analyzingSubtitle: "This takes a few seconds",
    faceShape: "Face Shape",
    technique: "Recommended Technique",
    recommendedTitle: "🎨 Recommended Style:",
    colorLabel: "Recommended Shade:",
    tipsTitle: "💡 Personal Tips:",
    generateBtn: "🪄 Generate My Simulation!",
    bookBtn: "📅 Book a Free Consultation",
    generatingTitle: "Creating your simulation...",
    generatingSubtitle: "Creating your perfect brows ✨",
    before: "Before",
    after: "After ✨",
    loveIt: "Love what you see? 😍",
    loveItSub: "These brows are waiting for you",
    bookNow: "📅 I Want to Book an Appointment!",
    tryAnother: "Try with another photo",
    privacy: "Your photo is not saved and is used for analysis only 🔒",
    bookAlert: "Great! Our specialist will get back to you shortly 💕",
    consultAlert: "Consultation request sent! We'll be in touch soon 💕",
    leadTitle: "Almost there! 🎉",
    leadSubtitle: "Leave your details and we'll reach out to book a session",
    leadName: "Full name",
    leadPhone: "Phone",
    leadBtn: "🪄 Generate My Simulation!",
    leadSkip: "Skip",
    shareBtn: "📤 Share Result",
    closeLightbox: "✕",
    errorAnalyze: "Error analyzing image. Please try again.",
    errorGenerate: "Error generating simulation. Please try again.",
    cameraError: "Cannot access camera. Please check permissions.",
  },
};

const STEPS = {
  UPLOAD: "upload",
  CAMERA: "camera",
  POSITIONING: "positioning",
  ANALYZING: "analyzing",
  RECOMMENDATION: "recommendation",
  LEAD: "lead",
  GENERATING: "generating",
  RESULT: "result",
};

const WHATSAPP_BIZ = "972504764371";

// Oval face guide SVG overlay (viewBox 100×133 = 3:4 ratio)
// Oval top at ~13.5% → eyebrows land at ~34% of captured image = matches mask
function FaceOvalGuide() {
  return (
    <svg
      viewBox="0 0 100 133"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <mask id="ovalCutout">
          <rect width="100" height="133" fill="white" />
          <ellipse cx="50" cy="68" rx="43" ry="50" fill="black" />
        </mask>
      </defs>
      <rect width="100" height="133" fill="rgba(0,0,0,0.48)" mask="url(#ovalCutout)" />
      <ellipse cx="50" cy="68" rx="43" ry="50"
        fill="none" stroke="#e8a0c8" strokeWidth="0.7" strokeDasharray="4,2" />
    </svg>
  );
}

export default function EyebrowAgent() {
  const [lang, setLang] = useState("he");
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [image, setImage] = useState(null);          // display URL
  const [imageBase64, setImageBase64] = useState(null); // resized base64 for API
  const [rawBase64, setRawBase64] = useState(null);   // original for positioning
  const [recommendation, setRecommendation] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [error, setError] = useState(null);
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [flashVisible, setFlashVisible] = useState(false);

  // Positioning state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const posContainerRef = useRef();
  const posImgRef = useRef();
  const touchState = useRef({});

  const fileRef = useRef();
  const videoRef = useRef();
  const canvasRef = useRef();
  const streamRef = useRef();

  const t = T[lang];
  const dir = lang === "he" ? "rtl" : "ltr";

  useEffect(() => () => stopCamera(), []);

  // Attach wheel + touch with passive:false so preventDefault works
  useEffect(() => {
    const el = posContainerRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  });

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
  };

  // ── Upload handlers ──────────────────────────────────────────────────────
  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setStep(STEPS.CAMERA);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch { setError(t.cameraError); }
  };

  const capturePhoto = () => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas) return;
    // Screen flash
    setFlashVisible(true);
    setTimeout(() => setFlashVisible(false), 280);
    const w = video.videoWidth, h = video.videoHeight;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    // Un-flip: front camera is mirrored in CSS but raw frame isn't — flip canvas so result matches preview
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setImage(dataUrl);
    const b64 = dataUrl.split(",")[1];
    setRawBase64(b64);
    stopCamera();
    setTransform({ x: 0, y: 0, scale: 1 });
    setStep(STEPS.POSITIONING);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result.split(",")[1];
      setRawBase64(b64);
      setTransform({ x: 0, y: 0, scale: 1 });
      setStep(STEPS.POSITIONING);
    };
    reader.readAsDataURL(file);
  };

  // ── Positioning handlers ─────────────────────────────────────────────────
  const initPositionScale = () => {
    const container = posContainerRef.current;
    const img = posImgRef.current;
    if (!container || !img) return;
    const cw = container.offsetWidth;
    const ch = container.offsetHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(cw / iw, ch / ih);
    setTransform({ x: 0, y: 0, scale });
  };

  const onTouchStart = (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchState.current = {
        type: "pinch",
        startDist: Math.sqrt(dx * dx + dy * dy),
        startScale: transform.scale,
        startX: transform.x,
        startY: transform.y,
      };
    } else {
      touchState.current = {
        type: "drag",
        startTX: e.touches[0].clientX,
        startTY: e.touches[0].clientY,
        startX: transform.x,
        startY: transform.y,
      };
    }
  };

  const onTouchMove = (e) => {
    e.preventDefault();
    const s = touchState.current;
    if (s.type === "pinch" && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = Math.max(0.3, Math.min(5, s.startScale * dist / s.startDist));
      setTransform(t => ({ ...t, scale }));
    } else if (s.type === "drag" && e.touches.length === 1) {
      setTransform(t => ({
        ...t,
        x: s.startX + e.touches[0].clientX - s.startTX,
        y: s.startY + e.touches[0].clientY - s.startTY,
      }));
    }
  };

  const onMouseDown = (e) => {
    const start = { x: transform.x, y: transform.y, mx: e.clientX, my: e.clientY };
    const onMove = (ev) => setTransform(t => ({
      ...t, x: start.x + ev.clientX - start.mx, y: start.y + ev.clientY - start.my,
    }));
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const onWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setTransform(t => ({ ...t, scale: Math.max(0.3, Math.min(5, t.scale * factor)) }));
  };

  const confirmPosition = async () => {
    const container = posContainerRef.current;
    const img = posImgRef.current;
    if (!container || !img) return;
    const cw = container.offsetWidth;
    const ch = container.offsetHeight;
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#888";
    ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(cw / 2 + transform.x, ch / 2 + transform.y);
    ctx.scale(transform.scale, transform.scale);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
    const b64 = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
    const resized = await resizeImage(b64, 1024, 0.85);
    setImageBase64(resized);
    // Update the display image to show the positioned version
    setImage(canvas.toDataURL("image/jpeg", 0.9));
    analyzeWithGemini(resized);
  };

  // ── Analysis ─────────────────────────────────────────────────────────────
  const analyzeWithGemini = async (base64 = imageBase64) => {
    setStep(STEPS.ANALYZING); setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, lang }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRecommendation(data);
      setStep(STEPS.RECOMMENDATION);
    } catch (err) {
      setError(err.message || t.errorAnalyze);
      setStep(STEPS.POSITIONING);
    }
  };

  // ── Generation ───────────────────────────────────────────────────────────
  const generateWithCanvas = async () => {
    setStep(STEPS.GENERATING); setError(null);
    try {
      const resultDataUrl = await applyEyebrowStyle(imageBase64, recommendation);
      setResultImage(resultDataUrl);
      setStep(STEPS.RESULT);
    } catch (err) {
      setError(err.message || t.errorGenerate);
      setStep(STEPS.RECOMMENDATION);
    }
  };

  const submitLead = async () => {
    const name = leadName.trim();
    const phone = leadPhone.trim();
    if (!name || !phone) {
      setError(lang === "he" ? "נא למלא שם וטלפון להמשך" : "Please fill in your name and phone to continue");
      return;
    }
    setError(null);
    fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        style: recommendation?.recommendedStyle || "",
        faceShape: lang === "he" ? recommendation?.faceShapeHebrew : recommendation?.faceShapeEnglish,
      }),
    }).catch(() => {});
    generateWithGemini();
  };

  const shareResult = async () => {
    try {
      // Build composite canvas: before | after + text
      const buildCanvas = () => new Promise((resolve) => {
        const beforeImg = new Image(); const afterImg = new Image();
        beforeImg.crossOrigin = "anonymous"; afterImg.crossOrigin = "anonymous";
        let loaded = 0;
        const onLoad = () => { if (++loaded < 2) return;
          const W = 800, H = 480, pad = 16;
          const c = document.createElement("canvas"); c.width = W; c.height = H;
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#1a0a0f"; ctx.fillRect(0, 0, W, H);
          ctx.drawImage(beforeImg, pad, pad, W/2 - pad*1.5, H - pad*2);
          ctx.drawImage(afterImg, W/2 + pad*0.5, pad, W/2 - pad*1.5, H - pad*2);
          ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = "bold 18px sans-serif";
          ctx.fillText("לפני", pad + 8, H - pad - 8);
          ctx.fillStyle = "#e8a0c8";
          ctx.fillText("אחרי ✨", W/2 + pad*0.5 + 8, H - pad - 8);
          resolve(c);
        };
        beforeImg.onload = onLoad; afterImg.onload = onLoad;
        beforeImg.src = image; afterImg.src = resultImage;
      });
      const canvas = await buildCanvas();
      canvas.toBlob(async (blob) => {
        const file = new File([blob], "eyebrows-result.jpg", { type: "image/jpeg" });
        const desc = lang === "he"
          ? `${recommendation?.recommendedStyle || ""} — ${(recommendation?.tips_he || [])[0] || ""}`
          : `${recommendation?.recommendedStyle || ""} — ${(recommendation?.tips_en || [])[0] || ""}`;
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: t.title, text: desc });
        } else {
          // Fallback: download
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "eyebrows-result.jpg";
          a.click();
        }
      }, "image/jpeg", 0.92);
    } catch (e) { /* user cancelled */ }
  };

  const generateWithGemini = async () => {
    setStep(STEPS.GENERATING); setError(null);
    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          prompt: recommendation.imagePrompt || recommendation.recommendedStyle,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResultImage(`data:${data.mimeType};base64,${data.imageBase64}`);
      setStep(STEPS.RESULT);
    } catch (err) {
      setError(err.message || t.errorGenerate);
      setStep(STEPS.RECOMMENDATION);
    }
  };

  const generateWithFal = async () => {
    setStep(STEPS.GENERATING); setError(null);
    try {
      const maskBase64 = await createEyeMask(imageBase64);
      const submitRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, maskBase64, prompt: recommendation.imagePrompt }),
      });
      const submitData = await submitRes.json();
      if (submitData.error) throw new Error(submitData.error);
      const { status_url, response_url } = submitData;
      const pollParams = new URLSearchParams({ status_url, response_url });
      for (let i = 0; i < 100; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const pollRes = await fetch(`/api/poll?${pollParams}`);
        const pd = await pollRes.json();
        if (pd.error) throw new Error(pd.error);
        if (pd.status === "COMPLETED") {
          if (pd.imageUrl) { setResultImage(pd.imageUrl); setStep(STEPS.RESULT); return; }
          throw new Error("Completed but no imageUrl");
        }
      }
      throw new Error("Generation timed out");
    } catch (err) {
      setError(err.message || t.errorGenerate);
      setStep(STEPS.RECOMMENDATION);
    }
  };

  const reset = () => {
    stopCamera(); setStep(STEPS.UPLOAD);
    setImage(null); setImageBase64(null); setRawBase64(null);
    setRecommendation(null); setResultImage(null); setError(null);
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  const progressMap = {
    [STEPS.UPLOAD]: 0, [STEPS.CAMERA]: 0, [STEPS.POSITIONING]: 0,
    [STEPS.ANALYZING]: 1, [STEPS.RECOMMENDATION]: 2,
    [STEPS.LEAD]: 3, [STEPS.GENERATING]: 3, [STEPS.RESULT]: 3,
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
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: active ? "linear-gradient(135deg,#e8a0c8,#c060a0)" : "#3d1a2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: active ? "white" : "#7a5068", fontWeight: "700" }}>
                    {active && i < progressIndex ? "✓" : i + 1}
                  </div>
                  <span style={{ fontSize: "10px", color: active ? "#f0d4e8" : "#7a5068", whiteSpace: "nowrap" }}>{label}</span>
                </div>
                {i < t.steps.length - 1 && (
                  <div style={{ width: "24px", height: "2px", background: i < progressIndex ? "#c060a0" : "#3d1a2e", marginBottom: "14px", borderRadius: "1px" }} />
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
              <p style={{ color: "#c4a0b8", fontSize: "14px", textAlign: "center", margin: "0 0 20px", fontWeight: "600" }}>{t.uploadTitle}</p>
              <button onClick={() => fileRef.current.click()} style={btnPrimary}>{t.uploadBtn}</button>
              <button onClick={startCamera} style={btnSecondary}>{t.cameraBtn}</button>
              <p style={{ color: "#5a3860", fontSize: "12px", textAlign: "center", margin: "12px 0 0" }}>{t.uploadHint}</p>
            </div>
          )}

          {/* ── CAMERA ── */}
          {step === STEPS.CAMERA && (
            <div style={{ textAlign: "center" }}>
              {flashVisible && <div style={{ position: "fixed", inset: 0, background: "white", zIndex: 9999, pointerEvents: "none", opacity: 0.95 }} />}
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <div style={{ position: "relative", marginBottom: "16px" }}>
                <video ref={videoRef} autoPlay playsInline muted
                  style={{ width: "100%", borderRadius: "12px", maxHeight: "380px", objectFit: "cover", transform: "scaleX(-1)", display: "block" }} />
                {/* Oval guide on camera */}
                <div style={{ position: "absolute", inset: 0 }}>
                  <FaceOvalGuide />
                </div>
              </div>
              <p style={{ color: "#9a7088", fontSize: "12px", margin: "0 0 14px" }}>{t.positionHint}</p>
              <button onClick={capturePhoto} style={btnPrimary}>{t.captureBtn}</button>
              <button onClick={() => { stopCamera(); setStep(STEPS.UPLOAD); }} style={btnGhost}>{t.retakeBtn}</button>
            </div>
          )}

          {/* ── POSITIONING ── */}
          {step === STEPS.POSITIONING && rawBase64 && (
            <div>
              <p style={{ color: "#f0d4e8", fontSize: "14px", textAlign: "center", margin: "0 0 6px", fontWeight: "600" }}>{t.positionHint}</p>
              <p style={{ color: "#7a5068", fontSize: "12px", textAlign: "center", margin: "0 0 12px" }}>{t.positionDrag}</p>

              {/* Draggable image container with oval overlay */}
              <div
                ref={posContainerRef}
                style={{
                  position: "relative",
                  width: "100%",
                  paddingBottom: "133%",
                  overflow: "hidden",
                  borderRadius: "14px",
                  cursor: "grab",
                  touchAction: "none",
                  marginBottom: "16px",
                  background: "#111",
                  userSelect: "none",
                }}
                onMouseDown={onMouseDown}
              >
                <div style={{ position: "absolute", inset: 0 }}>
                  <img
                    ref={posImgRef}
                    src={`data:image/jpeg;base64,${rawBase64}`}
                    onLoad={initPositionScale}
                    draggable={false}
                    style={{
                      position: "absolute",
                      left: "50%", top: "50%",
                      transform: `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px)) scale(${transform.scale})`,
                      transformOrigin: "center center",
                      maxWidth: "none",
                      pointerEvents: "none",
                    }}
                  />
                  <FaceOvalGuide />
                </div>
              </div>

              <button onClick={confirmPosition} style={btnPrimary}>{t.confirmBtn}</button>
              <button onClick={reset} style={btnGhost}>{t.changeBtn}</button>
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

              <h3 style={{ color: "#f0d4e8", fontSize: "16px", margin: "0 0 10px", fontWeight: "700" }}>
                {t.recommendedTitle} {recommendation.recommendedStyle}
              </h3>
              <p style={{ color: "#c4a0b8", fontSize: "14px", lineHeight: "1.7", margin: "0 0 14px" }}>
                {lang === "he" ? recommendation.recommendedStyleDesc_he : recommendation.recommendedStyleDesc_en}
              </p>

              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "12px", marginBottom: "18px" }}>
                <p style={{ color: "#9a7088", fontSize: "11px", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t.colorLabel}</p>
                <p style={{ color: "#e8a0c8", fontSize: "14px", margin: 0, fontWeight: "600" }}>
                  {lang === "he" ? recommendation.colorRecommendation_he : recommendation.colorRecommendation_en}
                </p>
              </div>

              <h3 style={{ color: "#f0d4e8", fontSize: "13px", margin: "0 0 10px", fontWeight: "600" }}>{t.tipsTitle}</h3>
              <div style={{ marginBottom: "22px" }}>
                {(lang === "he" ? recommendation.tips_he : recommendation.tips_en)?.map((tip, i) => (
                  <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <span style={{ color: "#c060a0", flexShrink: 0 }}>•</span>
                    <span style={{ color: "#c4a0b8", fontSize: "14px", lineHeight: "1.5" }}>{tip}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => setStep(STEPS.LEAD)} style={btnPrimary}>{t.generateBtn}</button>
              <button onClick={() => alert(t.consultAlert)} style={btnSecondary}>{t.bookBtn}</button>
            </div>
          )}

          {/* ── LEAD ── */}
          {step === STEPS.LEAD && (
            <div>
              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <div style={{ fontSize: "42px", marginBottom: "10px" }}>💌</div>
                <p style={{ color: "#f0d4e8", fontSize: "18px", fontWeight: "700", margin: "0 0 6px" }}>{t.leadTitle}</p>
                <p style={{ color: "#9a7088", fontSize: "13px", margin: 0 }}>{t.leadSubtitle}</p>
              </div>
              <div style={{ marginBottom: "14px" }}>
                <input
                  type="text"
                  placeholder={t.leadName}
                  value={leadName}
                  onChange={e => setLeadName(e.target.value)}
                  style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(200,100,160,0.3)", borderRadius: "12px", color: "#f0d4e8", fontSize: "15px", outline: "none", boxSizing: "border-box", marginBottom: "10px", direction: "rtl" }}
                />
                <input
                  type="tel"
                  placeholder={t.leadPhone}
                  value={leadPhone}
                  onChange={e => setLeadPhone(e.target.value)}
                  style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(200,100,160,0.3)", borderRadius: "12px", color: "#f0d4e8", fontSize: "15px", outline: "none", boxSizing: "border-box", direction: "ltr" }}
                />
              </div>
              <button onClick={submitLead} style={btnPrimary}>{t.leadBtn}</button>
            </div>
          )}

          {/* ── GENERATING ── */}
          {step === STEPS.GENERATING && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: "52px", marginBottom: "20px" }}>🪄</div>
              <p style={{ color: "#f0d4e8", fontSize: "18px", fontWeight: "700", margin: "0 0 8px" }}>{t.generatingTitle}</p>
              <p style={{ color: "#9a7088", fontSize: "14px", margin: "0 0 28px", animation: "pulse 1.5s ease-in-out infinite" }}>{t.generatingSubtitle}</p>
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
                  <img src={image} onClick={() => setLightboxSrc(image)}
                    style={{ width: "100%", borderRadius: "10px", aspectRatio: "1", objectFit: "cover", cursor: "zoom-in" }} />
                </div>
                <div>
                  <p style={{ color: "#e8a0c8", fontSize: "12px", textAlign: "center", margin: "0 0 8px", fontWeight: "700" }}>{t.after}</p>
                  <img src={resultImage} onClick={() => setLightboxSrc(resultImage)}
                    style={{ width: "100%", borderRadius: "10px", aspectRatio: "1", objectFit: "cover", border: "2px solid rgba(200,100,160,0.5)", cursor: "zoom-in" }} />
                </div>
              </div>

              <div style={{ background: "linear-gradient(135deg,rgba(200,100,160,0.1),rgba(200,100,160,0.05))", borderRadius: "12px", padding: "16px", marginBottom: "20px", textAlign: "center", border: "1px solid rgba(200,100,160,0.15)" }}>
                <p style={{ color: "#f0d4e8", fontSize: "16px", fontWeight: "700", margin: "0 0 4px" }}>{t.loveIt}</p>
                <p style={{ color: "#9a7088", fontSize: "13px", margin: 0 }}>{t.loveItSub}</p>
              </div>

              <button onClick={() => alert(t.bookAlert)} style={btnPrimary}>{t.bookNow}</button>
              <button onClick={shareResult} style={btnSecondary}>{t.shareBtn}</button>
              <button onClick={reset} style={btnGhost}>{t.tryAnother}</button>
            </div>
          )}

        </div>
        <p style={{ textAlign: "center", color: "#5a3850", fontSize: "12px", marginTop: "16px" }}>{t.privacy}</p>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div onClick={() => setLightboxSrc(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <button onClick={() => setLightboxSrc(null)}
            style={{ position: "absolute", top: "16px", right: "16px", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", color: "white", fontSize: "20px", width: "40px", height: "40px", cursor: "pointer" }}>
            {t.closeLightbox}
          </button>
          <img src={lightboxSrc} style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: "12px", objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}
