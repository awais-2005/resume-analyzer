import { Router } from "express";
import { ResumeController } from "../controllers/resume.controller";
import { uploadSingle, uploadNone } from "../middleware/upload";

const resumeRouter = Router();
const resumeController = ResumeController.getInstance();

resumeRouter.get("/history", resumeController.getHistory.bind(resumeController));

resumeRouter.post("/generate", uploadNone, resumeController.generateResume.bind(resumeController));

resumeRouter.post("/analysis", uploadSingle, resumeController.resumeAnalysis.bind(resumeController));

export { resumeRouter };
