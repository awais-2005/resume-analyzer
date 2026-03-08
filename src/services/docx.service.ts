import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, BorderStyle, WidthType,
} from 'docx';
import AdmZip from 'adm-zip';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { StructuredResume } from '../types/structuredResume.types';
import { GeminiService } from './gemini.service';

interface TextNode {
  obj: Record<string, unknown>;
  key: string;
}

const geminiService = new GeminiService();

// ─── XML text-node helpers ────────────────────────────────────────────────

function getTextNodes(xmlObj: unknown, nodes: TextNode[] = []): TextNode[] {
  if (Array.isArray(xmlObj)) {
    xmlObj.forEach((item) => getTextNodes(item, nodes));
  } else if (typeof xmlObj === 'object' && xmlObj !== null) {
    for (const key of Object.keys(xmlObj)) {
      if (key === 'w:t') {
        nodes.push({ obj: xmlObj as Record<string, unknown>, key });
      } else {
        getTextNodes((xmlObj as Record<string, unknown>)[key], nodes);
      }
    }
  }
  return nodes;
}

function extractTextFromNode(node: TextNode): string {
  const val = node.obj[node.key];
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) return (val as Record<string, string>)['#text'] ?? '';
  return '';
}

function setTextOnNode(node: TextNode, newText: string): void {
  const val = node.obj[node.key];
  if (typeof val === 'object' && val !== null) {
    node.obj[node.key] = { ...(val as object), '#text': newText };
  } else {
    node.obj[node.key] = newText;
  }
}

// ─── Public service ───────────────────────────────────────────────────────

export class DocxService {

  // Inject improved content into a DOCX buffer, preserving all formatting
  async injectContent(docxBuffer: Buffer, improvedContent: StructuredResume): Promise<Buffer> {
    const zip = new AdmZip(docxBuffer);
    const xmlData = zip.readAsText('word/document.xml');

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      preserveOrder: false,
      parseTagValue: false,
      parseAttributeValue: false,
    });

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      preserveOrder: false,
      suppressBooleanAttributes: false,
    });

    const xmlObj = parser.parse(xmlData);
    const nodes = getTextNodes(xmlObj);
    const origTexts = nodes.map(extractTextFromNode);

    // Filter out empty nodes for Gemini (but keep their indices)
    const nonEmpty = origTexts
      .map((t, i) => ({ i, t }))
      .filter(({ t }) => t.trim() !== '');

    const remapped = await geminiService.remapText(
      nonEmpty.map(({ t }) => t),
      improvedContent,
    );

    // Write back only non-empty slots
    nonEmpty.forEach(({ i }, j) => setTextOnNode(nodes[i], remapped[j]));

    const newXml = builder.build(xmlObj);
    zip.updateFile('word/document.xml', Buffer.from(newXml, 'utf8'));
    return zip.toBuffer();
  }

  // Build a formatted DOCX from structured resume data
  async buildDocx(data: StructuredResume): Promise<Buffer> {
    const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

    const divider = () =>
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2563EB', space: 1 } },
        spacing: { before: 160, after: 80 },
        children: [],
      });

    const sectionHead = (text: string) =>
      new Paragraph({
        spacing: { before: 160, after: 60 },
        children: [new TextRun({ text, bold: true, size: 26, color: '1E3A5F', font: 'Arial' })],
      });

    const bullet = (text: string) =>
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        spacing: { before: 20, after: 20 },
        children: [new TextRun({ text, size: 20, font: 'Arial' })],
      });

    const children: (Paragraph | Table)[] = [];

    // Name header
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: data.name || 'Your Name', bold: true, size: 52, color: '1E3A5F', font: 'Arial' })],
      }),
    );

    // Contact line
    const contactParts = [data.email, data.phone, data.linkedin, data.github, data.website, data.location]
      .filter(Boolean)
      .join('  |  ');
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 40 },
        children: [new TextRun({ text: contactParts, size: 18, color: '555555', font: 'Arial' })],
      }),
    );

    // Summary
    if (data.summary) {
      children.push(divider(), sectionHead('PROFESSIONAL SUMMARY'));
      children.push(
        new Paragraph({
          spacing: { before: 40, after: 80 },
          children: [new TextRun({ text: data.summary, size: 20, font: 'Arial' })],
        }),
      );
    }

    // Experience
    if (data.experience?.length) {
      children.push(divider(), sectionHead('PROFESSIONAL EXPERIENCE'));
      data.experience.forEach((exp, i) => {
        children.push(
          new Paragraph({
            spacing: { before: i === 0 ? 80 : 120, after: 10 },
            children: [
              new TextRun({ text: exp.title, bold: true, size: 22, font: 'Arial', color: '1E3A5F' }),
              new TextRun({ text: `  —  ${exp.company}${exp.location ? ', ' + exp.location : ''}`, size: 20, font: 'Arial', color: '444444' }),
            ],
          }),
          new Paragraph({
            spacing: { before: 0, after: 40 },
            children: [new TextRun({ text: exp.dates, size: 18, italics: true, color: '666666', font: 'Arial' })],
          }),
          ...(exp.bullets || []).map((b) => bullet(b)),
        );
      });
    }

    // Education
    if (data.education?.length) {
      children.push(divider(), sectionHead('EDUCATION'));
      data.education.forEach((edu) => {
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 10 },
            children: [new TextRun({ text: `${edu.degree}${edu.school ? '  —  ' + edu.school : ''}`, bold: true, size: 22, font: 'Arial', color: '1E3A5F' })],
          }),
          new Paragraph({
            spacing: { before: 0, after: 40 },
            children: [new TextRun({ text: [edu.dates, edu.details].filter(Boolean).join('  |  '), size: 18, italics: true, color: '666666', font: 'Arial' })],
          }),
        );
      });
    }

    // Projects
    if (data.projects?.length) {
      children.push(divider(), sectionHead('PROJECTS'));
      data.projects.forEach((proj, i) => {
        const titleRuns: TextRun[] = [
          new TextRun({ text: proj.name, bold: true, size: 22, font: 'Arial', color: '1E3A5F' }),
        ];
        if (proj.link) {
          titleRuns.push(new TextRun({ text: `  —  ${proj.link}`, size: 18, font: 'Arial', color: '2563EB' }));
        }
        children.push(
          new Paragraph({ spacing: { before: i === 0 ? 80 : 120, after: 10 }, children: titleRuns }),
        );
        if (proj.technologies) {
          children.push(
            new Paragraph({
              spacing: { before: 0, after: 10 },
              children: [new TextRun({ text: proj.technologies, size: 18, italics: true, color: '666666', font: 'Arial' })],
            }),
          );
        }
        if (proj.dates) {
          children.push(
            new Paragraph({
              spacing: { before: 0, after: 10 },
              children: [new TextRun({ text: proj.dates, size: 18, italics: true, color: '666666', font: 'Arial' })],
            }),
          );
        }
        if (proj.description) {
          children.push(
            new Paragraph({
              spacing: { before: 10, after: 20 },
              children: [new TextRun({ text: proj.description, size: 20, font: 'Arial' })],
            }),
          );
        }
        (proj.bullets || []).forEach((b) => children.push(bullet(b)));
      });
    }

    // Skills
    if (data.skills?.length) {
      children.push(divider(), sectionHead('TECHNICAL SKILLS'));
      children.push(
        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [2520, 7560],
          rows: data.skills.map(
            (s) =>
              new TableRow({
                children: [
                  new TableCell({
                    borders: noBorders,
                    width: { size: 2520, type: WidthType.DXA },
                    margins: { top: 40, bottom: 40, left: 60, right: 60 },
                    children: [new Paragraph({ children: [new TextRun({ text: s.category, bold: true, size: 20, font: 'Arial' })] })],
                  }),
                  new TableCell({
                    borders: noBorders,
                    width: { size: 7560, type: WidthType.DXA },
                    margins: { top: 40, bottom: 40, left: 60, right: 60 },
                    children: [new Paragraph({ children: [new TextRun({ text: s.items, size: 20, font: 'Arial' })] })],
                  }),
                ],
              }),
          ),
        }),
      );
    }

    // Certifications
    if (data.certifications?.length) {
      children.push(divider(), sectionHead('CERTIFICATIONS & ACHIEVEMENTS'));
      data.certifications.forEach((c) => children.push(bullet(c)));
    }

    // Languages
    if (data.languages?.length) {
      children.push(divider(), sectionHead('LANGUAGES'));
      children.push(
        new Paragraph({
          spacing: { before: 40, after: 80 },
          children: [new TextRun({ text: data.languages.join('  |  '), size: 20, font: 'Arial' })],
        }),
      );
    }

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'bullets',
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: '\u2022',
                alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 360, hanging: 180 } } },
              },
            ],
          },
        ],
      },
      styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
      sections: [
        {
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 900, right: 1080, bottom: 900, left: 1080 },
            },
          },
          children,
        },
      ],
    });

    return Buffer.from(await Packer.toBuffer(doc));
  }
}
