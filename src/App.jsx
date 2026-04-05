import { useState, useRef, useEffect } from "react";

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
    apiLabel: "הכניסי את מפתח fal.ai שלך:",
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
    errorAnalyze: "שגיאה בניתוח התמונה. נסי שנית.",
    errorGenerate: "שגיאה ביצירת ההדמיה. בדקי את מפתח ה-API.",
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
    apiLabel: "Enter your fal.ai API key:",
    generateBtn: "🪄 Generate My Simulation!",
    bookBtn: "📅 Book a Free Consultation",
    generatingTitle: "Generating your simulation...",
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
    errorAnalyze: "Error analyzing image. Please try again.",
    errorGenerate: "Error generating simulation. Check your API key.",
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
  const [falApiKey, setFalApiKey] = useState("");
  const [showApiInput, setShowApiInput] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();
  const videoRef = useRef();
  const canvasRef = useRef();
  const streamRef = useRef();

  const t = T[lang];
  const dir = lang === "he" ? "rtl" : "ltr";

  useEffect(() => () => stopCamera(), []);

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
    setImageBase64(dataUrl.split(",")[1]);
    stopCamera();
    setStep(STEPS.UPLOAD);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = (ev) => setImageBase64(ev.target.result.split(",")[1]);
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
    } catch {
      setError(t.errorAnalyze);
      setStep(STEPS.UPLOAD);
    }
  };

  const generateWithFal = async () => {
    if (!falApiKey) { setShowApiInput(true); return; }
    setStep(STEPS.GENERATING);
    setError(null);
    try {
      const submitRes = await fetch("https://queue.fal.run/fal-ai/face-to-sticker", {
        method: "POST",
        headers: { "Authorization": `Key ${falApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: `data:image/jpeg;base64,${imageBase64}`,
          prompt: `${recommendation.imagePrompt}, professional microblading eyebrows result, natural beauty photography, high quality`,
          negative_prompt: "bad eyebrows, uneven, artificial, harsh lines, cartoon",
        }),
      });
      if (!submitRes.ok) throw new Error("fal error");
      const { request_id } = await submitRes.json();
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await fetch(`https://queue.fal.run/fal-ai/face-to-sticker/requests/${request_id}`, {
          headers: { "Authorization": `Key ${falApiKey}` },
        });
        const pd = await poll.json();
        if (pd.status === "COMPLETED" && pd.output?.image?.url) {
          setResultImage(pd.output.image.url);
          setStep(STEPS.RESULT);
          return;
        }
      }
      throw new Error("timeout");
    } catch {
      setError(t.errorGenerate);
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
    setError(null);
    setShowApiInput(false);
  };

  // progress mapping
  const progressMap = { [STEPS.UPLOAD]: 0, [STEPS.CAMERA]: 0, [STEPS.ANALYZING]: 1, [STEPS.RECOMMENDATION]: 2, [STEPS.GENERATING]: 3, [STEPS.RESULT]: 3 };
  const progressIndex = progressMap[step] ?? 0;

  // shared styles
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

        {/* Progress bar */}
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

        {/* Main card */}
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
              {/* Summary chip */}
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

              {/* Color */}
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "12px", marginBottom: "18px" }}>
                <p style={{ color: "#9a7088", fontSize: "11px", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t.colorLabel}</p>
                <p style={{ color: "#e8a0c8", fontSize: "14px", margin: 0, fontWeight: "600" }}>
                  {lang === "he" ? recommendation.colorRecommendation_he : recommendation.colorRecommendation_en}
                </p>
              </div>

              {/* Tips */}
              <h3 style={{ color: "#f0d4e8", fontSize: "13px", margin: "0 0 10px", fontWeight: "600" }}>{t.tipsTitle}</h3>
              <div style={{ marginBottom: "22px" }}>
                {(lang === "he" ? recommendation.tips_he : recommendation.tips_en)?.map((tip, i) => (
                  <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <span style={{ color: "#c060a0", flexShrink: 0 }}>•</span>
                    <span style={{ color: "#c4a0b8", fontSize: "14px", lineHeight: "1.5" }}>{tip}</span>
                  </div>
                ))}
              </div>

              {/* fal.ai key */}
              {showApiInput && (
                <div style={{ marginBottom: "14px" }}>
                  <p style={{ color: "#c4a0b8", fontSize: "13px", margin: "0 0 8px" }}>{t.apiLabel}</p>
                  <input type="password" placeholder="fal_..." value={falApiKey}
                    onChange={e => setFalApiKey(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,100,160,0.3)", borderRadius: "8px", color: "#f0d4e8", fontSize: "14px", boxSizing: "border-box", outline: "none" }} />
                </div>
              )}

              <button onClick={generateWithFal} style={btnPrimary}>{t.generateBtn}</button>
              <button onClick={() => alert(t.consultAlert)} style={btnSecondary}>{t.bookBtn}</button>
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
                  <img src={image} style={{ width: "100%", borderRadius: "10px", aspectRatio: "1", objectFit: "cover" }} />
                </div>
                <div>
                  <p style={{ color: "#e8a0c8", fontSize: "12px", textAlign: "center", margin: "0 0 8px", fontWeight: "700" }}>{t.after}</p>
                  <img src={resultImage} style={{ width: "100%", borderRadius: "10px", aspectRatio: "1", objectFit: "cover", border: "2px solid rgba(200,100,160,0.5)" }} />
                </div>
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
