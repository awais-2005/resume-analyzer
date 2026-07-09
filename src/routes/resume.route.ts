import { Router } from "express";
import { ResumeController } from "../controllers/resume.controller";
import { uploadSingle, uploadNone, uploadProfileImage } from "../middleware/upload";

const resumeRouter = Router();
const resumeController = ResumeController.getInstance();

resumeRouter.get("/history", resumeController.getHistory.bind(resumeController));

// Fetch the stored analysis JSON for a past history item (used to "use"/"view" it again)
resumeRouter.get("/history/:id/analysis", resumeController.getHistoryAnalysis.bind(resumeController));

// Delete a history item permanently
resumeRouter.delete("/history/:id", resumeController.deleteHistory.bind(resumeController));

resumeRouter.post("/generate", uploadNone, resumeController.generateResume.bind(resumeController));

resumeRouter.post("/analysis", uploadSingle, resumeController.resumeAnalysis.bind(resumeController));

resumeRouter.post("/create", uploadProfileImage, resumeController.createResume.bind(resumeController));

export { resumeRouter };
