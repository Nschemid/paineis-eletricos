import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return Response.json({ error: "Missing jobId" }, { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const jobs = getStore("jobs");
  const raw = await jobs.get(jobId);
  if (!raw) {
    return Response.json({ status: "pending" }, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  return Response.json(JSON.parse(raw), { headers: { "Access-Control-Allow-Origin": "*" } });
};
