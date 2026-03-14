import { Request, Response } from "express";
import { PdfService } from "../services/pdf.service";
import { mockResume } from '../tests/mockData.test';
import { HttpStatus } from "../utils/HttpStatus";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { GeminiService } from "../services/gemini.service";
import { ChatResponse } from "../types/Responses";

const pdfService = PdfService.getInstance();

export class Test {

    private static instance: Test;

    public randValue: number = 69;

    private constructor() { }

    static getInstance(): Test {
        if (!Test.instance) {
            Test.instance = new Test();
        }
        return Test.instance;
    }

    getRandomValue(req: Request, res: Response): void {
        res.status(200).send(new ApiResponse(true, this.randValue, "Server is reachable!"));
    }

    async pdfGenerationTest(req: Request, res: Response): Promise<void> {
        try {
            const buffer = await pdfService.renderToBuffer(mockResume, "classic");
            res.status(200).send(new ApiResponse<Buffer<ArrayBufferLike>>(true, buffer, "Resume has been created successfully!"))
        } catch (err) {
            const message: string = err instanceof Error ? err.message : typeof err === "string" ? err : `UNKNOWN TYPE OF ERROR: ${err}`;
            console.log("Caught:", message);
            throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, message);
        }


    }

    async chatWithAi(req: Request, res: Response): Promise<void> {
        const message: string = req.body.message ?? "";
        const context: string = req.body.context ?? "";
        if (!message) {
            throw new ApiError(HttpStatus.NOT_FOUND, "Message is required in the request body");
        }

        try {
            const geminiService = GeminiService.getInstance();
            const response = await geminiService.testModel(message, context);
            res.status(200).json(new ApiResponse<ChatResponse>(true, response, "Message processed successfully"));

        } catch (error) {
            console.error("Error in /chat route:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, errorMessage);
        }
    }
}
