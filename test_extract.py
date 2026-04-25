import pytesseract
from PIL import Image

# ⚠️ Windows users - uncomment this line and set your path:
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

text = pytesseract.image_to_string(Image.open("personal_details_test.png"))
print(text)