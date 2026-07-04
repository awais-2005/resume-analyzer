import { Router } from "express";
import { uploadNone, uploadSingle } from "../middleware/upload";
import { Test } from "../controllers/test.controller";
import { requireAuth } from "../middleware/requireAuth";

export const testRouter = Router();
const testController = Test.getInstance();

testRouter.post("/chat", uploadNone, testController.chatWithAi.bind(testController));
testRouter.get("/pdf", testController.pdfGenerationTest.bind(testController));
testRouter.post("/r2-upload", uploadSingle, testController.uploadPdfToR2Test.bind(testController));
testRouter.get("/userhistory", requireAuth, testController.getUserHistory.bind(testController));
