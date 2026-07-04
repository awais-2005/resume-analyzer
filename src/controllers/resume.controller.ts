import { Request, Response } from "express";
import mongoose from "mongoose";
import { ResumeService } from "../services/resume.service";
import { GeminiService } from "../services/gemini.service";
import { ApiResponse } from "../utils/ApiResponse";
import fs from "fs/promises";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/HttpStatus";
import { ResumeAnalysisWithHistory } from "../types/ResumeAnalysis";
import { SummaryAndBufferResponse, TaskHistoryItem, TaskHistoryResponse } from "../types/Responses";
import { PdfService } from "../services/pdf.service";
import { R2StorageService } from "../services/r2-storage.service";
import { History, IHistory } from "../models/History";

const resumeService = ResumeService.getInstance();
const geminiService = GeminiService.getInstance();
const pdfService = PdfService.getInstance();
const r2StorageService = R2StorageService.getInstance();
export class ResumeController {

	private static instance: ResumeController;

	public static getInstance(): ResumeController {
		if (!ResumeController.instance) {
			ResumeController.instance = new ResumeController();
		}
		return ResumeController.instance;
	}

	async resumeAnalysis(req: Request, res: Response): Promise<void> {
		const userId = req.userId;
		const uploadedResume = req.file;
		let contentForAnalysis: string;

		if (!userId) {
			throw new ApiError(HttpStatus.UNAUTHORIZED, "Unauthorized");
		}

		if (!uploadedResume) {
			throw new ApiError(HttpStatus.NOT_FOUND, "No resume file uploaded for analysis.");
		}

		// Try to get full text content from metadata service
		contentForAnalysis = await resumeService.getResumeContent(uploadedResume.path);


		if (!contentForAnalysis) {
			throw new ApiError(HttpStatus.NOT_FOUND, "No resume content provided for analysis.");
		}

		const analysis = await geminiService.analyzeResume(contentForAnalysis);
		let historyId: string | undefined;

		if (analysis) {
			const uploadedResumeBuffer = await fs.readFile(uploadedResume.path);
			const history = new History({
				userId,
				title: analysis.title || "Resume Analysis",
				prevScore: analysis.overallScore,
				newScore: null,
				unfixedResume: "",
			});

			const unfixedResumeKey = r2StorageService.buildResumePdfKey(
				userId,
				history._id.toString(),
				"unfixed",
				uploadedResume.originalname
			);
			try {
				history.unfixedResume = await r2StorageService.uploadPdf(
					uploadedResumeBuffer,
					unfixedResumeKey
				);
			} catch (error) {
				console.warn("R2 upload failed during resume analysis:", error);
			}
			await history.save();
			historyId = history._id.toString();
		}

		const data: ResumeAnalysisWithHistory = {
			...analysis,
			resumeContent: contentForAnalysis,
			...(historyId && { historyId }),
		};

		res.status(200).json(
			new ApiResponse<ResumeAnalysisWithHistory>(
				true,
				data,
				"Resume analysis completed successfully."
			)
		);
	}

	async getHistory(req: Request, res: Response): Promise<void> {
		const userId = req.userId;

		if (!userId) {
			throw new ApiError(HttpStatus.UNAUTHORIZED, "Unauthorized");
		}

		const historyItems = await History.find({ userId })
			.sort({ timestamp: -1 })
			.lean<IHistory[]>();

		const items: TaskHistoryItem[] = historyItems.map((history) => ({
			id: history._id.toString(),
			title: history.title,
			prevScore: history.prevScore,
			newScore: history.newScore ?? null,
			unfixedResume: history.unfixedResume,
			fixedResume: history.fixedResume ?? null,
			timestamp: new Date(history.timestamp).toISOString(),
		}));

		const data: TaskHistoryResponse = { items };

		res.status(200).json(
			new ApiResponse<TaskHistoryResponse>(true, data, "Resume history fetched successfully.")
		);
	}

	// POST /resume/generate — Reformat into styled template
	async generateResume(req: Request, res: Response): Promise<void> {

		const { analysis, templateId } = req.body;
		const userId = req.userId;


		if (!templateId || typeof templateId !== "string") {
			throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid template name provided");
		}


		const parsedAnalysisWithOtherDetails = this.parseAnalysis(analysis);
		if (!parsedAnalysisWithOtherDetails) {
			throw new ApiError(HttpStatus.BAD_REQUEST, "No valid analysis provided");
		}

		const { ...parsedAnalysis } = parsedAnalysisWithOtherDetails;
		const historyId = this.getHistoryId(parsedAnalysisWithOtherDetails);
		const resumeContent = this.getResumeContent(parsedAnalysisWithOtherDetails);


		if (!historyId || typeof historyId !== "string") {
			throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid history ID provided");
		}

		if (!resumeContent || typeof resumeContent !== "string") {
			throw new ApiError(HttpStatus.BAD_REQUEST, "No resume content provided");
		}

		const history = historyId ? await this.getHistoryObject(historyId) : null;

		const polishContext = geminiService.extractApprovedSuggestions(parsedAnalysis);
		const { polishSummary, ...structuredData } = await geminiService.generateImprovedContent(resumeContent, polishContext);

		const pdfBuffer = await pdfService.renderToBuffer(structuredData, templateId);
		let fixedResumeUrl: string | undefined;

		if (history && userId) {
			const fixedResumeKey = r2StorageService.buildResumePdfKey(
				userId,
				history._id.toString(),
				"fixed",
				"resume_formatted.pdf"
			);
			try {
				fixedResumeUrl = await r2StorageService.uploadPdf(pdfBuffer, fixedResumeKey);
				history.fixedResume = fixedResumeUrl;
			} catch (error) {
				console.warn("R2 upload failed during resume generation:", error);
			}
			history.newScore = polishSummary.estimatedNewScore;
			await history.save();
		}

		res.setHeader("Content-Type", "application/pdf");
		res.setHeader("Content-Disposition", 'attachment; filename="resume_formatted.pdf"');
		const data: SummaryAndBufferResponse = {
			polishSummary,
			buffer: {
				type: "Buffer",
				mimeType: "pdf",
				data: Array.from(pdfBuffer),
			},
			...(history?._id && { historyId: history._id.toString() }),
			...(fixedResumeUrl && { fixedResumeUrl }),
		};
		res.status(200).send(new ApiResponse<SummaryAndBufferResponse>(true, data, "Resume generated successfully."));
		return;
	}

	private parseAnalysis(analysis: unknown): ResumeAnalysisWithHistory | null {
		if (!analysis) {
			return null;
		}

		if (typeof analysis === "string") {
			try {
				return JSON.parse(analysis) as ResumeAnalysisWithHistory;
			} catch {
				throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid analysis JSON");
			}
		}

		return analysis as ResumeAnalysisWithHistory;
	}

	private getHistoryId(analysis: ResumeAnalysisWithHistory): string | undefined {
		return typeof analysis.historyId === "string" ? analysis.historyId.trim() : undefined;
	}

	private getResumeContent(analysis: ResumeAnalysisWithHistory): string | undefined {
		return typeof analysis.resumeContent === "string" ? analysis.resumeContent.trim() : undefined;
	}

	private async getHistoryObject(historyId: string): Promise<IHistory> {
		if (!mongoose.isValidObjectId(historyId)) {
			throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid history id");
		}

		const history = await History.findById(historyId);

		if (!history) {
			throw new ApiError(HttpStatus.NOT_FOUND, "History not found");
		}

		return history;
	}
}
