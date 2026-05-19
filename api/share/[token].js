import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Token required" });

  const sql = neon(process.env.DATABASE_URL);

  const tokenRow = await sql`SELECT trip_id FROM share_tokens WHERE token = ${token}`;
  if (!tokenRow.length) return res.status(404).json({ error: "Share link not found or expired" });

  const tripId = tokenRow[0].trip_id;
  const dataRow = await sql`SELECT data FROM app_data WHERE id = 1`;
  if (!dataRow.length) return res.status(404).json({ error: "No data found" });

  let appState;
  try {
    appState = JSON.parse(dataRow[0].data);
  } catch {
    return res.status(500).json({ error: "Corrupted state data" });
  }

  const trip = (appState.trips || []).find((t) => t.id === tripId);
  if (!trip) return res.status(404).json({ error: "Trip not found" });

  return res.status(200).json({ trip, settings: appState.settings });
}
