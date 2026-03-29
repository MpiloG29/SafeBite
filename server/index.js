import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const googleClientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const allowedDomain = String(process.env.GOOGLE_ALLOWED_DOMAIN || "gmail.com").trim().toLowerCase();
const allowPreviewLogin = String(process.env.ALLOW_PREVIEW_LOGIN || "true").toLowerCase() !== "false";
const anthropicApiKey = String(process.env.ANTHROPIC_API_KEY || "").trim();
const anthropicVisionModel = String(process.env.ANTHROPIC_VISION_MODEL || "claude-3-5-sonnet-latest").trim();
const maxImageBytes = 8 * 1024 * 1024;

const oauthClient = googleClientId ? new OAuth2Client(googleClientId) : null;
const anthropicClient = anthropicApiKey ? new Anthropic({ apiKey: anthropicApiKey }) : null;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxImageBytes },
});

function readAnthropicText(result) {
  const parts = result.content
    ?.filter((item) => item.type === "text" && typeof item.text === "string")
    ?.map((item) => item.text.trim())
    ?.filter(Boolean);

  return parts?.join("\n") || "";
}

async function extractMenuTextFromImage(file) {
  if (!anthropicClient) {
    throw new Error("Server Anthropic API key is not configured.");
  }

  const mimeType = file.mimetype || "image/jpeg";
  const base64Data = file.buffer.toString("base64");

  const result = await anthropicClient.messages.create({
    model: anthropicVisionModel,
    max_tokens: 1400,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: base64Data,
            },
          },
          {
            type: "text",
            text:
              "Read this restaurant menu image and return only the menu text as clean plain text. Keep one dish per line when possible. Do not add explanations, markdown, headings, or OCR notes.",
          },
        ],
      },
    ],
  });

  const text = readAnthropicText(result);

  if (!text) {
    throw new Error("Claude did not return any menu text.");
  }

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

app.use(cors());
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    googleConfigured: Boolean(googleClientId),
    allowPreviewLogin,
    anthropicConfigured: Boolean(anthropicApiKey),
  });
});

app.post("/api/menu/extract", upload.single("image"), async (request, response) => {
  try {
    const file = request.file;

    if (!file) {
      response.status(400).json({ error: "Missing image upload." });
      return;
    }

    if (!file.mimetype?.startsWith("image/")) {
      response.status(400).json({ error: "Please upload an image file." });
      return;
    }

    const text = await extractMenuTextFromImage(file);

    response.json({
      text,
      fileName: file.originalname,
      model: anthropicVisionModel,
    });
  } catch (error) {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      response.status(413).json({ error: "Image is too large. Use an image smaller than 8 MB." });
      return;
    }

    response.status(500).json({ error: error.message || "Menu image extraction failed." });
  }
});

app.post("/api/auth/google", async (request, response) => {
  try {
    const { credential } = request.body || {};

    if (!googleClientId || !oauthClient) {
      response.status(500).json({ error: "Server Google client ID is not configured." });
      return;
    }

    if (!credential) {
      response.status(400).json({ error: "Missing Google credential." });
      return;
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      response.status(400).json({ error: "Google sign-in did not return an email address." });
      return;
    }

    if (payload.email_verified !== true) {
      response.status(403).json({ error: "This Google account email is not verified yet." });
      return;
    }

    if (allowedDomain && !payload.email.toLowerCase().endsWith(`@${allowedDomain}`)) {
      response.status(403).json({ error: `Please sign in with a verified ${allowedDomain} account.` });
      return;
    }

    response.json({
      user: {
        name: payload.name || payload.given_name || "SafeBite User",
        email: payload.email,
        picture: payload.picture || "",
        provider: "google",
      },
    });
  } catch (error) {
    response.status(401).json({ error: error.message || "Google verification failed." });
  }
});

app.listen(port, () => {
  console.log(`SafeBite API listening on http://localhost:${port}`);
});