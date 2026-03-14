import { Request, Response } from "express";
import { ResumeService } from "../services/resume.service";
import { GeminiService } from "../services/gemini.service";
import { DocxService } from "../services/docx.service";
import { ResumeMetadata, ResumeProcessOptions } from "../types/resume.types";
import { ApiResponse } from "../utils/ApiResponse";
import fs from "fs/promises";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/HttpStatus";
import { ResumeAnalysis, ResumePolishContext } from "../types/ResumeAnalysis";
import { StructuredResume } from "../types/structuredResume.types";
import { SummaryAndBufferResponse } from "../types/Responses";
import { PdfService } from "../services/pdf.service";

const resumeService = ResumeService.getInstance();
const geminiService = GeminiService.getInstance();
const docxService = DocxService.getInstance();
const pdfService = PdfService.getInstance();
export class ResumeController {

	private static instance: ResumeController;

	public static getInstance(): ResumeController {
		if (!ResumeController.instance) {
			ResumeController.instance = new ResumeController();
		}
		return ResumeController.instance;
	}

	async resumeAnalysis(req: Request, res: Response): Promise<void> {
		if (!req.body.resumeContent) {
			throw new ApiError(HttpStatus.NOT_FOUND, "No resume content provided for analysis.");
		}

		const analysis = await geminiService.analyzeResume(req.body.resumeContent);
		res.status(200).json(
			new ApiResponse<ResumeAnalysis>(
				true,
				analysis,
				"Resume analysis completed successfully."
			)
		);
	}

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
			...resumeMetadata,
		};

		if (req.file) {
			await fs.unlink(req.file.path).catch((err) => {
				throw new ApiError(
					HttpStatus.INTERNAL_SERVER_ERROR,
					"Could not delete uploaded file"
				);
			});
		}

		res.status(200).json(
			new ApiResponse<Partial<ResumeMetadata>>(
				true,
				metadata,
				"Successfully extracted resume content."
			)
		);
	}

	// POST /resume/generate — Reformat into styled template
	async generateResume(req: Request, res: Response): Promise<void> {

		// Get raw text from frontend

		const { resumeContent, analysis, fileType } = req.body;

		if (!resumeContent || typeof resumeContent !== "string") {
			throw new ApiError(HttpStatus.BAD_REQUEST, "No resume content provided");
		}
		const parsedAnalysis = analysis ? JSON.parse(analysis) : null;
		if (!parsedAnalysis) {
			throw new ApiError(HttpStatus.BAD_REQUEST, "No valid analysis provided");
		}

		const polishContext = geminiService.extractApprovedSuggestions(parsedAnalysis);
		const { polishSummary, ...structuredData } = await geminiService.generateImprovedContent(resumeContent, polishContext);

		if (!fileType || fileType === "pdf") {
			const pdfBuffer = await pdfService.renderToBuffer(structuredData);
			res.setHeader("Content-Type", "application/pdf");
			res.setHeader("Content-Disposition", 'attachment; filename="resume_formatted.pdf"');
			const data: SummaryAndBufferResponse = {
				polishSummary,
				buffer: {
					type: "Buffer",
					mimeType: "pdf",
					data: Array.from(pdfBuffer),
				},
			};
			console.log("Generated PDF resume buffer size:", pdfBuffer.length);
			res.status(200).send(new ApiResponse<SummaryAndBufferResponse>(true, data, "Resume generated successfully."));
			return;
		} else if (fileType === "docx") {

			const docxBuffer = await docxService.buildDocx(structuredData);

			res.setHeader(
				"Content-Type",
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
			);
			res.setHeader("Content-Disposition", 'attachment; filename="resume_formatted.docx"');

			const data: SummaryAndBufferResponse = {
				polishSummary,
				buffer: {
					type: "Buffer",
					mimeType: "docx",
					data: Array.from(docxBuffer),
				},
			};

			console.log("Generated DOCX resume buffer size:", docxBuffer.length);

			res.status(200).send(
				new ApiResponse<SummaryAndBufferResponse>(true, data, "Resume generated successfully.")
			);
		} else {
			throw new ApiError(HttpStatus.BAD_REQUEST, "Unsupported file type requested");
		}
	}

	async generateFixedResume(req: Request, res: Response): Promise<void> {
		if (!req.file) {
			throw new ApiError(HttpStatus.BAD_REQUEST, "No file uploaded");
		}

		const { buffer, mimetype } = req.file;
		const rawText = await resumeService.extractTextFromBuffer(buffer, mimetype);
		const analysis = await geminiService.analyzeResume(rawText);
		const polishContext = geminiService.extractApprovedSuggestions(analysis);
		const { polishSummary, ...structuredData } = await geminiService.generateImprovedContent(
			rawText,
			polishContext
		);
		const isPdf = true; // Assume PDF for this endpoint since we're using the PDF service

		if (isPdf) {
			const pdfBuffer = await pdfService.renderToBuffer(structuredData);
			res.setHeader("Content-Type", "application/pdf");
			res.setHeader("Content-Disposition", 'attachment; filename="resume_fixed.pdf"');
			const data: SummaryAndBufferResponse = {
				polishSummary,
				buffer: {
					type: "Buffer",
					mimeType: "pdf",
					data: Array.from(pdfBuffer),
				},
			};
			res.status(200).send(new ApiResponse<SummaryAndBufferResponse>(true, data, "Resume generated successfully."));
			return;
		} else {

			const docxBuffer = await docxService.buildDocx(structuredData);

			res.setHeader(
				"Content-Type",
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
			);
			res.setHeader("Content-Disposition", 'attachment; filename="resume_formatted.docx"');

			const data: SummaryAndBufferResponse = {
				polishSummary,
				buffer: {
					type: "Buffer",
					mimeType: "docx",
					data: Array.from(docxBuffer),
				}
			};

			res.status(200).send(
				new ApiResponse<SummaryAndBufferResponse>(true, data, "Resume generated successfully.")
			);
		}
	}

	// POST /resume/apply-suggestions — Keep original template, inject improved content
	async applySuggestions(req: Request, res: Response): Promise<void> {
		if (!req.file) {
			throw new ApiError(HttpStatus.BAD_REQUEST, "No file uploaded");
		}
		if (!req.body.suggestions) {
			throw new ApiError(HttpStatus.BAD_REQUEST, "No suggestions provided");
		}

		const suggestions: ResumePolishContext = JSON.parse(req.body.suggestions);
		const { polishSummary, ...improvedContent } = await geminiService.generateImprovedContent(
			req.body.resumeContent,
			suggestions
		);
		let { buffer, mimetype } = req.file;

		// If PDF, convert to DOCX first so we have editable XML
		if (mimetype === "application/pdf") {
			buffer = resumeService.pdfToDocxBuffer(buffer);
		}

		const outputBuffer = await docxService.injectContent<Partial<StructuredResume>>(
			buffer,
			improvedContent
		);

		res.setHeader(
			"Content-Type",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		);
		res.setHeader("Content-Disposition", 'attachment; filename="resume_improved.docx"');

		const data: SummaryAndBufferResponse = {
			polishSummary,
			buffer: {
				type: "Buffer",
				mimeType: "docx",
				data: Array.from(outputBuffer),
			}
		};

		res.status(200).send(
			new ApiResponse<SummaryAndBufferResponse>(true, data, "Resume improved successfully.")
		);
	}
}
