import os
import openai
import fitz  # PyMuPDF
from PIL import Image, ImageEnhance, ImageFilter
import pytesseract
import pandas as pd
import shutil

def load_env_file(env_path):
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(os.path.join(os.path.dirname(__file__), ".env"))

# Set the Tesseract executable path for Windows
pytesseract.pytesseract.tesseract_cmd = os.getenv(
    "TESSERACT_CMD",
    r'C:\Program Files\Tesseract-OCR\tesseract.exe'
)

# Set OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    raise RuntimeError("OPENAI_API_KEY is not set. Create PythonProjectDatabaseFeeder/.env from .env.example.")

def extract_images_from_pdf(pdf_path, output_dir):
    try:
        pdf_document = fitz.open(pdf_path)
    except Exception as e:
        print(f"Error opening PDF {pdf_path}: {e}", flush=True)
        return []

    image_paths = []
    for page_num in range(len(pdf_document)):
        try:
            page = pdf_document.load_page(page_num)
            pix = page.get_pixmap()
            image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            image_path = os.path.join(output_dir, f"{os.path.splitext(os.path.basename(pdf_path))[0]}_page_{page_num + 1}.png")
            image.save(image_path)
            image_paths.append(image_path)
            print(f"Extracted image from {pdf_path}, page {page_num + 1} saved to {image_path}", flush=True)
        except Exception as e:
            print(f"Error extracting image from {pdf_path}, page {page_num + 1}: {e}", flush=True)
    return image_paths

def preprocess_image(image_path):
    image = Image.open(image_path)
    # Convert to grayscale
    image = image.convert('L')
    # Apply contrast enhancement
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(2)
    # Apply sharpening filter
    image = image.filter(ImageFilter.SHARPEN)
    return image

def perform_ocr(image_path):
    try:
        image = preprocess_image(image_path)
        text = pytesseract.image_to_string(image, config='--psm 6')
        print(f"OCR result for {image_path}: {text[:100]}...", flush=True)  # Print first 100 characters of OCR result
        return text
    except Exception as e:
        print(f"Error performing OCR on {image_path}: {e}", flush=True)
        return ""

def parse_ocr_text_with_openai(ocr_text):
    prompt = f"Extract the following information from the text:\n\n{ocr_text}\n\n"\
             "Format the information as JSON with the following keys: "\
             "'Simple object name', 'ID number', 'Title', 'Date received', "\
             "'Brief description', 'Donated/loan by', 'Date (Donation/loan)', "\
             "'Copyright', 'Associated people', 'Associated places', 'Home location', "\
             "'Date (Home location)', 'Current location', 'Date (Current location)'."
    
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt}
            ]
        )
        extracted_info = response['choices'][0]['message']['content'].strip()
        return eval(extracted_info)
    except Exception as e:
        print(f"Error parsing OCR text with OpenAI: {e}", flush=True)
        return {}

def save_to_excel(data_list, output_excel_path):
    try:
        df = pd.DataFrame(data_list)
        df.to_excel(output_excel_path, index=False)
        print(f"Saved structured OCR results to {output_excel_path}", flush=True)
    except Exception as e:
        print(f"Error saving to Excel {output_excel_path}: {e}", flush=True)

def check_confidence_and_add_flag(ocr_texts, image_paths, threshold, manual_check_dir):
    os.makedirs(manual_check_dir, exist_ok=True)
    flagged_data = []
    for text, image_path in zip(ocr_texts, image_paths):
        try:
            data = pytesseract.image_to_data(Image.open(image_path), output_type=pytesseract.Output.DICT)
            confidences = [int(conf) for conf in data['conf'] if conf.isdigit()]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            print(f"Average confidence for {image_path}: {avg_confidence}", flush=True)
            needs_manual_check = avg_confidence < threshold
            if needs_manual_check:
                shutil.move(image_path, os.path.join(manual_check_dir, os.path.basename(image_path)))
                print(f"Moved {image_path} to {manual_check_dir} due to low confidence", flush=True)
            flagged_data.append((image_path, needs_manual_check))
        except Exception as e:
            print(f"Error checking confidence for {image_path}: {e}", flush=True)
            flagged_data.append((image_path, True))
    return flagged_data

# Directory containing PDFs to process
pdf_directory = 'pdf_paths'
output_dir = 'output'
output_excel_path = os.path.join(output_dir, 'ocr_results.xlsx')
manual_check_dir = os.path.join(output_dir, 'manual_check')

# Create the output directory if it doesn't exist
os.makedirs(output_dir, exist_ok=True)

all_data = []

# Process each PDF in the directory
for filename in os.listdir(pdf_directory):
    if filename.endswith('.pdf'):
        pdf_path = os.path.join(pdf_directory, filename)
        
        # Extract images
        image_paths = extract_images_from_pdf(pdf_path, output_dir)
        
        if not image_paths:
            print(f"No images extracted from {pdf_path}", flush=True)
            continue
        
        # Perform OCR and parse the text
        ocr_texts = [perform_ocr(image_path) for image_path in image_paths]
        
        if not any(ocr_texts):
            print(f"No text extracted from images of {pdf_path}", flush=True)
            continue
        
        parsed_data = [parse_ocr_text_with_openai(ocr_text) for ocr_text in ocr_texts]
        
        # Combine parsed data into one dictionary for each PDF
        combined_data = {}
        for data in parsed_data:
            for key, value in data.items():
                if key in combined_data:
                    combined_data[key] += f" {value}"
                else:
                    combined_data[key] = value
        
        # Check confidence and add flag for manual review
        flagged_data = check_confidence_and_add_flag(ocr_texts, image_paths, 85, manual_check_dir)
        
        # Add a flag to indicate if manual review is required
        combined_data['Requires Manual Check'] = any(flag for _, flag in flagged_data)
        
        all_data.append(combined_data)

# Save to Excel
save_to_excel(all_data, output_excel_path)

print(f"Processed PDFs and saved OCR results to {output_excel_path}", flush=True)
print(f"Low confidence images moved to {manual_check_dir}", flush=True)
