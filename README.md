
# ResumeAI API — Deep Endpoint Documentation

## Overview
ResumeAI is a backend API for resume processing, formatting, and improvement. It provides endpoints for uploading resumes, generating formatted documents, and applying suggestions to improve resume content. All endpoints are built with Express and accept multipart/form-data for file uploads.

---

## Endpoints & Usage

### 1. POST `/resume/upload`
**Purpose:** Upload a resume file and extract metadata/content.
**Middleware:** `uploadSingle` (handles single file upload)

#### JS Example
```js
const formData = new FormData();
formData.append('resume', fileInput.files[0]);
formData.append('options', JSON.stringify({ validateStructure: true }));

fetch('http://localhost:3000/resume/upload', {
  method: 'POST',
  body: formData
})
  .then(res => res.json())
  .then(console.log);
```

#### Response Body
```json
{
  "success": true,
  "data": {
    "filename": "1646789012345-resume.docx",
    "originalName": "resume.docx",
    "content": "John Doe\nSoftware Engineer...",
    "size": 123456,
    "path": "uploads/resumes/1646789012345-resume.docx",
    "uploadedAt": "2026-03-08T12:34:56.789Z",
    "pages": 2,
    "author": "John Doe",
    "title": "Resume"
  },
  "message": "Successfully extracted resume content.",
  "timestamp": "2026-03-08T12:34:56.789Z"
}
```

#### Error Response
```json
{
  "success": false,
  "data": null,
  "message": "No resume file uploaded",
  "timestamp": "2026-03-08T12:34:56.789Z"
}
```

---

### 2. POST `/resume/generate`
**Purpose:** Reformat uploaded resume into a styled DOCX template
**Middleware:** `uploadMemory` (handles file upload in memory)

#### JS Example
```js
const formData = new FormData();
formData.append('resume', fileInput.files[0]);

fetch('http://localhost:3000/resume/generate', {
  method: 'POST',
  body: formData
})
  .then(res => res.blob())
  .then(blob => {
    // Download the formatted DOCX
    const url = URL.createObjectURL(blob);
    window.open(url);
  });
```

#### Response
- Returns a DOCX file as attachment (`resume_formatted.docx`).
- Content-Type: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Content-Disposition: `attachment; filename="resume_formatted.docx"`

#### Error Response
```json
{
  "success": false,
  "data": null,
  "message": "No file uploaded",
  "timestamp": "2026-03-08T12:34:56.789Z"
}
```

---

### 3. POST `/resume/apply-suggestions`
**Purpose:** Inject improved content into the original resume template
**Middleware:** `uploadMemory` (handles file upload in memory)

#### JS Example
```js
const formData = new FormData();
formData.append('resume', fileInput.files[0]);
formData.append('suggestions', JSON.stringify({ summary: "Improved summary", skills: [{ category: "Programming", items: "JavaScript, TypeScript" }] }));

fetch('http://localhost:3000/resume/apply-suggestions', {
  method: 'POST',
  body: formData
})
  .then(res => res.blob())
  .then(blob => {
    // Download the improved DOCX
    const url = URL.createObjectURL(blob);
    window.open(url);
  });
```

#### Response
- Returns a DOCX file as attachment (`resume_improved.docx`).
- Content-Type: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Content-Disposition: `attachment; filename="resume_improved.docx"`

#### Error Response
```json
{
  "success": false,
  "data": null,
  "message": "No file uploaded",
  "timestamp": "2026-03-08T12:34:56.789Z"
}
```
```json
{
  "success": false,
  "data": null,
  "message": "No suggestions provided",
  "timestamp": "2026-03-08T12:34:56.789Z"
}
```

---

### 4. GET `/test/`
**Purpose:** Simple test endpoint to verify API is running

#### JS Example
```js
fetch('http://localhost:3000/test/')
  .then(res => res.json())
  .then(console.log);
```

#### Response Body
```json
{
  "data": "Received"
}
```

---

## Error Handling
- All endpoints return structured error responses with HTTP status codes and messages.
- Common errors: missing file, invalid file, missing suggestions, internal server errors.

---

## Supported File Types
- DOCX, PDF, DOC (PDFs are converted internally)
- Max file size: 10MB

---

## License
This project is licensed under ISC.
