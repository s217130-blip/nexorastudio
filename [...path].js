export default async function handler(request, response) {
  const workerBase = process.env.CLOUDFLARE_WORKER_URL;
  if (!workerBase) {
    response.status(501).json({
      error: "Missing CLOUDFLARE_WORKER_URL",
      hint: "Set CLOUDFLARE_WORKER_URL to your Cloudflare Worker origin, for example https://nexora-api.your-subdomain.workers.dev"
    });
    return;
  }

  const segments = Array.isArray(request.query.path) ? request.query.path : [request.query.path].filter(Boolean);
  const target = new URL(`/api/${segments.join("/")}`, workerBase.replace(/\/$/, ""));
  for (const [key, value] of Object.entries(request.query)) {
    if (key !== "path" && typeof value === "string") target.searchParams.set(key, value);
  }

  const headers = new Headers();
  if (request.headers["content-type"]) headers.set("Content-Type", request.headers["content-type"]);
  if (request.headers["x-nexora-user-id"]) headers.set("x-nexora-user-id", request.headers["x-nexora-user-id"]);

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : JSON.stringify(request.body || {})
  });

  const text = await upstream.text();
  response.status(upstream.status);
  response.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
  response.send(text);
}
