# ResumeAI API — Endpoint Documentation

## Overview
ResumeAI is a backend API for resume processing, formatting, and improvement. It provides endpoints for uploading resumes, generating formatted documents, and applying suggestions to improve resume content. All endpoints are built with Express and accept multipart/form-data for file uploads.

---

## Endpoints

### 1. POST `/resume/upload`
- **Purpose:** Upload a resume file and extract metadata/content.
- **Middleware:** `uploadSingle` (handles single file upload)
- **Request:**
  - Content-Type: `multipart/form-data`
  - Fields:
    - `file`: Resume file (DOCX, PDF, etc.)
    - `options` (optional): JSON string for processing options
- **Response:**
  - 200 OK: `{ success: true, data: { filename, originalName, size, path, uploadedAt, ...extractedMetadata }, message: 'Successfully extracted resume content.' }`
  - 404/422: Error if file missing or invalid

---

### 2. POST `/resume/generate`
- **Purpose:** Reformat uploaded resume into a styled DOCX template
- **Middleware:** `uploadMemory` (handles file upload in memory)
- **Request:**
  - Content-Type: `multipart/form-data`
  - Fields:
    - `file`: Resume file (DOCX, PDF, etc.)
- **Response:**
  - 200 OK: Returns a DOCX file (`resume_formatted.docx`) as attachment
  - 400: Error if file missing

---

### 3. POST `/resume/apply-suggestions`
- **Purpose:** Inject improved content into the original resume template
- **Middleware:** `uploadMemory` (handles file upload in memory)
- **Request:**
  - Content-Type: `multipart/form-data`
  - Fields:
    - `file`: Resume file (DOCX, PDF, etc.)
    - `suggestions`: JSON string with improved content
- **Response:**
  - 200 OK: Returns a DOCX file (`resume_improved.docx`) as attachment
  - 400: Error if file or suggestions missing

---

### 4. GET `/test/`
- **Purpose:** Simple test endpoint to verify API is running
- **Request:** None
- **Response:**
  - 200 OK: `{ data: "Received" }`

---

## Error Handling
- All endpoints return structured error responses with HTTP status codes and messages.
- Common errors: missing file, invalid file, missing suggestions, internal server errors.

---

## Example Requests

### Upload Resume
```bash
curl -X POST http://localhost:PORT/resume/upload \
  -F "file=@resume.docx" \
  -F "options={\"parseSkills\":true}"
```

### Generate Formatted Resume
```bash
curl -X POST http://localhost:PORT/resume/generate \
  -F "file=@resume.docx"
```

### Apply Suggestions
```bash
curl -X POST http://localhost:PORT/resume/apply-suggestions \
  -F "file=@resume.docx" \
  -F "suggestions={\"summary\":\"Improved summary\"}"
```

### Test Endpoint
```bash
curl http://localhost:PORT/test/
```

---

## Notes
- Replace `PORT` with your server's port (default: 3000 or as configured).
- All file uploads must use `multipart/form-data`.
- Supported file types: DOCX, PDF (PDFs are converted internally).

---

## License
This project is licensed under ISC.
