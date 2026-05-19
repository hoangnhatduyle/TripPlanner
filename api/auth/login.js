import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "Password required" });

  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT password_hash FROM auth WHERE id = 1`;
  if (!rows.length) {
    return res.status(404).json({ error: "Master password not configured. Run /api/auth/setup first." });
  }

  const valid = await bcrypt.compare(password, rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: "Incorrect password" });

  const token = jwt.sign({ role: "editor" }, process.env.JWT_SECRET, { expiresIn: "24h" });
  return res.status(200).json({ token });
}
