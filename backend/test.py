import pickle
import pprint

import jsonpickle
import requests

API_URL = "http://127.0.0.1:10002/"
IMAGE_PATH = "test.jpg"
SAVE_RESULT = "faces.pkl"


def main():
    print("Loading image…")
    with open(IMAGE_PATH, "rb") as stream:
        frame_bytestring = stream.read()

    data = {"image": frame_bytestring}
    encoded = jsonpickle.encode(data)

    print("Sending request to face-rec container…")
    response = requests.post(API_URL, json=encoded, timeout=180)

    print("Decoding jsonpickle response…")
    decoded = jsonpickle.decode(response.text)

    raw = decoded.get("face_detection_recognition")

    if raw is None:
        print("❌ No face_detection_recognition in response")
        print("\nRAW RESPONSE:")
        print(response.text)
        return

    print("\n================ RAW STRUCTURE ================\n")
    pprint.pprint(raw)
    print("\n================================================\n")

    # Handle list-of-face-dicts
    if isinstance(raw, list):
        faces = raw
        print(f"Detected {len(faces)} faces (list mode).")

        for i, face in enumerate(faces):
            print(f"\n---- FACE {i} ----")
            if not isinstance(face, dict):
                print("⚠️ Face is not a dict, skipping:", face)
                continue

            if "bbox" in face:
                print("Bounding box:", face["bbox"])

            if "kps" in face:
                print("Landmarks:", face["kps"])

            if "embedding" in face:
                emb = face["embedding"]
                print("Embedding length:", len(emb))
                print("First 10 dims:", emb[:10])

            if "scale" in face:
                print("Scale:", face["scale"])

    # Handle dict-of-lists format
    elif isinstance(raw, dict):
        print("Detected dict-of-arrays structure.")

        bboxes = raw.get("bboxes", [])
        kpss = raw.get("kpss", [])
        embeddings = raw.get("embeddings", [])

        count = len(bboxes)
        print(f"Detected {count} faces (dict mode).")

        for i in range(count):
            print(f"\n---- FACE {i} ----")
            print("Bounding box:", bboxes[i])

            if i < len(kpss):
                print("Landmarks:", kpss[i])

            if i < len(embeddings):
                emb = embeddings[i]
                print("Embedding length:", len(emb))
                print("First 10 dims:", emb[:10])

    else:
        print("❌ Unsupported format for face_detection_recognition")
        return

    print(f"\nSaving raw face data to {SAVE_RESULT}")
    with open(SAVE_RESULT, "wb") as out:
        pickle.dump(raw, out)

    print("Done!")


if __name__ == "__main__":
    main()
