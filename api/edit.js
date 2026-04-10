export const config = { maxDuration: 60 };

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not set" }), {
    status: 500, headers: { "Content-Type": "application/json" },
  });

  const { imageBase64, prompt } = await req.json();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: "image/jpeg", data: imageBase64 } },
            {
              text: `Edit ONLY the eyebrows in this photo: ${prompt}. The face, skin tone, eyes, nose, mouth, hair, lighting, and background must remain completely identical. Only the eyebrow shape, thickness and arch should change.`,
            },
          ],
        }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
          temperature: 1,
          topP: 0.95,
          topK: 40,
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return new Response(JSON.stringify({ error: data?.error?.message || JSON.stringify(data) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p =>
    p.inlineData?.mimeType?.startsWith("image/") ||
    p.inline_data?.mime_type?.startsWith("image/")
  );

  if (!imagePart) {
    const textPart = parts.find(p => p.text)?.text || "";
    return new Response(JSON.stringify({
      error: `No image returned. Text: "${textPart.slice(0, 200)}" Raw: ${JSON.stringify(data).slice(0, 300)}`,
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const imgData = imagePart.inlineData || imagePart.inline_data;
  return new Response(JSON.stringify({
    imageBase64: imgData.data,
    mimeType: imgData.mimeType || imgData.mime_type,
  }), { headers: { "Content-Type": "application/json" } });
}
