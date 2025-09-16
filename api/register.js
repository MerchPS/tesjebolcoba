// api/register.js
import fetch from "node-fetch";
import bcrypt from "bcryptjs";

const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

export default async function handler(req, res) {
  // CORS - batasi origin di production
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Missing username/password" });
    // Simple validation
    if (typeof username !== "string" || typeof password !== "string") return res.status(400).json({ error: "Invalid input" });
    if (username.length < 3 || password.length < 6) return res.status(400).json({ error: "Username/password too short" });

    // 1) Read current bin
    const getResp = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      headers: {
        "X-Master-Key": JSONBIN_MASTER_KEY,
        "X-Access-Key": process.env.JSONBIN_ACCESS_KEY || "",
        "Content-Type": "application/json"
      }
    });

    let binData = { users: [] };
    if (getResp.status === 200) {
      const parsed = await getResp.json();
      // JsonBin v3 returns object { record: ... }
      binData = parsed.record || parsed;
      if (!binData.users) binData.users = [];
    } else if (getResp.status === 404) {
      binData = { users: [] };
    } else {
      // allow creation if not accessible
      const text = await getResp.text();
      console.error("jsonbin read error:", getResp.status, text);
      return res.status(500).json({ error: "Unable to read database" });
    }

    // Check username unique
    const exists = binData.users.find(u => u.username === username);
    if (exists) return res.status(409).json({ error: "Username already exists" });

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const userObj = {
      username,
      passwordHash: hash,
      createdAt: new Date().toISOString()
    };

    binData.users.push(userObj);

    // 2) PUT updated bin
    const putResp = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": JSONBIN_MASTER_KEY,
        "X-Access-Key": process.env.JSONBIN_ACCESS_KEY || ""
      },
      body: JSON.stringify(binData)
    });

    if (!putResp.ok) {
      const t = await putResp.text();
      console.error("jsonbin put error", putResp.status, t);
      return res.status(500).json({ error: "Failed to save user" });
    }

    return res.status(201).json({ ok: true, user: { username, createdAt: userObj.createdAt } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
