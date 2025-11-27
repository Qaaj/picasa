import axios from "axios";

export async function embedText(text) {
  const LMSTUDIO_URL = "http://localhost:1234/v1/embeddings";

  console.log("EMBEDDING", text);
  try {
    const response = await axios.post(LMSTUDIO_URL, {
      model: "text-embedding-snowflake-arctic-embed-m-v1.5", // or your exact LM Studio model name
      input: text,
    });

    return response.data.data[0].embedding; // float array
  } catch (err) {
    console.error("Text embed failed:", err.response?.data || err);
    return null;
  }
}
