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
    const { imageBase64, maskBase64, prompt } = await req.json();

    const submitRes = await fetch("https://queue.fal.run/fal-ai/flux-pro/v1/fill", {
      method: "POST",
      headers: { "Authorization": `Key ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: `data:image/jpeg;base64,${imageBase64}`,
        mask_url: `data:image/png;base64,${maskBase64}`,
        prompt: `${prompt}. Perfectly shaped eyebrows, natural eye makeup, photorealistic beauty portrait, same person same age same skin tone same lighting.`,
        negative_prompt: "wrinkles, forehead lines, aged, old, different person, different skin, blurry, deformed",
        num_inference_steps: 35,
        guidance_scale: 10,
      }),
    });

    const submitData = await submitRes.json();
    if (!submitRes.ok || !submitData.request_id) {
      return new Response(JSON.stringify({ error: `fal error: ${JSON.stringify(submitData)}` }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

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
