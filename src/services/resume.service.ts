import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import fs from 'fs/promises';
import path from 'path';
import { ResumeMetadata, ResumeProcessOptions } from '../types/resume.types';
import { ApiError } from '../utils/ApiError';
import { HttpStatus } from '../utils/HttpStatus';

const wordExtractor = new WordExtractor();

export class ResumeService {

  private static instance: ResumeService;

  public static getInstance(): ResumeService {
    if (!ResumeService.instance) {
      ResumeService.instance = new ResumeService();
    }
    return ResumeService.instance;
  }

  // Validate and extract resume info
  async processResume(filePath: string, options: ResumeProcessOptions = {}): Promise<Partial<ResumeMetadata>> {
    const ext = path.extname(filePath).toLowerCase();
    const dataBuffer = await fs.readFile(filePath);
    let metadata: Partial<ResumeMetadata> = {};
    let text = '';

    if (ext === '.pdf') {
      const parser = new PDFParse({ data: dataBuffer });
      const info = await parser.getInfo();
      const textResult = await parser.getText();
      await parser.destroy();
      metadata = {
        pages: info.total,
        author: info.info?.Author,
        title: info.info?.Title,
      };
      text = textResult.text;
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      text = result.value;
    } else if (ext === '.doc') {
      const doc = await wordExtractor.extract(filePath);
      text = doc.getBody();
    }

    if (!text) {
      throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, "Could not read uploaded file");
    }

    metadata.content = text;
    return metadata;
  }

  // Validate resume structure and integrity
  async validateResume(filePath: string): Promise<boolean> {
    try {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.pdf') {
        const dataBuffer = await fs.readFile(filePath);
        const parser = new PDFParse({ data: dataBuffer });
        const info = await parser.getInfo();
        await parser.destroy();
        return info.total > 0;
      } else if (ext === '.docx') {
        const dataBuffer = await fs.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer: dataBuffer });
        return result.value.length > 0;
      } else if (ext === '.doc') {
        const doc = await wordExtractor.extract(filePath);
        return doc.getBody().length > 0;
      }
      return false;
    } catch (err) {
      console.log("Validation Error:", err);
      return false;
    }
  }

  // Get resume metadata
  async getMetadata(filePath: string): Promise<object> {
    const ext = path.extname(filePath).toLowerCase();
    const dataBuffer = await fs.readFile(filePath);
    if (ext === '.pdf') {
      const parser = new PDFParse({ data: dataBuffer });
      const info = await parser.getInfo();
      await parser.destroy();
      return info.info;
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      return { text: result.value.substring(0, 200) };
    } else if (ext === '.doc') {
      const doc = await wordExtractor.extract(filePath);
      return { text: doc.getBody().substring(0, 200) };
    }
    return {};
  }

  // Extract plain text from a buffer (PDF or DOCX)
  async extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === 'application/pdf') {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      return result.text;
    }
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
}
