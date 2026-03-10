export interface ResumeAnalysis {
  overallScore: number;
  atsScore: number;
  formattingScore: number;
  keywordScore: number;
  impactScore: number;
  clarityScore: number;
  creativityScore: number;

  grade: "A+" | "A" | "B+" | "B" | "C" | "D" | "F";
  recruiterVerdict: string;
  overallFeedback: string;

  strengths: string[];
  weaknesses: string[];
  missedOpportunities: string[];

  grammarIssues: GrammarIssue[];
  impactUpgrades: ImpactUpgrade[];
  creativityBoosts: CreativityBoost[];
  keywordSuggestions: KeywordSuggestion[];
  formattingTips: FormattingTip[];
  redFlags: RedFlag[];

  candidatePersona: CandidatePersona;
}

// --- Approvable interfaces (all have apply: boolean) ---

export interface GrammarIssue {
  original: string;
  suggestion: string;
  context: string;
  severity: "minor" | "moderate" | "critical";
  apply: boolean;
}

export interface ImpactUpgrade {
  original: string;
  upgraded: string;
  reason: string;
  apply: boolean;
}

export interface CreativityBoost {
  original: string;
  suggestion: string;
  context: string;
  apply: boolean;
}

export interface KeywordSuggestion {
  keyword: string;
  reason: string;         // why this keyword fits THIS resume specifically
  evidenceFrom: string;   // the exact resume content that justifies this suggestion
  apply: boolean;
}

export interface FormattingTip {
  tip: string;
  reason: string;
  apply: boolean;
}

export interface RedFlag {
  issue: string;
  impact: string;
  fix: string;
  apply: boolean;
}

export interface CandidatePersona {
  archetype: string;
  tone: string;
  standoutFactor: string;
  hiringRisk: "low" | "medium" | "high";
  hiringRiskReason: string;
}

// The issues context passed INTO the prompt
export interface ResumePolishContext {
  overallScore: number;
  atsScore: number;
  formattingScore: number;
  keywordScore: number;
  impactScore: number;
  clarityScore: number;
  creativityScore: number;
  grade: string;
  recruiterVerdict: string;
  weaknesses: string[];
  missedOpportunities: string[];
  candidatePersona: {
    archetype: string;
    tone: string;
    standoutFactor: string;
    hiringRisk: "low" | "medium" | "high";
    hiringRiskReason: string;
  };
  keywordSuggestions: KeywordSuggestion[];
  formattingTips: FormattingTip[];
  grammarIssues: GrammarIssue[];
  impactUpgrades: ImpactUpgrade[];
  creativityBoosts: CreativityBoost[];
  redFlags: RedFlag[];
}
