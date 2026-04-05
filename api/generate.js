export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "FAL_API_KEY is not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { imageBase64, prompt } = await req.json();

    const submitRes = await fetch("https://queue.fal.run/fal-ai/face-to-sticker", {
      method: "POST",
      headers: { "Authorization": `Key ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: `data:image/jpeg;base64,${imageBase64}`,
        prompt,
        negative_prompt: "bad eyebrows, uneven, artificial, harsh lines, cartoon",
      }),
    });

    const submitData = await submitRes.json();
    if (!submitRes.ok) {
      return new Response(JSON.stringify({ error: `fal error: ${JSON.stringify(submitData)}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ request_id: submitData.request_id }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
