import { PolishSummary } from "./structuredResume.types";

export interface SummaryAndBufferResponse {
    polishSummary: PolishSummary;
    buffer: ResumeBuffer;
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
