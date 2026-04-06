export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { phone, otp, token } = await req.json();
  if (!phone || !otp || !token) {
    return new Response(JSON.stringify({ ok: false, error: "missing fields" }), { status: 400 });
  }

  try {
    const [encodedData, sigHex] = token.split(".");
    const data = atob(encodedData);
    const [tokenPhone, tokenOtp, timestamp] = data.split(":");

    // Check expiry (10 minutes)
    if (Date.now() - parseInt(timestamp) > 10 * 60 * 1000) {
      return new Response(JSON.stringify({ ok: false, error: "expired" }), { status: 400 });
    }

    // Verify signature
    const secret = process.env.OTP_SECRET || "brows-secret-key";
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
    const expectedHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

    if (sigHex !== expectedHex || tokenPhone !== phone || tokenOtp !== otp) {
      return new Response(JSON.stringify({ ok: false, error: "invalid code" }), { status: 400 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid token" }), { status: 400 });
  }
}
