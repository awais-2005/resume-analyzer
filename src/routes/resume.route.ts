import { Router } from "express";
import { ResumeController } from "../controllers/resume.controller";
import { uploadSingle, uploadMemory, uploadNone } from "../middleware/upload";

const resumeRouter = Router();
const resumeController = ResumeController.getInstance();

resumeRouter.post("/metadata", uploadSingle, resumeController.getResumeMetaData.bind(resumeController));

resumeRouter.post("/generate", uploadNone, resumeController.generateResume.bind(resumeController));

resumeRouter.post("/analysis", uploadNone, resumeController.resumeAnalysis.bind(resumeController));

export { resumeRouter };
