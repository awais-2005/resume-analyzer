export interface ResumeMetadata {
  filename: string;
  originalName: string;
  content: string;
  size: number;
  path: string;
  uploadedAt: Date;
  pages?: number;
  encrypted?: boolean;
  author?: string;
  title?: string;
}

export interface ResumeProcessOptions {
  extractText?: boolean;
  generateThumbnail?: boolean;
  validateStructure?: boolean;
}
