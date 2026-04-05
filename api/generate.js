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

    if (!submitRes.ok) {
      const err = await submitRes.text();
      return new Response(JSON.stringify({ error: `fal submit error: ${err}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { request_id } = await submitRes.json();

    // Poll for result (max 40s)
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const poll = await fetch(`https://queue.fal.run/fal-ai/face-to-sticker/requests/${request_id}`, {
        headers: { "Authorization": `Key ${apiKey}` },
      });
      const pd = await poll.json();
      if (pd.status === "COMPLETED" && pd.output?.image?.url) {
        return new Response(JSON.stringify({ imageUrl: pd.output.image.url }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Generation timed out" }), {
      status: 504,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
