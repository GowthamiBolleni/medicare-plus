# MediCare+ Medicine Reminder & Health Tracker

MediCare+ is a modern, comprehensive medicine reminder and health tracker application. It allows users to track their daily vitals (BP, Heart Rate, Blood Sugar), manage emergency/family contacts, trigger SOS emergency panics with GPS coordination, and upload hospital bills for automatic AI-based expense/receipt OCR parsing.

---

## Technical Architecture

- **Backend**: FastAPI (Python), SQLite, SQLAlchemy, Uvicorn, APScheduler (Background notifications engine).
- **Frontend**: Vite + React, Vanilla CSS, Tailwind CSS.
- **AI Integrations**: Google Gemini (via `google-generativeai` package) for report summaries and health assistance.

---

## OCR scanned PDF dependencies (Critical)

Our bill/invoice parser supports advanced scanned document reading using `pytesseract` and `pdf2image` as a fallback when digital PDF extraction yields no text. This requires additional binaries on the server:

### 1. Poppler (Required for PDF to Image conversion)
Without **Poppler** installed, pdf conversion will fail on the server.
- **Debian/Ubuntu**:
  ```bash
  sudo apt-get update
  sudo apt-get install -y poppler-utils
  ```
- **macOS (via Homebrew)**:
  ```bash
  brew install poppler
  ```
- **Windows**:
  1. Download the latest compiled binaries from [poppler-windows](https://github.com/oschwartz10612/poppler-windows/releases).
  2. Extract it and add the `bin` folder to your system's Environment Variable `PATH`.

### 2. Tesseract OCR (Required for OCR Text extraction)
- **Debian/Ubuntu**:
  ```bash
  sudo apt-get install -y tesseract-ocr
  ```
- **macOS (via Homebrew)**:
  ```bash
  brew install tesseract
  ```
- **Windows**:
  1. Download the installer from UB Mannheim [tesseract-ocr-w64](https://github.com/UB-Mannheim/tesseract/wiki).
  2. Install and add the installation folder (usually `C:\Program Files\Tesseract-OCR`) to your system's Environment Variable `PATH`.

---

## Local Setup

### Backend
1. Navigate to backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. (Optional) Set up Environment variables:
   Create a `.env` file or export env variables:
   ```env
   ENV=development
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
4. Run development server:
   ```bash
   python -m uvicorn main:app --host 127.0.0.1 --port 8000
   ```

### Frontend
1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run development server:
   ```bash
   npm run dev
   ```
