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
                text: `You are an expert eyebrow designer. Analyze this face and return ONLY valid JSON, no extra text, no markdown:
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
  "tips_he": ["טיפ 1", "טיפ 2", "טיפ 3"],
  "tips_en": ["tip 1", "tip 2", "tip 3"],
  "imagePrompt": "detailed English prompt for AI eyebrow generation"
}`
              }
            ]
          }],
          generationConfig: { temperature: 0.4 }
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
