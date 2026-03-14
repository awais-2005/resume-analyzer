import { Router } from "express";
import { uploadNone } from "../middleware/upload";
import { Test } from "../controllers/test.controller";

export const testRouter = Router();
const testController = Test.getInstance();

testRouter.post("/chat", uploadNone, testController.chatWithAi.bind(testController));
testRouter.get("/pdf", testController.pdfGenerationTest.bind(testController));
testRouter.get("/", testController.getRandomValue.bind(testController));
