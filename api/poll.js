export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "FAL_API_KEY is not set" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const statusUrl = searchParams.get("status_url");
  const responseUrl = searchParams.get("response_url");

  if (!statusUrl || !responseUrl) {
    return new Response(JSON.stringify({ error: "Missing status_url or response_url" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const headers = { "Authorization": `Key ${apiKey}` };

  try {
    const statusRes = await fetch(statusUrl, { headers });
    const statusData = await statusRes.json();

    if (statusData.status !== "COMPLETED") {
      return new Response(JSON.stringify({ status: statusData.status || "IN_QUEUE" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const resultRes = await fetch(responseUrl, { headers });
    const result = await resultRes.json();

    const imageUrl =
      result.images?.[0]?.url ||
      result.image?.url ||
      result.output?.images?.[0]?.url ||
      result.output?.image?.url ||
      result.response?.images?.[0]?.url ||
      result.response?.image?.url;

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: `Completed but no imageUrl. Raw: ${JSON.stringify(result).slice(0, 500)}` }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "COMPLETED", imageUrl }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
