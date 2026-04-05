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

  const headers = { "Authorization": `Key ${apiKey}` };
  const base = `https://queue.fal.run/fal-ai/flux/dev/image-to-image/requests/${requestId}`;

  try {
    const statusRes = await fetch(`${base}/status`, { headers });
    const statusData = await statusRes.json();

    if (statusData.status !== "COMPLETED") {
      return new Response(JSON.stringify({ status: statusData.status }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const resultRes = await fetch(base, { headers });
    const result = await resultRes.json();

    const imageUrl =
      result.images?.[0]?.url ||
      result.image?.url ||
      result.output?.images?.[0]?.url ||
      result.output?.image?.url;

    return new Response(JSON.stringify({ status: "COMPLETED", imageUrl }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
