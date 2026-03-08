export interface ResumeAnalysis {
	overallScore: number;
	atsScore: number;
	formattingScore: number;
	keywordScore: number;
	impactScore: number;
	grade: "A" | "B" | "C" | "D" | "F";
	strengths: string[];
	weaknesses: string[];
	grammarIssues: GrammarIssue[];
	keywordSuggestions: string[];
	formattingTips: string[];
	overallFeedback: string;
}

export interface GrammarIssue {
	original: string;
	suggestion: string;
	context: string;
}
