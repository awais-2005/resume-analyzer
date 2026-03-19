import fs from 'fs';
import path from 'path';

// Ensures the uploads/resumes directory exists at startup
export function ensureUploadsDir() {
    const uploadsDir = path.join(__dirname, '../uploads/resumes');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        // eslint-disable-next-line no-console
        console.log('Created uploads/resumes directory');
    }
}
