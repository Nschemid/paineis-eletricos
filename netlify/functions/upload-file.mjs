import { getStore } from "@netlify/blobs";

// Fast synchronous function: stages one file's base64 content in Blobs so the
// background analysis function can read it by reference instead of receiving
// it in its invocation payload (Netlify Background Functions/Lambda async
// invoke cap that payload at 256KB, which multi-file drawing sets exceed).
export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const { jobId, index, file, mimeType, name } = body;
  if (!jobId || index === undefined || !file || !mimeType) {
    return Response.json({ error: "Missing jobId, index, file or mimeType" }, { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const uploads = getStore("uploads");
  await uploads.set(`${jobId}:${index}`, JSON.stringify({ file, mimeType, name }));

  return Response.json({ ok: true }, { headers: { "Access-Control-Allow-Origin": "*" } });
};
