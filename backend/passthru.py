import base64

import jsonpickle
import numpy as np
import requests
from flask import Flask, jsonify, request

FACE_URL = "http://face:10002/"  # your face container

app = Flask(__name__)


def np_to_list(x):
    if isinstance(x, np.ndarray):
        return x.tolist()
    return x


@app.route("/", methods=["POST"])
def passthru():
    try:
        # 1. Read incoming JSON from Node
        incoming = request.get_json(force=True)

        # Node sends base64 string
        img_b64 = incoming["image"]

        # 2. Convert base64 → raw bytes
        frame_bytes = base64.b64decode(img_b64)

        # 3. Build structure identical to the working Python example:
        payload = {"image": frame_bytes}

        # 4. jsonpickle encode (critical)
        encoded = jsonpickle.encode(payload)

        # 5. Face server expects `json=encoded` (string)
        face_response = requests.post(
            FACE_URL,
            json=encoded,  # ← EXACTLY as original client
            timeout=180,
        )

        # Decode jsonpickle from face server
        decoded = jsonpickle.decode(face_response.text)

        faces = decoded.get("face_detection_recognition", [])

        clean = []
        for f in faces:
            bbox = np_to_list(np.array(f["bbox"]))
            lm = np_to_list(np.array(f["landmark"]).reshape(-1, 2))
            emb = np_to_list(np.array(f["normed_embedding"]))
            det = float(f["det_score"])

            clean.append(
                {
                    "bbox": bbox,
                    "det_score": det,
                    "landmark": lm,
                    "normed_embedding": emb,
                }
            )

        return jsonify({"faces": clean})

    except Exception as e:
        print("ERROR:", e)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7777)
