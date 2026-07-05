import { Router } from "express";
import { ResumeController } from "../controllers/resume.controller";
import { uploadSingle, uploadNone, uploadProfileImage } from "../middleware/upload";

const resumeRouter = Router();
const resumeController = ResumeController.getInstance();

resumeRouter.get("/history", resumeController.getHistory.bind(resumeController));

resumeRouter.post("/generate", uploadNone, resumeController.generateResume.bind(resumeController));

resumeRouter.post("/analysis", uploadSingle, resumeController.resumeAnalysis.bind(resumeController));

resumeRouter.post("/create", uploadProfileImage, resumeController.createResume.bind(resumeController));

export { resumeRouter };
