import cv2
import numpy as np
import sys
from pathlib import Path


class BlurTool:
    def __init__(self, image_path):
        self.original = cv2.imread(image_path)

        if self.original is None:
            raise ValueError(f"Cannot load image: {image_path}")

        self.image = self.original.copy()
        self.mask = np.zeros(self.image.shape[:2], dtype=np.uint8)

        self.drawing = False
        self.brush_size = 20
        self.window_name = "Person / Object Blur Tool"

    # ===============================
    # Mouse drawing
    # ===============================
    def mouse_event(self, event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            self.drawing = True

        elif event == cv2.EVENT_MOUSEMOVE and self.drawing:
            cv2.circle(self.mask, (x, y), self.brush_size, 255, -1)
            self.update_preview()

        elif event == cv2.EVENT_LBUTTONUP:
            self.drawing = False
            self.update_preview()

    # ===============================
    # Update preview image
    # ===============================
    def update_preview(self):
        temp = self.image.copy()
        temp[self.mask > 0] = [0, 0, 255]  # highlight mask in red
        cv2.imshow(self.window_name, temp)

    # ===============================
    # Apply blur
    # ===============================
    def apply_blur(self):
        if not np.any(self.mask > 0):
            print("⚠️  No area selected!")
            return

        print("Blurring selected area...")
        blurred = cv2.GaussianBlur(self.image, (35, 35), 0)

        result = self.image.copy()
        result[self.mask > 0] = blurred[self.mask > 0]
        self.image = result
        self.update_preview()
        print("✔ Done")

    # ===============================
    # AI-style inpaint using OpenCV
    # ===============================
    def apply_inpaint(self):
        if not np.any(self.mask > 0):
            print("⚠️  No area selected!")
            return

        print("Inpainting with OpenCV...")
        result = cv2.inpaint(self.image, self.mask, 3, cv2.INPAINT_TELEA)
        self.image = result
        self.update_preview()
        print("✔ Done")

    # ===============================
    # Run main loop
    # ===============================
    def run(self):
        cv2.namedWindow(self.window_name, cv2.WINDOW_NORMAL)
        cv2.setMouseCallback(self.window_name, self.mouse_event)

        print("""
==========================================================
 PERSON / OBJECT BLUR TOOL
==========================================================
Use mouse to PAINT the area to remove/blur.

KEYS:
  SPACE  - Blur selected region
  I      - Inpaint (remove object)
  C      - Clear mask
  R      - Reset image
  S      - Save output
  + / -  - Change brush size
  Q      - Quit
==========================================================
""")

        self.update_preview()

        while True:
            k = cv2.waitKey(1) & 0xFF

            if k == ord("q"):
                break

            elif k == ord(" "):
                self.apply_blur()

            elif k == ord("i"):
                self.apply_inpaint()

            elif k == ord("c"):
                self.mask[:] = 0
                self.update_preview()
                print("Mask cleared")

            elif k == ord("r"):
                self.image = self.original.copy()
                self.mask[:] = 0
                self.update_preview()
                print("Reset")

            elif k in [ord("+"), ord("=")]:
                self.brush_size = min(100, self.brush_size + 5)
                print(f"Brush size: {self.brush_size}")

            elif k in [ord("-"), ord("_")]:
                self.brush_size = max(5, self.brush_size - 5)
                print(f"Brush size: {self.brush_size}")

            elif k == ord("s"):
                Path("output").mkdir(exist_ok=True)
                out_path = "output/output.jpg"
                cv2.imwrite(out_path, self.image)
                print(f"✔ Saved: {out_path}")

        cv2.destroyAllWindows()


# ===============================
# MAIN
# ===============================
def main():
    if len(sys.argv) < 2:
        print("Usage: python blur_tool.py input.jpg")
        return

    try:
        tool = BlurTool(sys.argv[1])
        tool.run()
    except Exception as e:
        print("Error:", e)


if __name__ == "__main__":
    main()
