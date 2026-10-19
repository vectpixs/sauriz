const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const router = express.Router();
const db = new Database("chatbox-users.db");

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    verified INTEGER DEFAULT 0,
    verification_hash TEXT,
    verification_expires INTEGER,
    created_at INTEGER NOT NULL
  )
`);

const JWT_SECRET = process.env.JWT_SECRET;

function getMailer() {
  if (!process.env.SMTP_HOST ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASS) {
    throw new Error("Email service is not configured.");
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createSession(user) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    { sub: String(user.id), email: user.email },
    JWT_SECRET,
    { expiresIn: "7d", issuer: "chatbox.ai" }
  );
}

// Register a new account and send a verification email.
router.post("/register", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        error: "Password must be at least 8 characters and no more than 72 UTF-8 bytes."
      });
    }

    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
      return res.status(409).json({
        error: "An account with this email already exists."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expires = Date.now() + 30 * 60 * 1000;

    const result = db.prepare(`
      INSERT INTO users
      (email, password_hash, verified, verification_hash,
       verification_expires, created_at)
      VALUES (?, ?, 0, ?, ?, ?)
    `).run(email, passwordHash, tokenHash, expires, Date.now());

    try {
      const baseUrl = process.env.APP_URL;
      if (!baseUrl) throw new Error("APP_URL is not configured.");

      const verifyUrl =
        `${baseUrl.replace(/\/$/, "")}/api/auth/verify?token=${token}`;

      await getMailer().sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: email,
        subject: "Verify your Sauriz AI account",
        text:
          `Welcome to Sauriz AI!\n\n` +
          `Verify your email within 30 minutes:\n${verifyUrl}\n\n` +
          `If you did not create this account, ignore this email.`
      });
    } catch (mailError) {
      db.prepare("DELETE FROM users WHERE id = ?").run(result.lastInsertRowid);
      throw mailError;
    }

    return res.status(201).json({
      message: "Account created. Check your email to verify your account."
    });
  } catch (error) {
    console.error("Registration error:", error.message);
    return res.status(500).json({
      error: "Registration failed. Check the server email configuration."
    });
  }
});

// Verify the email address.
router.get("/verify", async (req, res) => {
  try {
    const token = String(req.query.token || "");

    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).send("Invalid verification link.");
    }

    const user = db.prepare(`
      SELECT id, email FROM users
      WHERE verification_hash = ? AND verification_expires > ?
        AND verified = 0
    `).get(hashToken(token), Date.now());

    if (!user) {
      return res.status(400).send(
        "This verification link is invalid or expired. Please register again."
      );
    }

    db.prepare(`
      UPDATE users
      SET verified = 1, verification_hash = NULL,
          verification_expires = NULL
      WHERE id = ?
    `).run(user.id);

    return res.send(
      "Your email has been verified. You can now sign in to Sauriz AI."
    );
  } catch (error) {
    console.error("Verification error:", error.message);
    return res.status(500).send("Email verification failed.");
  }
});

// Sign in with a verified account.
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");

    const user = db.prepare(`
      SELECT id, email, password_hash, verified
      FROM users WHERE email = ?
    `).get(email);

    // Use a generic response to avoid disclosing account details.
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    if (!user.verified) {
      return res.status(403).json({
        error: "Please verify your email before signing in."
      });
    }

    const token = createSession(user);

    return res.json({
      message: "Login successful.",
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ error: "Login failed." });
  }
});

// Return the currently authenticated user.
router.get("/me", (req, res) => {
  try {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
      return res.status(401).json({ error: "Authentication required." });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ error: "Server authentication is not configured." });
    }

    const payload = jwt.verify(match[1], JWT_SECRET, {
      issuer: "chatbox.ai"
    });

    const user = db.prepare(
      "SELECT id, email, verified FROM users WHERE id = ?"
    ).get(Number(payload.sub));

    if (!user || !user.verified) {
      return res.status(401).json({ error: "Invalid account." });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        verified: Boolean(user.verified)
      }
    });
  } catch {
    return res.status(401).json({
      error: "Your session is invalid or expired."
    });
  }
});

module.exports = router;