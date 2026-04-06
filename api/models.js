export const config = { runtime: "edge" };

export default async function handler(req) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: "no key" }), { status: 500 });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`
  );
  const data = await res.json();

  // Filter to models that support generateContent or image generation
  const models = (data.models || []).map(m => ({
    name: m.name,
    displayName: m.displayName,
    methods: m.supportedGenerationMethods,
  }));

  return new Response(JSON.stringify(models, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}
