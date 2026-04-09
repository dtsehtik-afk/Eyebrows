export const config = { runtime: "edge" };

const LANG_INSTRUCTION = {
  he: "כתבי את ההודעה בעברית",
  en: "Write the message in English",
  ru: "Напишите сообщение на русском языке",
};

async function generateWelcomeMessage(name, lang = "he") {
  const apiKey = process.env.GEMINI_API_KEY;
  const langInstruction = LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.he;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `שמך אלינה, אמנית גבות מקצועית. נכנס לך ליד חדש בשם ${name} שהתנסתה בסוכן הגבות הדיגיטלי שלך.
כתבי הודעת ווצאפ קצרה, נעימה ומפתה בשם אלינה (לא "אלינה מ..." או כל שם עסק).
ההודעה צריכה:
- להיות חמה ואישית, לא תבנית מעוצבת
- להזמין אותה לקבוע ייעוץ חינם דרך הקישור: https://calendly.com/alinatsehtik1234/30min
- להיות עד 80 מילים
- לא לכלול כותרות, רק טקסט טבעי
${langInstruction}.

כתבי רק את ההודעה עצמה.`
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
    const { name, phone, lang } = body;

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
      const message = await generateWelcomeMessage(name, lang);
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
