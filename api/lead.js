export const config = { runtime: "edge" };

async function generateWelcomeMessage(name) {
  const apiKey = process.env.GEMINI_API_KEY;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `אתה עוזר לאלינה, מומחית לגבות. כתבי הודעת ווצאפ קצרה ואישית בעברית ללקוחה בשם ${name} שזה עתה התנסתה בסוכן ייעוץ הגבות שלה.
ההודעה צריכה:
- להיות חמה, אישית ולא מעוצבת כמו תבנית
- להזכיר את הניסיון שלה עם הסוכן
- להזמין אותה לקבוע ייעוץ חינם דרך הקישור: https://calendly.com/alinatsehtik1234/30min
- להיות עד 100 מילים
- לא לכלול כותרות או תבניות, רק טקסט טבעי

כתבי רק את ההודעה עצמה, ללא הסברים.`
          }]
        }]
      }),
    }
  );
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
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
