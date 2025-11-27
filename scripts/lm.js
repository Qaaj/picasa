import fetch from "node-fetch";

const LM_URL = "http://localhost:1234/v1/chat/completions"; // adjust if needed

export async function annotateImage(buffer) {
  const base64 = buffer.toString("base64");

  const body = {
    model: "qwen/qwen3-vl-4b",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Return ONLY JSON: {title: string, tags: string[], description: string}",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64}`,
            },
          },
        ],
      },
    ],
  };

  const res = await fetch(LM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  // Grab the assistant text
  const text = json?.choices?.[0]?.message?.content ?? "{}";

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { error: "invalid JSON returned", raw: text };
  }

  return parsed;
}
