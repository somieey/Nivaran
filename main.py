from fastapi import FastAPI, UploadFile, File, Form, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import pdfplumber
import pytesseract
from PIL import Image
from groq import Groq
import os, re, shutil, json, hashlib
import mysql.connector
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
import os
from dotenv import load_dotenv
load_dotenv()

# ⚠️ Windows users uncomment this:
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Config ─────────────────────────────────────────────────────────────────────
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
JWT_SECRET = "nivaran_super_secret_key_for_jwt_authentication_2024_hackathon"
JWT_EXPIRE_HOURS = 24
UPLOAD_DIR = "uploads"
RAG_DIR = "rag_docs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RAG_DIR, exist_ok=True)

client = Groq(api_key=GROQ_API_KEY)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# ── MySQL Connection ───────────────────────────────────────────────────────────
def get_db():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="nivaran123",  
        database="nivaran_db"
    )

# ── JWT Helpers ────────────────────────────────────────────────────────────────
def create_token(user_id: int, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        return payload
    except:
        return None

# ── Text Extraction ────────────────────────────────────────────────────────────
def extract_text(file_path: str, filename: str) -> str:
    ext = filename.lower().split(".")[-1]
    text = ""
    if ext == "pdf":
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
        except Exception as e:
            text = f"PDF error: {str(e)}"
    elif ext in ["png", "jpg", "jpeg"]:
        try:
            image = Image.open(file_path)
            text = pytesseract.image_to_string(image)
        except Exception as e:
            text = f"OCR error: {str(e)}"
    return text.strip()

# ── Groq AI ────────────────────────────────────────────────────────────────────
def ask_groq(prompt: str) -> str:
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2000,
        temperature=0.3,
    )
    return response.choices[0].message.content

# ── RAG System ─────────────────────────────────────────────────────────────────
# We store government document knowledge as text chunks
# and use them to give better context to our AI

GOV_KNOWLEDGE = """
PASSPORT APPLICATION INDIA:
- Apply at passportindia.gov.in
- Fresh passport fee: Rs 1500 (36 pages), Rs 2000 (60 pages)
- Tatkaal fee: Additional Rs 2000
- Documents needed: Aadhaar, Birth Certificate, Address Proof
- Processing time: 30-45 days normal, 7-14 days tatkaal
- Minor passport valid for 5 years, Adult for 10 years

AADHAAR CARD:
- Issued by UIDAI
- 12 digit unique identity number
- Update at uidai.gov.in or nearest Aadhaar centre
- Mandatory for PAN, passport, bank accounts

PAN CARD:
- Issued by Income Tax Department
- 10 character alphanumeric: ABCDE1234F format
- Apply at tin-nsdl.com or utiitsl.com
- Fee: Rs 107 (India), Rs 1017 (abroad)
- Required for filing taxes, bank accounts above Rs 50000

DRIVING LICENSE:
- Apply at parivahan.gov.in
- Learner license first, then permanent after 30 days
- Documents: Age proof, address proof, medical certificate
- Fee varies by state: Rs 200-500

VOTER ID:
- Apply at nvsp.in or voterportal.eci.gov.in
- Free of cost
- Documents: Age proof, address proof, photo

RATION CARD:
- Apply at state food department website
- Types: APL, BPL, AAY
- Documents: Income proof, residence proof, family photos

GST REGISTRATION:
- Apply at gst.gov.in
- Mandatory if turnover above Rs 20 lakhs
- Documents: PAN, Aadhaar, business address proof, bank details
- Free registration, no fee

BIRTH CERTIFICATE:
- Apply at municipal corporation or gram panchayat
- Within 21 days of birth - free
- After 21 days - fee applicable
- Required for school admission, passport, voter ID

INCOME CERTIFICATE:
- Apply at tehsildar or district collectorate
- Required for scholarships, reservations
- Valid for 1 year typically
"""

def get_rag_context(document_text: str) -> str:
    """Simple RAG: find relevant government knowledge based on document content"""
    doc_lower = document_text.lower()
    relevant = []

    keywords = {
        "passport": ["PASSPORT APPLICATION INDIA"],
        "aadhaar": ["AADHAAR CARD"],
        "pan": ["PAN CARD"],
        "driving": ["DRIVING LICENSE"],
        "voter": ["VOTER ID"],
        "ration": ["RATION CARD"],
        "gst": ["GST REGISTRATION"],
        "birth": ["BIRTH CERTIFICATE"],
        "income certificate": ["INCOME CERTIFICATE"],
    }

    sections = {}
    current_key = None
    for line in GOV_KNOWLEDGE.strip().split("\n"):
        if line.endswith(":") and line.isupper():
            current_key = line[:-1]
            sections[current_key] = []
        elif current_key:
            sections[current_key].append(line)

    matched_sections = set()
    for keyword, section_names in keywords.items():
        if keyword in doc_lower:
            for name in section_names:
                if name in sections:
                    matched_sections.add(name)

    if not matched_sections:
        # Return all knowledge if no specific match
        return GOV_KNOWLEDGE[:2000]

    result = ""
    for name in matched_sections:
        result += f"\n{name}:\n" + "\n".join(sections.get(name, [])) + "\n"

    return result

# ── Personal Info Extraction ───────────────────────────────────────────────────
def extract_personal_info(text: str) -> dict:
    info = {}
    lines = text.split('\n')

    def get_field_value(text, patterns):
        """Extract value only from the same line as the label"""
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                val = match.group(1).strip()
                # Remove any labels that got mixed in
                val = re.split(r'(?i)(mother|father|address|email|phone|mobile|dob|gender|pan|aadhaar)', val)[0].strip()
                if val and len(val) > 1:
                    return val
        return None

    # Name — only from "Full Name:" or "Name:" line
    for line in lines:
        if re.search(r'(?i)^(full\s*)?name\s*:', line):
            match = re.search(r'(?i)(?:full\s*)?name\s*:\s*(.+)', line)
            if match:
                val = match.group(1).strip()
                # Make sure it's actually a name (only letters and spaces)
                val = re.split(r'(?i)(mother|father|dob|gender|email|phone|address)', val)[0].strip()
                if val and re.match(r'^[A-Za-z\s]+$', val):
                    info["name"] = val
                    break

    # DOB — look for date patterns on DOB line only
    for line in lines:
        if re.search(r'(?i)(dob|date of birth|birth date)', line):
            match = re.search(r'(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})', line)
            if match:
                info["dob"] = match.group(1)
                break

    # Phone — must be 10 digits starting with 6-9
    for line in lines:
        if re.search(r'(?i)(phone|mobile|contact)', line):
            match = re.search(r'\b([6-9]\d{9})\b', line)
            if match:
                info["phone"] = match.group(1)
                break
    if "phone" not in info:
        match = re.search(r'\b([6-9]\d{9})\b', text)
        if match:
            info["phone"] = match.group(1)

    # Email — standard pattern, but NOT as address
    match = re.search(r'\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b', text)
    if match:
        info["email"] = match.group(1)

    # Aadhaar — exactly 12 digits (in groups of 4)
    match = re.search(r'\b(\d{4}\s?\d{4}\s?\d{4})\b', text)
    if match:
        info["aadhaar"] = match.group(1).replace(" ", "")

    # PAN — exactly ABCDE1234F format
    match = re.search(r'\b([A-Z]{5}[0-9]{4}[A-Z])\b', text)
    if match:
        info["pan"] = match.group(1)

    # Gender
    for line in lines:
        if re.search(r'(?i)gender', line):
            match = re.search(r'(?i)(male|female|other)', line)
            if match:
                info["gender"] = match.group(1).capitalize()
                break

    # Father's name — ONLY from father's name line, stop before next field
    for line in lines:
        if re.search(r'(?i)father', line) and not re.search(r'(?i)mother', line):
            match = re.search(r'(?i)father[\'s\s]*name\s*:\s*([A-Za-z\s]+)', line)
            if match:
                val = match.group(1).strip()
                # Stop at any other keyword
                val = re.split(r'(?i)(mother|address|email|phone|dob|gender)', val)[0].strip()
                if val and re.match(r'^[A-Za-z\s]+$', val):
                    info["father_name"] = val
                    break

    # Address — ONLY from address line, exclude email
    for line in lines:
        if re.search(r'(?i)^address', line):
            match = re.search(r'(?i)address\s*:\s*(.+)', line)
            if match:
                val = match.group(1).strip()
                # Exclude if it looks like an email
                if '@' not in val and len(val) > 5:
                    info["address"] = val
                    break

    # PIN Code — exactly 6 digits
    for line in lines:
        if re.search(r'(?i)(pin|pincode)', line):
            match = re.search(r'\b(\d{6})\b', line)
            if match:
                info["pincode"] = match.group(1)
                break
    if "pincode" not in info:
        # Fallback: find 6 digit number that's not part of Aadhaar
        for match in re.finditer(r'\b(\d{6})\b', text):
            val = match.group(1)
            if val not in info.get("aadhaar", ""):
                info["pincode"] = val
                break

    return info

# ── Mismatch Detection ─────────────────────────────────────────────────────────
def check_mismatches(info_list: list) -> list:
    mismatches = []
    if len(info_list) < 2:
        return mismatches

    fields_to_check = ["name", "dob", "aadhaar", "pan"]
    field_labels = {
        "name": "Full Name",
        "dob": "Date of Birth",
        "aadhaar": "Aadhaar Number",
        "pan": "PAN Number"
    }

    merged = {}
    sources = {}
    doc_names = [f"Document {i+1}" for i in range(len(info_list))]

    for i, info in enumerate(info_list):
        for field in fields_to_check:
            if field in info and info[field]:
                val = info[field].strip().lower().replace(" ", "")
                if field in merged:
                    existing = merged[field].strip().lower().replace(" ", "")
                    if val != existing:
                        mismatches.append({
                            "field": field_labels.get(field, field),
                            "value1": merged[field],
                            "source1": sources[field],
                            "value2": info[field],
                            "source2": doc_names[i]
                        })
                else:
                    merged[field] = info[field]
                    sources[field] = doc_names[i]

    return mismatches


# ════════════════════════════════════════════════════════════════════════════════
# AUTH ROUTES
# ════════════════════════════════════════════════════════════════════════════════

@app.post("/register")
async def register(request: Request):
    body = await request.json()
    full_name = body.get("full_name", "").strip()
    email = body.get("email", "").strip()
    password = body.get("password", "")

    if not full_name or not email or not password:
        raise HTTPException(status_code=400, detail="All fields are required")

    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    hashed = pwd_context.hash(password)

    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO users (full_name, email, password_hash) VALUES (%s, %s, %s)",
            (full_name, email, hashed)
        )
        db.commit()
        user_id = cursor.lastrowid

        # Create empty profile
        cursor.execute(
            "INSERT INTO user_profiles (user_id) VALUES (%s)",
            (user_id,)
        )
        db.commit()
        cursor.close()
        db.close()

        token = create_token(user_id, email)
        return {"success": True, "token": token, "full_name": full_name, "email": email}

    except mysql.connector.IntegrityError:
        raise HTTPException(status_code=400, detail="Email already registered")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/login")
async def login(request: Request):
    body = await request.json()
    email = body.get("email", "").strip()
    password = body.get("password", "")

    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        cursor.close()
        db.close()

        if not user or not pwd_context.verify(password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        token = create_token(user["id"], user["email"])
        return {
            "success": True,
            "token": token,
            "full_name": user["full_name"],
            "email": user["email"]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/profile")
async def get_profile(user=Depends(verify_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM user_profiles WHERE user_id = %s",
            (user["user_id"],)
        )
        profile = cursor.fetchone()
        cursor.close()
        db.close()
        return {"success": True, "data": profile or {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/profile/save")
async def save_profile(request: Request, user=Depends(verify_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    fields = ["name","dob","phone","email","aadhaar","pan","address","gender","father_name","pincode"]
    try:
        db = get_db()
        cursor = db.cursor()
        set_clause = ", ".join([f"{f} = %s" for f in fields])
        values = [body.get(f, "") for f in fields]
        values.append(user["user_id"])
        cursor.execute(
            f"UPDATE user_profiles SET {set_clause} WHERE user_id = %s",
            values
        )
        db.commit()
        cursor.close()
        db.close()
        return {"success": True, "message": "Profile saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ════════════════════════════════════════════════════════════════════════════════
# DOCUMENT ROUTES
# ════════════════════════════════════════════════════════════════════════════════

@app.post("/analyze-document")
async def analyze_document(
    file: UploadFile = File(...),
    language: str = Form("English"),
    user=Depends(verify_token)
):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    text = extract_text(file_path, file.filename)

    if not text:
        return JSONResponse(content={"error": "Could not extract text."}, status_code=400)

    # RAG: get relevant government knowledge
    rag_context = get_rag_context(text)

    prompt = f"""
You are Nivaran, an AI assistant helping Indian citizens understand government documents.
You have access to verified government information below.

VERIFIED GOVERNMENT KNOWLEDGE:
{rag_context}

Using the above knowledge AND the uploaded document, analyze and respond ONLY in this exact JSON format:
{{
  "summary": "2-3 sentence simple explanation in {language}",
  "required_documents": ["doc1", "doc2"],
  "fees": "fee details or Not specified",
  "deadlines": "deadline info or Not specified",
  "eligibility": ["criteria1", "criteria2"],
  "steps": ["Step 1: do this", "Step 2: do that"]
}}

Uploaded Document:
{text[:3000]}
"""

    try:
        result = ask_groq(prompt).strip()
        # Aggressively clean the response
        if "```json" in result:
            result = result.split("```json")[1].split("```")[0]
        elif "```" in result:
            result = result.split("```")[1].split("```")[0]
        result = result.strip()
        parsed = json.loads(result)
        
        if user:
            try:
                db = get_db()
                cursor = db.cursor()
                cursor.execute(
                    "INSERT INTO document_history (user_id, filename, summary) VALUES (%s, %s, %s)",
                    (user["user_id"], file.filename, parsed.get("summary", ""))
                )
                db.commit()
                cursor.close()
                db.close()
            except:
                pass

        return {"success": True, "data": parsed}

    except json.JSONDecodeError:
        # Ask groq again with stricter prompt
        strict_prompt = f"""
Return ONLY a JSON object. No explanation. No markdown. Just the raw JSON.
{{
  "summary": "explain this document in 2 sentences in {language}",
  "required_documents": ["list", "of", "documents"],
  "fees": "fee amount",
  "deadlines": "deadline info or Not specified",
  "eligibility": ["who can apply"],
  "steps": ["Step 1", "Step 2"]
}}

Document:
{text[:2000]}
"""
        try:
            result2 = ask_groq(strict_prompt).strip()
            result2 = result2.replace("```json","").replace("```","").strip()
            parsed2 = json.loads(result2)
            return {"success": True, "data": parsed2}
        except:
            return {
                "success": True,
                "data": {
                    "summary": result if 'result' in dir() else "Please try uploading the document again.",
                    "required_documents": [],
                    "fees": "Not specified",
                    "deadlines": "Not specified",
                    "eligibility": [],
                    "steps": []
                }
            }


@app.post("/extract-personal-info")
async def extract_personal_info_route(
    files: list[UploadFile] = File(...),
    user=Depends(verify_token)
):
    all_info_list = []
    merged_info = {}

    for file in files:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        text = extract_text(file_path, file.filename)
        if not text:
            continue

        info = extract_personal_info(text)

        # Also use AI to fill gaps
        prompt = f"""
Extract personal information from this Indian ID document.
Respond ONLY in JSON format (null for missing, no extra text):
{{
  "name": "full name or null",
  "dob": "DD/MM/YYYY or null",
  "phone": "10-digit number or null",
  "email": "email or null",
  "aadhaar": "12-digit number or null",
  "pan": "PAN number or null",
  "address": "full address or null",
  "gender": "Male/Female/Other or null",
  "father_name": "father name or null",
  "pincode": "6-digit PIN or null"
}}

Document:
{text[:2000]}
"""
        try:
            ai_result = ask_groq(prompt).strip()
            ai_result = ai_result.replace("```json","").replace("```","").strip()
            ai_info = json.loads(ai_result)
            for key, value in ai_info.items():
                if value and key not in info:
                    info[key] = value
        except:
            pass

        all_info_list.append(info)
        for k, v in info.items():
            if v and k not in merged_info:
                merged_info[k] = v

    # Check for mismatches
    mismatches = check_mismatches(all_info_list)

    # Save to user profile if logged in
    if user and merged_info:
        try:
            db = get_db()
            cursor = db.cursor()
            fields = ["name","dob","phone","email","aadhaar","pan","address","gender","father_name","pincode"]
            set_clause = ", ".join([f"{f} = %s" for f in fields if f in merged_info])
            if set_clause:
                values = [merged_info.get(f) for f in fields if f in merged_info]
                values.append(user["user_id"])
                field_names = [f for f in fields if f in merged_info]
                set_clause = ", ".join([f"{f} = %s" for f in field_names])
                cursor.execute(
                    f"UPDATE user_profiles SET {set_clause} WHERE user_id = %s",
                    values
                )
                db.commit()
            cursor.close()
            db.close()
        except:
            pass

    return {
        "success": True,
        "data": merged_info,
        "mismatches": mismatches
    }


@app.post("/chat")
async def chat_with_document(request: Request):
    body = await request.json()
    question = body.get("question", "")
    context = body.get("context", "")
    language = body.get("language", "English")

    rag_context = get_rag_context(context)

    prompt = f"""
You are Nivaran, helping Indian citizens with government documents.

VERIFIED GOVERNMENT KNOWLEDGE:
{rag_context}

Document context:
{context[:2000]}

Answer this question simply and clearly in {language}:
{question}
"""
    try:
        result = ask_groq(prompt)
        return {"success": True, "answer": result}
    except:
        return {"success": False, "answer": "Could not get answer. Try again."}


@app.get("/")
def root():
    return {"message": "Nivaran Backend Running ✅"}