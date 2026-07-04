import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import fs from 'fs/promises';
import path from 'path';

const wordExtractor = new WordExtractor();

export class ResumeService {

  private static instance: ResumeService;

  public static getInstance(): ResumeService {
    if (!ResumeService.instance) {
      ResumeService.instance = new ResumeService();
    }
    return ResumeService.instance;
  }

  // Get full resume text content as a string
  async getResumeContent(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    const dataBuffer = await fs.readFile(filePath);

    if (ext === '.pdf') {
      const parser = new PDFParse({ data: dataBuffer });
      const result = await parser.getText();
      await parser.destroy();
      return result && typeof result.text === 'string' ? result.text : '';
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      return result && typeof result.value === 'string' ? result.value : '';
    } else if (ext === '.doc') {
      const doc = await wordExtractor.extract(filePath);
      return doc && typeof doc.getBody === 'function' ? doc.getBody() : '';
    }

    return '';
  }
}
