export const config = { runtime: "edge" };

async function generateWelcomeMessage(name) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `אתה עוזר לאלינה, מומחית לגבות. כתבי הודעת ווצאפ קצרה ואישית בעברית ללקוחה בשם ${name} שזה עתה התנסתה בסוכן ייעוץ הגבות שלה.
ההודעה צריכה:
- להיות חמה, אישית ולא מעוצבת כמו תבנית
- להזכיר את הניסיון שלה עם הסוכן
- להזמין אותה לקבוע ייעוץ חינם דרך הקישור: https://calendly.com/alinatsehtik1234/30min
- להיות עד 100 מילים
- לא לכלול כותרות או תבניות, רק טקסט טבעי

כתבי רק את ההודעה עצמה, ללא הסברים.`,
      }],
    }),
  });
  const data = await res.json();
  return data.content[0].text;
}

async function sendWhatsApp(phone, message) {
  const instance = process.env.GREEN_API_INSTANCE;
  const apiToken = process.env.GREEN_API;
  const chatId = phone.replace(/\D/g, "").replace(/^0/, "972") + "@c.us";

  await fetch(
    `https://api.green-api.com/waInstance${instance}/sendMessage/${apiToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    }
  );
}

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const body = await req.json();
    const { name, phone } = body;

    // Save to Google Sheets
    const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    }

    // Send personalized WhatsApp welcome message
    if (name && phone) {
      const message = await generateWelcomeMessage(name);
      await sendWhatsApp(phone, message).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
