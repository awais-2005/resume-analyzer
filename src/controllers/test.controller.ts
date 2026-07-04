import { Request, Response } from "express";
import { PdfService } from "../services/pdf.service";
import { mockResume } from '../tests/mockData.test';
import { HttpStatus } from "../utils/HttpStatus";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { GeminiService } from "../services/gemini.service";
import { ChatResponse } from "../types/Responses";
import { TaskHistoryItem, TaskHistoryResponse } from "../types/Responses";
import fs from "fs/promises";
import { R2StorageService } from "../services/r2-storage.service";
import { History, IHistory } from "../models/History";

const pdfService = PdfService.getInstance();
const r2StorageService = R2StorageService.getInstance();

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
        res.status(200).send(new ApiResponse(true, "version 2", "Server is reachable!"));
    }

    async getUserHistory(req: Request, res: Response): Promise<void> {
        const userId = req.userId;

        if (!userId) {
            throw new ApiError(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }

        const historyItems = await History.find({ userId })
            .sort({ timestamp: -1 })
            .lean<IHistory[]>();

        const items: TaskHistoryItem[] = historyItems.map((history) => ({
            id: history._id.toString(),
            title: history.title,
            prevScore: history.prevScore,
            newScore: history.newScore ?? null,
            unfixedResume: history.unfixedResume,
            fixedResume: history.fixedResume ?? null,
            timestamp: new Date(history.timestamp).toISOString(),
        }));

        const data: TaskHistoryResponse = { items };

        res.status(200).json(
            new ApiResponse<TaskHistoryResponse>(true, data, "Resume history fetched successfully.")
        );
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

    async uploadPdfToR2Test(req: Request, res: Response): Promise<void> {
        const uploadedFile = req.file;

        if (!uploadedFile) {
            throw new ApiError(HttpStatus.BAD_REQUEST, "A PDF file is required");
        }

        if (uploadedFile.mimetype !== "application/pdf") {
            throw new ApiError(HttpStatus.BAD_REQUEST, "Only PDF files are allowed");
        }

        try {
            const fileBuffer = await fs.readFile(uploadedFile.path);
            const key = r2StorageService.buildResumePdfKey(
                "test-user",
                "test-upload",
                "unfixed",
                uploadedFile.originalname
            );

            const url = await r2StorageService.uploadPdf(fileBuffer, key);

            res.status(200).json(
                new ApiResponse(
                    true,
                    {
                        key,
                        url,
                        fileName: uploadedFile.originalname,
                    },
                    "PDF uploaded to R2 successfully"
                )
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, message);
        } finally {
            if (uploadedFile?.path) {
                await fs.unlink(uploadedFile.path).catch(() => undefined);
            }
        }
    }
}
