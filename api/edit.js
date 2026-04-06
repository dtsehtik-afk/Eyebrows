export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not set" }), {
    status: 500, headers: { "Content-Type": "application/json" },
  });

  const { imageBase64, prompt } = await req.json();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview-image-generation:generateContent?key=${apiKey}`,
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
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return new Response(JSON.stringify({ error: JSON.stringify(data) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inline_data?.mime_type?.startsWith("image/"));

  if (!imagePart) {
    return new Response(JSON.stringify({ error: `No image returned. Raw: ${JSON.stringify(data).slice(0, 400)}` }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    imageBase64: imagePart.inline_data.data,
    mimeType: imagePart.inline_data.mime_type,
  }), { headers: { "Content-Type": "application/json" } });
}
