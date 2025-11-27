import axios from "axios";

export async function embedImageCLIP(base64Image) {
  const LMSTUDIO_URL = "http://localhost:1234/v1/embeddings";

  try {
    const response = await axios.post(LMSTUDIO_URL, {
      model: "mys/ggml_CLIP-ViT-B-32-laion2B-s34B-b79K",
      input: {
        image: base64Image,
      },
    });

    return response.data.data[0].embedding; // → 512-length float array
  } catch (err) {
    console.error("CLIP embed error:", err.response?.data || err);
    return null;
  }
}
