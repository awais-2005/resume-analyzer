import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { StructuredResume } from "../types/structuredResume.types";
import { ResumeAnalysis, ResumePolishContext } from "../types/ResumeAnalysis";
import { ChatResponse } from "../types/Responses";
import { HTTPRequest } from "puppeteer";
import { HttpStatus } from "../utils/HttpStatus";
import { ApiError } from "../utils/ApiError";


const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// Centralized model choice -- change this one constant to A/B test a
// different tier without touching call sites.
const MODELS = {
  DEFAULT: "gemini-3.1-flash-lite",
} as const;

const NUMBER_OF_RETRIES = 3; // Number of retries for transient errors
export class GeminiService {
  private static instance: GeminiService;

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  private constructor() { }

  private async generateJSON<T>(
    prompt: string,
    opts: { model?: string; thinkingLevel?: ThinkingLevel; maxOutputTokens?: number } = {}
  ): Promise<T> {
    const { model = MODELS.DEFAULT, thinkingLevel = ThinkingLevel.LOW, maxOutputTokens } = opts;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel },
        ...(maxOutputTokens ? { maxOutputTokens } : {}),
      },
    });

    const raw = response.text ?? "";
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null as T;
    }
  }

  // Defense-in-depth: force apply=false on every suggestion item,
  // regardless of what the model returned. Cheap replacement for the
  // schema-level guarantee we had with zod's z.literal(false).
  private normalizeApplyFalse(analysis: ResumeAnalysis): ResumeAnalysis {
    const forceFalse = <T extends { apply?: boolean }>(items?: T[]) =>
      items?.map((item) => ({ ...item, apply: false }));

    return {
      ...analysis,
      grammarIssues: forceFalse(analysis.grammarIssues) ?? analysis.grammarIssues,
      impactUpgrades: forceFalse(analysis.impactUpgrades) ?? analysis.impactUpgrades,
      creativityBoosts: forceFalse(analysis.creativityBoosts) ?? analysis.creativityBoosts,
      keywordSuggestions: forceFalse(analysis.keywordSuggestions) ?? analysis.keywordSuggestions,
      formattingTips: forceFalse(analysis.formattingTips) ?? analysis.formattingTips,
      redFlags: forceFalse(analysis.redFlags) ?? analysis.redFlags,
    };
  }

  // Simple test to verify Gemini connectivity and response
  async testModel(message: string, context: string): Promise<ChatResponse> {
    const prompt = `You are a helpful assistant. Respond to the user's message in a friendly and concise manner.

Return ONLY a JSON object, no markdown fences, no commentary, in this exact shape:
{"responseToMessage": "string", "updatedContext": "string"}

Message: ${message}
Context: ${context}`;

    const parsed = await this.generateJSON<{ responseToMessage: string; updatedContext: string }>(
      prompt,
      { thinkingLevel: ThinkingLevel.MINIMAL, maxOutputTokens: 512 }
    );

    return {
      response: parsed.responseToMessage,
      context: parsed.updatedContext,
    };
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

      grammarIssues: analysis.grammarIssues?.filter((i) => i.apply),
      impactUpgrades: analysis.impactUpgrades?.filter((i) => i.apply),
      creativityBoosts: analysis.creativityBoosts?.filter((i) => i.apply),
      keywordSuggestions: analysis.keywordSuggestions?.filter((i) => i.apply),
      formattingTips: analysis.formattingTips?.filter((i) => i.apply),
      redFlags: analysis.redFlags?.filter((i) => i.apply),
    };
  }

  // Generate improved resume content based on original content and analysis context
  async generateImprovedContent(
    resumeContent: string,
    suggestions: ResumePolishContext
  ): Promise<StructuredResume | null> {
    const prompt = this.buildPolishPrompt(resumeContent, suggestions);

    for (let i = 0; i < NUMBER_OF_RETRIES; i++) {
      const result = await this.generateJSON<StructuredResume | null>(prompt, {
        thinkingLevel: ThinkingLevel.LOW,
      });
      if (result) {
        return result;
      }
      console.log(`Retrying Gemini request (${i + 1}/${NUMBER_OF_RETRIES}) due to null response...`);
    }
    return null;
  }

  // Analyze resume and return detailed feedback and suggestions
  async analyzeResume(resumeContent: string): Promise<ResumeAnalysis> {
    const prompt = this.buildAnalysisPrompt(resumeContent);
    const result = await this.generateJSON<ResumeAnalysis>(prompt, {
      thinkingLevel: ThinkingLevel.LOW,
    });
    return this.normalizeApplyFalse(result);
  }

  // Parse resume text -> structured JSON via Gemini
  async parseResume(rawText: string): Promise<StructuredResume> {
    const prompt = `Extract this resume into structured JSON. Use empty strings for missing text fields and empty arrays for missing array fields -- do not invent data that isn't in the resume.

Return ONLY a JSON object, no markdown fences, no commentary, in this exact shape:
{
  "name": "string", "email": "string", "phone": "string", "location": "string",
  "linkedin": "string", "github": "string", "website": "string",
  "summary": "string",
  "experience": [{"title":"string","company":"string","location":"string","dates":"string","bullets":["string"]}],
  "projects": [{"name":"string","description":"string","technologies":"comma-separated string","link":"string","dates":"string","bullets":["string"]}],
  "education": [{"degree":"string","school":"string","dates":"string","details":"string"}],
  "skills": [{"category":"string","items":"comma-separated string"}],
  "certifications": ["string"],
  "languages": ["string, e.g. 'English (Native)'"]
}

Resume text:
${rawText}`;

    return this.generateJSON<StructuredResume>(prompt, {
      thinkingLevel: ThinkingLevel.MINIMAL,
      maxOutputTokens: 4096,
    });
  }

  // Map improved content onto original DOCX text nodes
  async remapText<T>(originalTexts: string[], improvedContent: T): Promise<string[]> {
    const prompt = `You are given two things:

1. An ORDERED LIST of text snippets extracted from a resume DOCX file (these are all the text nodes in document order).
2. IMPROVED resume content as structured JSON.

Return ONLY a JSON array of strings, same length and order as the input list (${originalTexts.length} items), no markdown fences, no commentary.
For each index, write the improved version of that text snippet using the improved content.
- Preserve structural/label texts exactly (e.g. "Experience", "Education", "Skills", section headers, dates).
- Only replace actual content: names, bullet points, descriptions, contact info, summaries.
- If a snippet is a label, divider, or formatting text, keep it unchanged.
- Keep each replacement roughly the same length as the original.

ORIGINAL TEXT NODES (${originalTexts.length} items):
${JSON.stringify(originalTexts, null, 2)}

IMPROVED CONTENT:
${JSON.stringify(improvedContent, null, 2)}`;

    const mapped = await this.generateJSON<string[]>(prompt, {
      thinkingLevel: ThinkingLevel.MINIMAL,
    });

    if (mapped.length !== originalTexts.length) {
      throw new Error(
        `Gemini returned ${mapped.length} items but expected ${originalTexts.length}`
      );
    }
    return mapped;
  }

  // Build the analysis prompt -- rules + compact schema description.
  // Array sizes are capped to bound output tokens (and therefore latency).
  private buildAnalysisPrompt(resumeContent: string): string {
    return `
You are a senior ATS resume analyst and career strategist. Precise, evidence-based, no generic padding.

GROUND EVERYTHING IN THE RESUME. Every suggestion, keyword, flag, and upgrade must trace to something that actually exists in the resume text below.

RULES:
1. Only suggest skills/keywords with direct evidence in the resume. No evidence = no suggestion.
2. Every keywordSuggestion needs an "evidenceFrom" field quoting the exact resume text that justifies it.
3. Missing sections (skills, projects, certifications) are a missedOpportunity, not a redFlag or weakness, unless they break ATS parsing.
4. Score honestly. If overallScore >= 85, weaknesses/grammarIssues should only contain real, significant issues. Empty arrays are valid and preferred over padding.
5. "apply" is always false on every item.
6. Be concise in every string value -- no filler words, no repeated phrasing.

SCORING: atsScore, formattingScore, keywordScore, impactScore, clarityScore, creativityScore (0-100 each).
overallScore = ATS(25%) + Impact(30%) + Keywords(20%) + Formatting(15%) + Clarity(10%).
Grade: 95-100=A+, 90-94=A, 80-89=B+, 75-79=B, 65-74=C, 55-64=D, <55=F.

CAPS (do not exceed): strengths/weaknesses/missedOpportunities max 5 each. grammarIssues max 5. impactUpgrades max 6. creativityBoosts max 5. keywordSuggestions max 8. formattingTips max 5. redFlags max 4.

Return ONLY a JSON object, no markdown fences, no commentary, in this exact shape:
{
  "title": "candidateName - inferred Role",
  "overallScore": 0, "atsScore": 0, "formattingScore": 0, "keywordScore": 0, "impactScore": 0, "clarityScore": 0, "creativityScore": 0,
  "grade": "A+|A|B+|B|C|D|F",
  "recruiterVerdict": "max 20 words, gut reaction after 6 seconds",
  "overallFeedback": "string",
  "strengths": ["string"], "weaknesses": ["string"], "missedOpportunities": ["string"],
  "grammarIssues": [{"original":"exact quote","suggestion":"string","context":"string","severity":"minor|moderate|critical","apply":false}],
  "impactUpgrades": [{"original":"exact quote","upgraded":"string","reason":"string","apply":false}],
  "creativityBoosts": [{"original":"exact quote","suggestion":"string","context":"string","apply":false}],
  "keywordSuggestions": [{"keyword":"string","reason":"string","evidenceFrom":"exact quote","apply":false}],
  "formattingTips": [{"tip":"string","reason":"string","apply":false}],
  "redFlags": [{"issue":"string","impact":"string","fix":"string","apply":false}],
  "candidatePersona": {"archetype":"string","tone":"string","standoutFactor":"string","hiringRisk":"low|medium|high","hiringRiskReason":"string"}
}

Resume Content:
${resumeContent}
`;
  }

  // Build the prompt for resume polishing with all the analysis context.
  private buildPolishPrompt(resumeContent: string, analysis: ResumePolishContext): string {
    const issuesContext = JSON.stringify(analysis, null, 2);

    return `
You are an elite resume writer and ATS optimization expert. Rewrite this resume from scratch into an ATS-optimized, recruiter-captivating document that would score 90+ across all dimensions, fixing everything in the diagnostic analysis below.

DIAGNOSTIC ANALYSIS (fix everything flagged here):
${issuesContext}

RULES:
- Never fabricate contact info, employers, degrees, dates, or certifications. Keep all real contact info exactly as provided.
- Add a headline (5-10 words): role + value, punchy.
- Summary: 3-4 sentences max, lead with role + experience + top strengths, inject 3-5 relevant keywords naturally.
- Experience bullets: [Action Verb] + [Scope] + [Quantified Result]. Apply all impactUpgrades and grammarIssues fixes, eliminate all creativityBoosts clichés. 3-5 bullets per role, 12-30 words each. Add one keyAchievement per role. Consistent tense (past for past roles, present for current).
- Projects: 1-sentence description + 2-4 impact bullets + an "impact" field + comma-separated technologies.
- Education: add highlights[] only for GPA >= 3.5, honors, awards, relevant coursework -- don't fabricate.
- Skills: reorganize into clean categories (Languages, Frameworks, Tools, Databases, Cloud/DevOps, Soft Skills), inject applicable missing keywords, drop redundant ones.
- Certifications/languages: preserve real ones only, never invent.
- additionalSections: include volunteer work / publications / awards / speaking only if present in the original -- never fabricate.
- If a field has no data in the original, use "" or [] -- never invent it.
- polishSummary is required: changesApplied (max 8), scoreImprovementAreas (max 5), atsKeywordsInjected (max 10), estimatedNewScore (0-100, honest).

Return ONLY a JSON object, no markdown fences, no commentary, in this exact shape:
{
"name": "string", "email": "string", "phone": "string", "location": "string",
"linkedin": "string", "github": "string", "website": "string", "profileImage": "string",
"headline": "string",
"summary": "string",
"experience": [{"title":"string","company":"string","location":"string","dates":"string","bullets":["string"],"keyAchievement":"string"}],
"projects": [{"name":"string","description":"string","technologies":"comma-separated string","link":"string","dates":"string","bullets":["string"],"impact":"string"}],
"education": [{"degree":"string","school":"string","dates":"string","details":"string","highlights":["string"]}],
"skills": [{"category":"string","items":"comma-separated string"}],
"certifications": ["string"],
"languages": ["string"],
"additionalSections": [{"title":"string","entries":[{"label":"string","description":"string","date":"string"}]}],
"polishSummary": {"changesApplied":["string"],"scoreImprovementAreas":["string"],"atsKeywordsInjected":["string"],"estimatedNewScore":0}
}

Resume Content (original, unpolished):
${resumeContent}
`;
  }
}
