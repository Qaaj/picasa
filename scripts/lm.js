import http from "http";
import fetch from "node-fetch";

const noKeepAliveAgent = new http.Agent({ keepAlive: false });

export async function annotateImage(imageBuffer) {
  const base64 = imageBuffer.toString("base64");

  const payload = {
    model: "qwen/qwen3-vl-4b",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Return ONLY JSON: {title:string,tags:string[],description:string} - return in English only - max 500 chars",
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64}` },
          },
        ],
      },
    ],
  };

  const res = await fetch("http://localhost:1234/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },

    // 🔥 THIS IS THE FIX
    agent: noKeepAliveAgent,
  });

  if (!res.ok) {
    throw new Error(`LM Studio returned ${res.status}`);
  }

  const data = await res.json();

  let content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  // Safe parse since LLM sometimes returns trailing stuff
  try {
    return JSON.parse(content);
  } catch {
    console.error("Invalid JSON from LM:");
    console.error(content);
    return null;
  }
}
