import pickle

import cv2
import jsonpickle
import numpy as np

INPUT_IMAGE = "test.jpg"
OUTPUT_IMAGE = "test_faces.jpg"
PICKLE_FILE = "faces.pkl"  # the one your test.py saved automatically


def main():
    # Load image
    img = cv2.imread(INPUT_IMAGE)
    if img is None:
        raise RuntimeError("Could not load test.jpg")

    # Load raw Python structures (not clean JSON)
    with open(PICKLE_FILE, "rb") as f:
        faces = pickle.load(f)  # list of dicts with numpy arrays

    print(f"Loaded {len(faces)} faces")

    for idx, face in enumerate(faces):
        bbox = np.array(face["bbox"])
        landmark = np.array(face["landmark"])

        # Extract coordinates
        x1, y1, x2, y2 = bbox.astype(int)

        # Draw bounding box
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 3)

        # Draw landmarks
        for lx, ly in landmark.astype(int):
            cv2.circle(img, (lx, ly), 4, (0, 0, 255), -1)

        # Put index label
        cv2.putText(
            img,
            f"Face {idx}",
            (x1, y1 - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2,
            cv2.LINE_AA,
        )

    cv2.imwrite(OUTPUT_IMAGE, img)
    print(f"Saved annotated image to {OUTPUT_IMAGE}")


if __name__ == "__main__":
    main()
