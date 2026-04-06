export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not set" });
  }

  const { imageBase64, prompt } = req.body;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: "image/jpeg", data: imageBase64 } },
            {
              text: `Edit ONLY the eyebrows in this photo: ${prompt}. The face, skin tone, eyes, nose, mouth, hair, lighting, and background must remain completely identical. Only the eyebrow shape, thickness and arch should change.`
            }
          ]
        }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"]
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return res.status(500).json({ error: `Gemini error: ${JSON.stringify(data)}` });
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inline_data?.mime_type?.startsWith("image/"));

  if (!imagePart) {
    return res.status(500).json({ error: `No image returned. Response: ${JSON.stringify(data).slice(0, 400)}` });
  }

  return res.status(200).json({
    imageBase64: imagePart.inline_data.data,
    mimeType: imagePart.inline_data.mime_type,
  });
}
