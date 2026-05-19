import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { password } = req.body || {};
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const sql = neon(process.env.DATABASE_URL);
  const existing = await sql`SELECT id FROM auth WHERE id = 1`;
  if (existing.length) {
    return res.status(409).json({
      error: "Master password already set. Delete the row from the auth table in Neon to reset it.",
    });
  }

  const hash = await bcrypt.hash(password, 12);
  await sql`INSERT INTO auth (id, password_hash) VALUES (1, ${hash})`;
  return res.status(201).json({ ok: true, message: "Master password set. You can now sign in." });
}
