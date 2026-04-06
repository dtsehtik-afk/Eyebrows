export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "FAL_API_KEY is not set" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { imageBase64, prompt } = await req.json();

    const submitRes = await fetch("https://queue.fal.run/fal-ai/flux/dev/image-to-image", {
      method: "POST",
      headers: { "Authorization": `Key ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: `data:image/jpeg;base64,${imageBase64}`,
        prompt: `ONLY the eyebrows are modified, everything else remains identical: ${prompt}. Same person, same face, same skin, same lighting, same background. Only eyebrow shape, thickness and arch change. Photorealistic beauty portrait.`,
        negative_prompt: "different person, changed face, altered skin, modified nose, changed lips, blurry, deformed, cartoon, old, aged",
        strength: 0.38,
        num_inference_steps: 35,
        guidance_scale: 9,
        num_images: 1,
      }),
    });

    const submitData = await submitRes.json();
    if (!submitRes.ok || !submitData.request_id) {
      return new Response(JSON.stringify({ error: `fal error: ${JSON.stringify(submitData)}` }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    // Return the exact URLs fal.ai gave us
    return new Response(JSON.stringify({
      request_id: submitData.request_id,
      status_url: submitData.status_url,
      response_url: submitData.response_url,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
