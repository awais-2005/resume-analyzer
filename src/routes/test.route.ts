import { Request, Response, Router } from "express";
import { uploadNone } from "../middleware/upload";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/HttpStatus";
import { GeminiService } from "../services/gemini.service";
import { ApiResponse } from "../utils/ApiResponse";
import { ChatResponse } from "../types/Responses";

export const testRouter = Router();

testRouter.post("/chat", uploadNone, async (req: Request, res: Response) => {
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
});
