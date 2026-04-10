export const config = { runtime: "edge" };

async function signToken(phone, otp, secret) {
  const data = `${phone}:${otp}:${Date.now()}`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${btoa(data)}.${sigHex}`;
}

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { phone } = await req.json();
  if (!phone) return new Response(JSON.stringify({ ok: false, error: "missing phone" }), { status: 400 });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const secret = process.env.OTP_SECRET || "brows-secret-key";
  const token = await signToken(phone, otp, secret);

  const instance = process.env.GREEN_API_INSTANCE;
  const apiToken = process.env.GREEN_API;

  // Check instance is authorized before sending
  const stateRes = await fetch(`https://api.green-api.com/waInstance${instance}/getStateInstance/${apiToken}`);
  if (!stateRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: "green_api_auth_failed", httpStatus: stateRes.status, instance }), { status: 500 });
  }
  const { stateInstance } = await stateRes.json();
  if (stateInstance !== "authorized") {
    return new Response(JSON.stringify({ ok: false, error: "whatsapp_disconnected", stateInstance }), { status: 503 });
  }

  // Format Israeli phone to WhatsApp chat ID
  const chatId = phone.replace(/\D/g, "").replace(/^0/, "972") + "@c.us";

  const res = await fetch(
    `https://api.green-api.com/waInstance${instance}/sendMessage/${apiToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        message: `קוד האימות שלך לייעוץ גבות: *${otp}*\nהקוד תקף ל-10 דקות 🌸`,
      }),
    }
  );

  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    return new Response(JSON.stringify({ ok: false, error: "whatsapp send failed", status: res.status, detail }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, token }), {
    headers: { "Content-Type": "application/json" },
  });
}
