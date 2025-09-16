// api/users.js
import fetch from "node-fetch";
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const getResp = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      headers: {
        "X-Master-Key": process.env.JSONBIN_MASTER_KEY,
        "X-Access-Key": process.env.JSONBIN_ACCESS_KEY || "",
        "Content-Type": "application/json"
      }
    });

    if (!getResp.ok) {
      const t = await getResp.text();
      console.error("jsonbin read fail", getResp.status, t);
      return res.status(500).json({ error: "Unable to read database" });
    }

    const parsed = await getResp.json();
    const binData = parsed.record || parsed;
    // Do not return passwordHash
    const users = (binData.users || []).map(u => ({ username: u.username, createdAt: u.createdAt || null }));
    return res.json({ ok: true, users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
