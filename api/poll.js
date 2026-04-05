export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "FAL_API_KEY is not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get("request_id");
  if (!requestId) {
    return new Response(JSON.stringify({ error: "Missing request_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const poll = await fetch(`https://queue.fal.run/fal-ai/face-to-sticker/requests/${requestId}`, {
      headers: { "Authorization": `Key ${apiKey}` },
    });
    const data = await poll.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
