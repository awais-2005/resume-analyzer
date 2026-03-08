import { Request, Response } from 'express';
import { ResumeService } from '../services/resume.service';
import { GeminiService } from '../services/gemini.service';
import { DocxService } from '../services/docx.service';
import { ResumeMetadata, ResumeProcessOptions } from '../types/resume.types';
import { ApiResponse } from '../utils/ApiResponse';
import fs from 'fs/promises';
import { ApiError } from '../utils/ApiError';
import { HttpStatus } from '../utils/HttpStatus';

const resumeService = new ResumeService();
const geminiService = new GeminiService();
const docxService = new DocxService();

export class ResumeController {
  
  // Upload single resume
  async uploadResume(req: Request, res: Response): Promise<void> {
      if (!req.file) {
        throw new ApiError(HttpStatus.NOT_FOUND, "No resume file uploaded");
      }

      const file = req.file;
      const options: ResumeProcessOptions = req.body.options ? JSON.parse(req.body.options) : {};

      const isValid = await resumeService.validateResume(file.path);

      if (!isValid) {
        await fs.unlink(file.path);
        throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid resume file");
      }
      
      const resumeMetadata = await resumeService.processResume(file.path, options);

      const metadata: Partial<ResumeMetadata> = {
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        path: file.path,
        uploadedAt: new Date(),
        ...resumeMetadata
      };

      if (req.file) {
        await fs.unlink(req.file.path).catch((err) => { throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, "Could not delete uploaded file") });
      }
      
      res.status(200).json(new ApiResponse<Partial<ResumeMetadata>>(true, metadata, 'Successfully extracted resume content.'));
  }

  // POST /resume/generate — Reformat into styled template
  async generateResume(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'No file uploaded');
    }

    const { buffer, mimetype } = req.file;
    const rawText = await resumeService.extractTextFromBuffer(buffer, mimetype);
    const structuredData = await geminiService.parseResume(rawText);
    const docxBuffer = await docxService.buildDocx(structuredData);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="resume_formatted.docx"');
    res.send(docxBuffer);
  }

  // POST /resume/apply-suggestions — Keep original template, inject improved content
  async applySuggestions(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'No file uploaded');
    }
    if (!req.body.suggestions) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'No suggestions provided');
    }

    const improvedContent = JSON.parse(req.body.suggestions);
    let { buffer, mimetype } = req.file;

    // If PDF, convert to DOCX first so we have editable XML
    if (mimetype === 'application/pdf') {
      buffer = resumeService.pdfToDocxBuffer(buffer);
    }

    const outputBuffer = await docxService.injectContent(buffer, improvedContent);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="resume_improved.docx"');
    res.send(outputBuffer);
  }
}
