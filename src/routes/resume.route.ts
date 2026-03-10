import { Router } from "express";
import { ResumeController } from "../controllers/resume.controller";
import { uploadSingle, uploadMemory, uploadNone } from "../middleware/upload";

const resumeRouter = Router();
const resumeController = ResumeController.getInstance();

resumeRouter.post("/metadata", uploadSingle, resumeController.uploadResume.bind(resumeController));

resumeRouter.post(
	"/generate",
	uploadNone,
	resumeController.generateResume.bind(resumeController)
);

resumeRouter.post(
	"/generate-fixed",
	uploadMemory,
	resumeController.generateFixedResume.bind(resumeController)
);

resumeRouter.post(
	"/apply-suggestions",
	uploadMemory,
	resumeController.applySuggestions.bind(resumeController)
);

resumeRouter.post("/analysis", uploadNone, resumeController.resumeAnalysis.bind(resumeController));

export { resumeRouter };
