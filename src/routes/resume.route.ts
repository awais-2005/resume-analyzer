import { Router } from 'express';
import { ResumeController } from '../controllers/resume.controller';
import { uploadSingle, uploadMemory } from '../middleware/upload';

const resumeRouter = Router();
const resumeController = new ResumeController();

resumeRouter.post('/upload', uploadSingle, resumeController.uploadResume.bind(resumeController));
resumeRouter.post('/generate', uploadMemory, resumeController.generateResume.bind(resumeController));
resumeRouter.post('/apply-suggestions', uploadMemory, resumeController.applySuggestions.bind(resumeController));

export { resumeRouter };
