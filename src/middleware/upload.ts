import multer from 'multer';
import path from 'path';
import { Request } from 'express';

import fs from 'fs';

const storage = multer.diskStorage({
    destination(_req: Request, _file: Express.Multer.File, cb) {
        const uploadDir = path.join(__dirname, '../../uploads/resumes');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename(_req: Request, file: Express.Multer.File, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const validTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
    if (validTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
}

export const uploadSingle = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).single('resume');

// Memory-based upload for endpoints that process buffers directly
export const uploadMemory = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }
}).single('resume');

// Parsing form-data when there is not file.
export const uploadNone = multer().none();
