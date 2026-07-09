import { PolishSummary } from "./structuredResume.types";

export interface SummaryAndBufferResponse {
    polishSummary: PolishSummary;
    buffer: ResumeBuffer;
    historyId?: string;
    fixedResumeUrl?: string;
}

export interface ResumeBuffer {
    type: 'Buffer';
    mimeType: string;
    data: number[];
}

export interface ChatResponse {
    response: string;
    context: string;
}

export interface TaskHistoryResponse {
    items: TaskHistoryItem[];
}

export interface TaskHistoryItem {
    id: string;
    title: string;
    prevScore: number;
    newScore?: number | null;
    unfixedResume: string;
    fixedResume?: string | null;
    hasAnalysis: boolean;
    timestamp: string;
}

export interface DeleteHistoryResponse {
    id: string;
}
