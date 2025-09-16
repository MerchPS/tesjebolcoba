// api/login.js
import fetch from "node-fetch";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY;
const JWT_SECRET = process.env.JWT_SECRET || "change_this_in_production";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Missing username/password" });

    // Read bin
    const getResp = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      headers: {
        "X-Master-Key": process.env.JSONBIN_MASTER_KEY,
        "X-Access-Key": process.env.JSONBIN_ACCESS_KEY || "",
        "Content-Type": "application/json"
      }
    });

    if (!getResp.ok) return res.status(500).json({ error: "Unable to read database" });
    const parsed = await getResp.json();
    const binData = parsed.record || parsed;
    const users = binData.users || [];

    const user = users.find(u => u.username === username);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = bcrypt.compareSync(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    // Create JWT (short-lived)
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "6h" });

    return res.json({ ok: true, token, user: { username } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
