export const config = { runtime: "edge" };

export default async function handler(req) {
  const instance = process.env.GREEN_API_INSTANCE;
  const apiToken = process.env.GREEN_API;

  const res = await fetch(`https://api.green-api.com/waInstance${instance}/getStateInstance/${apiToken}`);
  const { stateInstance } = await res.json();

  return new Response(JSON.stringify({ stateInstance }), {
    headers: { "Content-Type": "application/json" },
  });
}
