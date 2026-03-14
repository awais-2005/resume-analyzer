import { GoogleGenAI } from "@google/genai";
import { StructuredResume } from "../types/structuredResume.types";
import { ResumeAnalysis, ResumePolishContext } from "../types/ResumeAnalysis";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatResponse } from "../types/Responses";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export class GeminiService {

  private model: string = "gemini-3.1-flash-lite-preview"; // Default model, can be overridden in constructor

  private static instance: GeminiService;

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  // Simple test to verify Gemini connectivity and response
  async testModel(message: string, context: string): Promise<ChatResponse> {

    const prompt = `You are a helpful assistant. Respond to the user's message in a friendly and concise manner.

Message: ${message}
Context: ${context}

You MUST respond with ONLY a valid JSON object. No explanation, no markdown, no code blocks.

Required format:
{
  "responseToMessage": "your friendly response to the user here",
  "updatedContext": "a brief updated summary of the conversation so far, including this latest exchange"
}`;

    const response = await ai.models.generateContent({
      model: this.model,
      contents: prompt,
    })
    const text: string = response.text ?? "";
    if (!text) {
      throw new Error("Gemini response is empty");
    }

    try {
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      const cleanJson = text.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(cleanJson);
      return {
        response: parsed.responseToMessage,
        context: parsed.updatedContext
      };
    } catch (error) {
      console.error("Failed to parse Gemini response:", text);
      throw new Error("Failed to parse Gemini response");
    }
  }

  // Generate the context for resume polishing based on the analysis results
  extractApprovedSuggestions(analysis: ResumeAnalysis): ResumePolishContext {
    return {
      overallScore: analysis.overallScore,
      atsScore: analysis.atsScore,
      formattingScore: analysis.formattingScore,
      keywordScore: analysis.keywordScore,
      impactScore: analysis.impactScore,
      clarityScore: analysis.clarityScore,
      creativityScore: analysis.creativityScore,
      grade: analysis.grade,
      recruiterVerdict: analysis.recruiterVerdict,
      weaknesses: analysis.weaknesses,
      missedOpportunities: analysis.missedOpportunities,
      candidatePersona: analysis.candidatePersona,

      grammarIssues: analysis.grammarIssues?.filter(i => i.apply),
      impactUpgrades: analysis.impactUpgrades?.filter(i => i.apply),
      creativityBoosts: analysis.creativityBoosts?.filter(i => i.apply),
      keywordSuggestions: analysis.keywordSuggestions?.filter(i => i.apply),
      formattingTips: analysis.formattingTips?.filter(i => i.apply),
      redFlags: analysis.redFlags?.filter(i => i.apply),
    };
  }

  // Generate improved resume content based on original content and analysis context
  async generateImprovedContent(
    resumeContent: string,
    suggestions: ResumePolishContext
  ): Promise<StructuredResume> {
    const prompt = this.buildPolishPrompt(resumeContent, suggestions);
    const result = await ai.models.generateContent({
      model: this.model,
      contents: prompt,
    });
    const text = result.text ?? "";
    let parsed: StructuredResume;
    try {
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      const cleanJson = text.slice(jsonStart, jsonEnd + 1).replace(/:\s*undefined/g, ": null");;
      parsed = JSON.parse(cleanJson);
    } catch (error) {
      console.error("Failed to parse improved content response:", text);
      throw new Error("Failed to parse improved content response");
    }
    return parsed;
  }

  // Analyze resume and return detailed feedback and suggestions
  async analyzeResume(resumeContent: string): Promise<ResumeAnalysis> {
    const prompt = `
You are a senior ATS resume analyst and career strategist. You are precise, evidence-based, and never pad your analysis with generic advice.

Your analysis must be GROUNDED IN THE RESUME ONLY.
Every suggestion, keyword, flag, and upgrade must be directly traceable to something that EXISTS in the resume — a project, a role, a skill, a phrase, a technology mentioned.

---

CONTEXT-AWARENESS RULES (read these first — they override everything):

1. **Only suggest what the resume supports.**
   - If the resume has no skills section → suggest skills ONLY derived from projects, experience, or education mentioned in the resume.
   - If the resume has no projects → do not suggest project-related keywords.
   - If a technology appears in a project or job description → it is fair to suggest adding it to skills.
   - NEVER suggest certifications, skills, or keywords that have zero evidence in the resume.

2. **Keyword suggestions must cite their evidence.**
   - Every keyword suggestion must include an "evidenceFrom" field quoting the exact resume text that justifies it.
   - Example: Resume says "built an Android app using Kotlin" → suggest "Kotlin", "Android Development", "Mobile Development" with evidenceFrom: "built an Android app using Kotlin".
   - No evidence = no suggestion. Period.

3. **Do not flag what isn't there as a problem.**
   - Missing sections (skills, projects, certifications) are a "missedOpportunity", NOT a redFlag or weakness, unless their absence directly hurts ATS compatibility.
   - A resume with no projects section should not be penalized in impactScore for missing project bullets.

4. **Score honestly with calibration.**
   - If overallScore >= 85, weaknesses and grammarIssues should only contain REAL, significant issues — not stylistic nitpicks.
   - Do not manufacture issues to appear thorough.
   - An array being empty [] is valid and honest. Prefer it over padding.

5. **apply field — always default to false.**
   - Every suggestion, fix, upgrade, tip, and flag must include "apply": false.
   - This field is controlled by the user — Gemini always outputs false.
   - Never output "apply": true under any circumstance.

---

EVALUATION DIMENSIONS:

- **atsScore**: Keyword density, section labeling, ATS-safe structure, scannability
- **formattingScore**: Hierarchy, whitespace, consistency — only penalize what's actually broken
- **keywordScore**: Role-relevant terms found vs. expected — based ONLY on what the resume's own content implies
- **impactScore**: Bullet strength, action verbs, quantification — only for sections that exist
- **clarityScore**: Writing economy, precision, grammar
- **creativityScore**: Differentiation, memorable phrasing, personality signal
- **overallScore**: Weighted average — ATS(25%) + Impact(30%) + Keywords(20%) + Formatting(15%) + Clarity(10%)

Grade mapping:
  95–100 = A+
  90–94  = A
  80–89  = B+
  75–79  = B
  65–74  = C
  55–64  = D
  <55    = F

---

ANALYSIS TASKS:

**grammarIssues** — Only flag real grammar, tense consistency, or clarity errors. Quote the exact original text. Severity: "critical" (changes meaning), "moderate" (noticeable to recruiter), "minor" (subtle). Empty array if none found.

**impactUpgrades** — Find weak, passive, or vague bullets. Rewrite using: [Action Verb] + [Scope] + [Measurable Outcome]. Only upgrade bullets that exist. Do not invent metrics — use conservative inference only when the context clearly supports it.

**creativityBoosts** — Flag clichés and generic phrases (e.g., "team player", "passionate about", "responsible for", "worked with"). Replace with sharp, specific alternatives. Must quote original text exactly.

**keywordSuggestions** — Suggest only keywords that:
  a) Are directly evidenced by resume content
  b) Would improve ATS matching for the role implied by the resume
  c) Include the exact evidenceFrom quote

**formattingTips** — Only flag actual formatting problems observed (e.g., inconsistent date formats, missing section headers, walls of text). Do not suggest formatting changes for things you cannot verify exist.

**redFlags** — Real deal-breakers only: unexplained gaps, no quantification anywhere, completely missing contact info, ATS-breaking formatting. Not stylistic preferences.

**missedOpportunities** — Sections or elements absent from the resume that would meaningfully improve it (e.g., "No skills section despite multiple technologies mentioned in projects", "GitHub link absent despite software projects listed").

**recruiterVerdict** — One sentence, max 20 words, gut-reaction after 6 seconds of scanning.

**candidatePersona** — Archetype + tone + standout factor + hiring risk based strictly on what's written.

---

ABSOLUTE RULES:
- Never suggest skills, keywords, or technologies not evidenced in the resume.
- Never flag a missing section as a weakness unless it directly breaks ATS parsing.
- Never fill arrays just to look thorough — empty arrays are valid.
- Every suggestion and fix must have "apply": false.
- Return ONLY valid JSON. No markdown, no code blocks, no comments, no text outside JSON.
- Response MUST start with { and end with }.

---

SCHEMA:

{
  "overallScore": number,
  "atsScore": number,
  "formattingScore": number,
  "keywordScore": number,
  "impactScore": number,
  "clarityScore": number,
  "creativityScore": number,
  "grade": "A+" | "A" | "B+" | "B" | "C" | "D" | "F",
  "recruiterVerdict": string,
  "overallFeedback": string,
  "strengths": string[],
  "weaknesses": string[],
  "missedOpportunities": string[],
  "grammarIssues": [
    {
      "original": string,
      "suggestion": string,
      "context": string,
      "severity": "minor" | "moderate" | "critical",
      "apply": false
    }
  ],
  "impactUpgrades": [
    {
      "original": string,
      "upgraded": string,
      "reason": string,
      "apply": false
    }
  ],
  "creativityBoosts": [
    {
      "original": string,
      "suggestion": string,
      "context": string,
      "apply": false
    }
  ],
  "keywordSuggestions": [
    {
      "keyword": string,
      "reason": string,
      "evidenceFrom": string,
      "apply": false
    }
  ],
  "formattingTips": [
    {
      "tip": string,
      "reason": string,
      "apply": false
    }
  ],
  "redFlags": [
    {
      "issue": string,
      "impact": string,
      "fix": string,
      "apply": false
    }
  ],
  "candidatePersona": {
    "archetype": string,
    "tone": string,
    "standoutFactor": string,
    "hiringRisk": "low" | "medium" | "high",
    "hiringRiskReason": string
  }
}

---

Resume Content:
${resumeContent}
`;

    const response = await ai.models.generateContent({
      model: this.model,
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
      throw new Error("Failed to parse ATS analysis response\n" + text);
    }

    return parsed;
  }

  // Parse resume text → structured JSON via Gemini
  async parseResume(rawText: string): Promise<StructuredResume> {
    const model = genAI.getGenerativeModel({
      model: this.model,
      generationConfig: { responseMimeType: "application/json" },
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
    const clean = text.replace(/^```json|^```|```$/gm, "").trim();
    return JSON.parse(clean);
  }

  // Map improved content onto original DOCX text nodes
  async remapText<T>(originalTexts: string[], improvedContent: T): Promise<string[]> {
    const model = genAI.getGenerativeModel({
      model: this.model,
      generationConfig: { responseMimeType: "application/json" },
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
    const clean = text.replace(/^```json|^```|```$/gm, "").trim();
    const mapped: string[] = JSON.parse(clean);

    if (!Array.isArray(mapped) || mapped.length !== originalTexts.length) {
      throw new Error(
        `Gemini returned ${mapped?.length} items but expected ${originalTexts.length}`
      );
    }
    return mapped;
  }

  // Build the prompt for resume polishing with all the analysis context
  buildPolishPrompt(resumeContent: string, analysis: ResumePolishContext): string {
    const issuesContext = JSON.stringify(analysis, null, 2);

    return `
You are an elite resume writer and ATS optimization expert. You have been given a raw resume and a detailed diagnostic analysis of everything wrong with it.

Your mission: rewrite this resume from scratch into a flawless, ATS-optimized, recruiter-captivating document that would score 90+ across all dimensions.

Do not simply fix surface issues. Reconstruct, elevate, and sharpen every section.

---

DIAGNOSTIC ANALYSIS (your instruction set — fix EVERYTHING flagged here):

${issuesContext}

---

REWRITING RULES:

**Identity & Contact**
- Keep all real contact info exactly as provided. Never fabricate email, phone, or links.
- Add a punchy professional headline (5–10 words) that instantly communicates role + value.

**Summary**
- Rewrite as 3–4 sentences max. Lead with role + years of experience + top strengths.
- Inject 3–5 ATS keywords from keywordSuggestions naturally.
- End with what the candidate brings to the table — make it specific, not generic.

**Experience — Every bullet must follow this formula:**
  [Strong Action Verb] + [Specific Task/Scope] + [Quantified Result or Business Impact]
- Apply ALL impactUpgrades from the analysis.
- Fix ALL grammarIssues (especially "critical" and "moderate" severity).
- Apply creativityBoosts — eliminate every cliché flagged in the analysis.
- Every role must have 3–5 bullets. No bullet under 12 words. No bullet over 30 words.
- Add a keyAchievement field — the single most impressive thing from that role (1 line, bold-worthy).
- Use consistent past tense for past roles, present tense for current role.

**Projects**
- Each project must have a crisp 1-sentence description + 2–4 impact-driven bullets.
- Add an "impact" field summarizing the real-world value or technical challenge overcome.
- Include technologies as a clean comma-separated list.

**Education**
- Add highlights[] for any GPA ≥ 3.5, honors, awards, or relevant coursework.
- Do not fabricate academic credentials.

**Skills**
- Reorganize into clean categories: Languages, Frameworks, Tools, Databases, Cloud/DevOps, Soft Skills.
- Inject missing keywords from keywordSuggestions where genuinely applicable.
- Remove redundant or outdated skills.

**Certifications & Languages**
- Preserve all real certifications. Do not invent new ones.
- Add languages only if present in original resume.

**Additional Sections**
- If the original resume has volunteer work, publications, awards, or speaking engagements — include them under additionalSections.
- Do not fabricate entries.

**Polish Summary (REQUIRED)**
- List every significant change made (changesApplied).
- List the areas that will most improve the score (scoreImprovementAreas).
- List every ATS keyword you injected (atsKeywordsInjected).
- Provide an honest estimated new overall score (estimatedNewScore, 0–100).

---

ABSOLUTE RULES:
- Never fabricate contact info, employers, degrees, dates, or certifications.
- Never add skills the candidate didn't demonstrate.
- You MAY rephrase, restructure, quantify (with reasonable inference), and elevate language.
- If a metric is missing but can be reasonably inferred (e.g., team size, project scale), use conservative estimates and frame them accurately.
- Every section must be tighter, stronger, and more specific than the original.

---

MISSING DATA RULES:
- If a field's data does not exist in the original resume, set it to null (for strings/objects) or [] (for arrays).
- NEVER invent, guess, or fabricate missing contact info, links, employers, dates, or certifications.
- Optional fields (website, keyAchievement, impact, highlights, additionalSections) should be omitted entirely (undefined) if not present.
- Required fields (name, email, summary, etc.) that are genuinely absent: set to "".

---

OUTPUT INTEGRITY RULES:

1. Return ONLY valid JSON. The response MUST start with { and end with }. No exceptions.

2. Never wrap the response in markdown, code blocks, or backticks (no \`\`\`json or \`\`\`).

3. Never output undefined as a value. Use null for absent optional fields, [] for absent arrays.

4. String values must be clean, single strings only:
   - Never embed unescaped double quotes inside a string value.
   - Never write multiple options or alternatives inside a single string (e.g. "Option A" or "Option B...").
   - Never write prose, explanations, or commentary inside a string value.
   - If presenting a suggestion or upgrade, pick ONE best option and write it as a clean string.

5. Never truncate the response. Every array and object must be fully closed.

6. Every string must be properly escaped:
   - Double quotes inside strings → \\\"
   - Newlines inside strings → \\n
   - Backslashes inside strings → \\\\

7. Arrays must never be left open. If a section has no items, return [] not a partial array.

8. Do not add comments inside JSON (no // or /* */).

9. Do not add trailing commas after the last item in any array or object.

10. Every field in the schema is required. Do not skip or rename fields.

---

SCHEMA:

{
  "name": string,
  "email": string,
  "phone": string,
  "location": string,
  "linkedin": string,
  "github": string,
  "website": string | undefined,
  "headline": string,
  "summary": string,
  "experience": [
    {
      "title": string,
      "company": string,
      "location": string,
      "dates": string,
      "bullets": string[],
      "keyAchievement": string | undefined
    }
  ],
  "projects": [
    {
      "name": string,
      "description": string,
      "technologies": string,
      "link": string | undefined,
      "dates": string | undefined,
      "bullets": string[],
      "impact": string | undefined
    }
  ],
  "education": [
    {
      "degree": string,
      "school": string,
      "dates": string,
      "details": string,
      "highlights": string[] | undefined
    }
  ],
  "skills": [
    {
      "category": string,
      "items": string
    }
  ],
  "certifications": string[],
  "languages": string[] | undefined,
  "additionalSections": [
    {
      "title": string,
      "entries": [
        {
          "label": string,
          "description": string,
          "date": string | undefined
        }
      ]
    }
  ] | undefined,
  "polishSummary": {
    "changesApplied": string[],
    "scoreImprovementAreas": string[],
    "atsKeywordsInjected": string[],
    "estimatedNewScore": number
  }
}

---

Resume Content (original, unpolished):
${resumeContent}
`;
  }
}
