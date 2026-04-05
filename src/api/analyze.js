export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { imageBase64, lang } = await req.json();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
            {
              type: "text",
              text: `You are an expert eyebrow designer. Analyze this face and return ONLY valid JSON:
{
  "faceShape": "oval|round|square|heart|long",
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
        }]
      }),
    });

    const data = await response.json();
    const text = data.content[0].text;
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
