export const config = { runtime: "edge" };

const MAX_SIMULATIONS = 3;

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { phone } = await req.json();
  if (!phone) return new Response(JSON.stringify({ ok: false }), { status: 400 });

  const readUrl = process.env.GOOGLE_SHEET_READ_URL;
  if (!readUrl) return new Response(JSON.stringify({ ok: true, count: 0, blocked: false }), { status: 200 });

  try {
    const normalizedPhone = phone.replace(/\D/g, "");
    const res = await fetch(`${readUrl}?phone=${encodeURIComponent(normalizedPhone)}`);
    const data = await res.json();
    const count = data.count || 0;

    return new Response(JSON.stringify({
      ok: true,
      count,
      blocked: count >= MAX_SIMULATIONS,
    }), { headers: { "Content-Type": "application/json" } });
  } catch {
    // On error, allow the user through
    return new Response(JSON.stringify({ ok: true, count: 0, blocked: false }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
