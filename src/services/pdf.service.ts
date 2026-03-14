import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import puppeteer, { Browser } from "puppeteer";
import { StructuredResume } from "../types/structuredResume.types"; // adjust path as needed

const TEMPLATES_DIR = path.resolve(__dirname, "../../assets/templates");

export class PdfService {
    private browser: Browser | null = null;

    private static instance: PdfService;

    private constructor() { }

    static getInstance(): PdfService {
        if (!PdfService.instance) {
            PdfService.instance = new PdfService();
        }
        return PdfService.instance;
    }
    // ── Browser lifecycle ────────────────────────────────────────────────────

    private async getBrowser(): Promise<Browser> {
        if (!this.browser || !this.browser.connected) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            });
        }
        return this.browser;
    }

    async closeBrowser(): Promise<void> {
        if (this.browser?.connected) {
            await this.browser.close();
            this.browser = null;
        }
    }

    // ── Template loading ─────────────────────────────────────────────────────

    private loadTemplate(templateName: string): HandlebarsTemplateDelegate {
        const filePath = path.join(TEMPLATES_DIR, `template-${templateName}.html`);

        if (!fs.existsSync(filePath)) {
            const available = this.listTemplates();
            throw new Error(
                `Template "${templateName}" not found. Available: ${available.join(", ")}`
            );
        }

        const source = fs.readFileSync(filePath, "utf8");
        return Handlebars.compile(source);
    }

    listTemplates(): string[] {
        if (!fs.existsSync(TEMPLATES_DIR)) return [];
        return fs
            .readdirSync(TEMPLATES_DIR)
            .filter(f => f.startsWith("template-") && f.endsWith(".html"))
            .map(f => f.replace("template-", "").replace(".html", ""));
    }

    // ── Core render ──────────────────────────────────────────────────────────

    async renderToBuffer(
        data: Partial<StructuredResume>,
        templateName: string = "classic"
    ): Promise<Buffer> {
        const compile = this.loadTemplate(templateName);
        const html = compile(data);

        const browser = await this.getBrowser();
        const page = await browser.newPage();

        try {
            await page.setContent(html, { waitUntil: "networkidle0" });

            const pdf = await page.pdf({
                format: "A4",
                printBackground: true,
                margin: { top: "0", right: "0", bottom: "0", left: "0" },
            });

            return Buffer.from(pdf);
        } finally {
            await page.close();
        }
    }

    // ── Save to disk (useful for dev/testing) ────────────────────────────────

    async renderToFile(
        data: StructuredResume,
        templateName: string = "classic",
        outputPath: string = path.resolve(process.cwd(), "output.pdf")
    ): Promise<string> {
        const buffer = await this.renderToBuffer(data, templateName);
        fs.writeFileSync(outputPath, buffer);
        return outputPath;
    }
}
