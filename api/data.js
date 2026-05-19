import { neon } from "@neondatabase/serverless";
import jwt from "jsonwebtoken";

export const config = {
  api: { bodyParser: { sizeLimit: "8mb" } },
};

const DEFAULT_STATE = JSON.stringify({
  trips: [],
  settings: { theme: "beach", currency: "USD" },
});

function verifyToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(auth.slice(7), process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();

  const sql = neon(process.env.DATABASE_URL);

  if (req.method === "GET") {
    const rows = await sql`SELECT data FROM app_data WHERE id = 1`;
    const data = rows[0]?.data ?? DEFAULT_STATE;
    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(data);
  }

  if (req.method === "PUT") {
    if (!verifyToken(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const body = JSON.stringify(req.body);
    await sql`
      INSERT INTO app_data (id, data) VALUES (1, ${body})
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
    `;
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
