import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Unauthorized" });

  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const bodySize = Buffer.byteLength(JSON.stringify(req.body));
  if (bodySize > 5 * 1024 * 1024) {
    return res.status(413).json({ error: "Request too large" });
  }
  
  const safeBody = {
    ...req.body,
    model: "claude-haiku-4-5-20251001",
    max_tokens: Math.min(req.body.max_tokens ?? 500, 500),
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(safeBody),
  });

  const data = await response.json();
  res.status(response.status).json(data);
}
