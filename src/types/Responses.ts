import { PolishSummary } from "./structuredResume.types";

export interface SummaryAndBufferResponse {
    polishSummary: PolishSummary;
    buffer: Buffer;
}

export interface ChatResponse {
    response: string;
    context: string;
}
