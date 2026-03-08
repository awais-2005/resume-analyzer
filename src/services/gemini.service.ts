import { GoogleGenAI } from '@google/genai';
import { StructuredResume } from '../types/structuredResume.types';
import { ResumeAnalysis } from '../types/ResumeAnalysis';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export class GeminiService {

  async analyzeResume(resumeContent: string): Promise<ResumeAnalysis> {

    const prompt = `
You are an ATS (Applicant Tracking System) resume analyzer used by recruiters.

Analyze the resume content and return a structured evaluation.

Evaluation Criteria:
- ATS keyword compatibility
- grammar and writing clarity
- formatting suitability for ATS parsing
- strength of experience descriptions
- measurable achievements
- relevance of skills

Scoring Rules:
- Score must be between 0 and 100.
- Grade mapping:
  90-100 = A
  80-89 = B
  70-79 = C
  60-69 = D
  <60 = F

Grammar issues must include:
- original problematic text
- corrected suggestion
- sentence context

IMPORTANT OUTPUT RULES:
- Return ONLY valid JSON.
- Do NOT include explanations.
- Do NOT include markdown.
- Do NOT include code blocks.
- Do NOT include comments.
- Do NOT include text before or after the JSON.
- The response MUST start with { and end with }.
- The JSON must strictly follow the schema below.

Schema:

{
  "overallScore": number,
  "atsScore": number,
  "formattingScore": number,
  "keywordScore": number,
  "impactScore": number,
  "grade": "A" | "B" | "C" | "D" | "F",
  "strengths": string[],
  "weaknesses": string[],
  "grammarIssues": [
    {
      "original": string,
      "suggestion": string,
      "context": string
    }
  ],
  "keywordSuggestions": string[],
  "formattingTips": string[],
  "overallFeedback": string
}

Resume Content:
${resumeContent}
`
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text ?? "";
    let parsed: ResumeAnalysis;
    try {
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      const cleanJson = text.slice(jsonStart, jsonEnd + 1);
      parsed = JSON.parse(cleanJson);
    } catch (error) {
      throw new Error("Failed to parse ATS analysis response");
    }

    return parsed;
  }

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
