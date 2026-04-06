export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { imageBase64, lang } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: imageBase64,
                }
              },
              {
                text: `You are Master Arch, the world's leading eyebrow architect. Your analysis process:
1. Map the face using Golden Ratio: measure forehead width, cheekbone width, jawline width
2. Identify face shape from these 3 measurements
3. Detect any asymmetry between left and right eyebrows
4. Design the perfect eyebrow arch type for this face

Return ONLY valid JSON, no extra text, no markdown:
{
  "faceShape": "oval",
  "faceShapeHebrew": "שם בעברית",
  "faceShapeEnglish": "name in English",
  "recommendedStyle": "style name",
  "recommendedStyleDesc_he": "תיאור מפורט בעברית",
  "recommendedStyleDesc_en": "detailed description in English",
  "technique_he": "טכניקה בעברית",
  "technique_en": "technique in English",
  "colorRecommendation_he": "גוון בעברית",
  "colorRecommendation_en": "color in English",
  "archType": "soft arch / high arch / flat / S-curve / straight",
  "asymmetryNote": "describe any left-right asymmetry, or 'symmetric' if balanced",
  "tips_he": ["טיפ 1", "טיפ 2", "טיפ 3"],
  "tips_en": ["tip 1", "tip 2", "tip 3"],
  "imagePrompt": "Precise FLUX instruction: describe exact eyebrow thickness (thin/medium/thick), arch height (low/medium/high), arch peak position (above outer iris / above pupil), tail direction (slightly downward / flat / upward), brow color and gradient, texture (defined/feathered/powdery), start and end points relative to the eye corners. Be very specific about shape geometry.",
  "browBox": {"x": 0.10, "y": 0.28, "w": 0.80, "h": 0.14}
}

IMPORTANT for browBox: estimate the bounding box that covers BOTH eyebrows together as fractions of image dimensions (0.0–1.0). x=left edge, y=top edge, w=width, h=height. Include ~20% padding around the brows. Typical values: y around 0.25–0.40, h around 0.10–0.18.`
              }
            ]
          }],
          generationConfig: { temperature: 0.7 }
        }),
      }
    );

    const geminiData = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Gemini API error: ${JSON.stringify(geminiData)}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      return new Response(JSON.stringify({ error: `No candidates from Gemini: ${JSON.stringify(geminiData)}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const text = geminiData.candidates[0].content.parts[0].text;
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
