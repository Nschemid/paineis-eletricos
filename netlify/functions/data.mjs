import { getStore } from "@netlify/blobs";

const ALLOWED_STORES = ["drawings", "catalog", "cables", "terminals", "contactors"];
const BLOB_KEY = "data";

export default async (req) => {
  const url = new URL(req.url);
  const store = url.searchParams.get("store");

  if (!store || !ALLOWED_STORES.includes(store)) {
    return new Response(JSON.stringify({ error: "Invalid store. Use ?store=drawings, ?store=catalog, ?store=cables, ?store=terminals or ?store=contactors" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const blob = getStore(store);

  if (req.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method === "GET") {
    try {
      const data = await blob.get(BLOB_KEY);
      return new Response(data || "[]", {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    } catch (e) {
      return new Response("[]", {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  }

  if (req.method === "POST") {
    try {
      const body = await req.text();
      JSON.parse(body); // validate it's valid JSON
      await blob.set(BLOB_KEY, body);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
};
