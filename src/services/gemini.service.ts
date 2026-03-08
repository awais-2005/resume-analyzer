import { GoogleGenerativeAI } from '@google/generative-ai';
import { StructuredResume } from '../types/structuredResume.types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export class GeminiService {

  // Parse resume text → structured JSON via Gemini
  async parseResume(rawText: string): Promise<StructuredResume> {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `Extract this resume into structured JSON matching this exact schema.
Use empty strings for missing fields. Use empty arrays for missing array fields. Return ONLY the JSON object.

{
  "name": "string",
  "email": "string",
  "phone": "string",
  "location": "string",
  "linkedin": "string",
  "github": "string",
  "website": "string (portfolio or personal website, empty string if none)",
  "summary": "string",
  "experience": [
    {
      "title": "string",
      "company": "string",
      "location": "string",
      "dates": "string",
      "bullets": ["string"]
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "technologies": "string (comma-separated tech stack)",
      "link": "string (project URL if mentioned, empty string if none)",
      "dates": "string (time period if mentioned, empty string if none)",
      "bullets": ["string"]
    }
  ],
  "education": [
    {
      "degree": "string",
      "school": "string",
      "dates": "string",
      "details": "string"
    }
  ],
  "skills": [
    { "category": "string", "items": "string (comma-separated)" }
  ],
  "certifications": ["string"],
  "languages": ["string (spoken/written languages, e.g. 'English (Native)', 'Spanish (Fluent)')"]
}

Resume text:
${rawText}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/^```json|^```|```$/gm, '').trim();
    return JSON.parse(clean);
  }

  // Map improved content onto original DOCX text nodes
  async remapText(originalTexts: string[], improvedContent: StructuredResume): Promise<string[]> {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `You are given two things:

1. An ORDERED LIST of text snippets extracted from a resume DOCX file (these are all the text nodes in document order).
2. IMPROVED resume content as structured JSON.

Your job: return a JSON array of the same length as the text list.
For each index, write the improved version of that text snippet using the improved content.
- Preserve structural/label texts exactly (e.g. "Experience", "Education", "Skills", section headers, dates).
- Only replace actual content: names, bullet points, descriptions, contact info, summaries.
- If a snippet is a label, divider, or formatting text, keep it unchanged.
- Keep each replacement roughly the same length as the original.
- Return ONLY a JSON array of strings, same length as input. No explanation.

ORIGINAL TEXT NODES (${originalTexts.length} items):
${JSON.stringify(originalTexts, null, 2)}

IMPROVED CONTENT:
${JSON.stringify(improvedContent, null, 2)}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/^```json|^```|```$/gm, '').trim();
    const mapped: string[] = JSON.parse(clean);

    if (!Array.isArray(mapped) || mapped.length !== originalTexts.length) {
      throw new Error(`Gemini returned ${mapped?.length} items but expected ${originalTexts.length}`);
    }
    return mapped;
  }
}
