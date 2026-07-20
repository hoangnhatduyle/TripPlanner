// Vercel's Hobby plan caps a deployment at 12 Serverless Functions, so both
// Drive endpoints (folder listing, thumbnail proxy) live in this single file
// instead of one file each — dispatched by ?action=.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { action } = req.query;
    if (action === "thumb") return await handleThumb(req, res);
    return await handleFolder(req, res);
  } catch (err) {
    console.error("[drive] uncaught:", err);
    if (!res.writableEnded) res.status(500).json({ error: err.message || String(err) });
  }
}

// ── GET ?action=folder — list images and videos in a public Drive folder ─────
async function handleFolder(req, res) {
  const { folderId } = req.query;
  if (!folderId || !/^[a-zA-Z0-9_-]+$/.test(folderId))
    return res.status(400).json({ error: "Invalid folderId" });

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", `'${folderId}' in parents and (mimeType contains 'image/' or mimeType contains 'video/') and trashed = false`);
  url.searchParams.set("fields", "files(id,name,createdTime,imageMediaMetadata,thumbnailLink,mimeType)");
  url.searchParams.set("orderBy", "createdTime");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("key", apiKey);

  try {
    const driveRes = await fetch(url.toString());
    if (!driveRes.ok) {
      const err = await driveRes.json().catch(() => ({}));
      if (driveRes.status === 404) return res.status(404).json({ error: "Folder not found or not public" });
      return res.status(502).json({ error: err?.error?.message || "Drive API error" });
    }
    const data = await driveRes.json();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json({ files: data.files || [] });
  } catch {
    return res.status(502).json({ error: "Failed to reach Google Drive API" });
  }
}

// ── GET ?action=thumb — proxy a file's thumbnail image ────────────────────────
async function handleThumb(req, res) {
  const { fileId, sz } = req.query;
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) return res.status(400).end();

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return res.status(500).end();

  const size = Math.min(2000, Math.max(100, parseInt(sz) || 400));

  try {
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&key=${encodeURIComponent(apiKey)}`
    );
    if (!metaRes.ok) return res.status(metaRes.status).end();

    const meta = await metaRes.json();
    if (!meta.thumbnailLink) return res.status(404).end();

    const thumbUrl = meta.thumbnailLink.replace(/=s\d+$/, `=s${size}`);
    const imgRes = await fetch(thumbUrl);
    if (!imgRes.ok) return res.status(imgRes.status).end();

    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.setHeader("Content-Type", imgRes.headers.get("content-type") || "image/jpeg");
    res.send(Buffer.from(await imgRes.arrayBuffer()));
  } catch {
    res.status(502).end();
  }
}
