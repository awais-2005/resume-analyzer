import {
	Document,
	Packer,
	Paragraph,
	TextRun,
	Table,
	TableRow,
	TableCell,
	AlignmentType,
	LevelFormat,
	BorderStyle,
	WidthType,
} from "docx";
import AdmZip from "adm-zip";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import { StructuredResume } from "../types/structuredResume.types";
import { GeminiService } from "./gemini.service";

interface TextNode {
	obj: Record<string, unknown>;
	key: string;
}

const geminiService = GeminiService.getInstance();

// ─── XML text-node helpers ────────────────────────────────────────────────

function getTextNodes(xmlObj: unknown, nodes: TextNode[] = []): TextNode[] {
	if (Array.isArray(xmlObj)) {
		xmlObj.forEach((item) => getTextNodes(item, nodes));
	} else if (typeof xmlObj === "object" && xmlObj !== null) {
		for (const key of Object.keys(xmlObj)) {
			if (key === "w:t") {
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
	if (typeof val === "string") return val;
	if (typeof val === "object" && val !== null)
		return (val as Record<string, string>)["#text"] ?? "";
	return "";
}

function setTextOnNode(node: TextNode, newText: string): void {
	const val = node.obj[node.key];
	if (typeof val === "object" && val !== null) {
		node.obj[node.key] = { ...(val as object), "#text": newText };
	} else {
		node.obj[node.key] = newText;
	}
}

// ─── Public service ───────────────────────────────────────────────────────

export class DocxService {

	private static instance: DocxService;

	public static getInstance(): DocxService {
		if (!DocxService.instance) {
			DocxService.instance = new DocxService();
		}
		return DocxService.instance;
	}

	// Inject improved content into a DOCX buffer, preserving all formatting
	async injectContent<T>(docxBuffer: Buffer, improvedContent: T): Promise<Buffer> {
		const zip = new AdmZip(docxBuffer);
		const xmlData = zip.readAsText("word/document.xml");

		const parser = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: "@_",
			preserveOrder: false,
			parseTagValue: false,
			parseAttributeValue: false,
		});

		const builder = new XMLBuilder({
			ignoreAttributes: false,
			attributeNamePrefix: "@_",
			preserveOrder: false,
			suppressBooleanAttributes: false,
		});

		const xmlObj = parser.parse(xmlData);
		const nodes = getTextNodes(xmlObj);
		const origTexts = nodes.map(extractTextFromNode);

		// Filter out empty nodes for Gemini (but keep their indices)
		const nonEmpty = origTexts.map((t, i) => ({ i, t })).filter(({ t }) => t.trim() !== "");

		const remapped = await geminiService.remapText<T>(
			nonEmpty.map(({ t }) => t),
			improvedContent
		);

		// Write back only non-empty slots
		nonEmpty.forEach(({ i }, j) => setTextOnNode(nodes[i], remapped[j]));

		const newXml = builder.build(xmlObj);
		zip.updateFile("word/document.xml", Buffer.from(newXml, "utf8"));
		return zip.toBuffer();
	}

	// Build a formatted DOCX from structured resume data
	async buildDocx(data: Partial<StructuredResume>): Promise<Buffer> {
		// ── helpers ──────────────────────────────────────────────────────────────
		const safe = (v: unknown): string =>
			typeof v === "string" && v.trim().length > 0 ? v.trim() : "";

		const safeArr = <T>(v: unknown): T[] =>
			Array.isArray(v) ? (v as T[]).filter(Boolean) : [];

		const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
		const noBorders = {
			top: noBorder,
			bottom: noBorder,
			left: noBorder,
			right: noBorder,
		};

		const divider = () =>
			new Paragraph({
				border: {
					bottom: { style: BorderStyle.SINGLE, size: 6, color: "2563EB", space: 1 },
				},
				spacing: { before: 160, after: 80 },
				children: [],
			});

		const sectionHead = (text: string) =>
			new Paragraph({
				spacing: { before: 160, after: 60 },
				children: [
					new TextRun({ text, bold: true, size: 26, color: "1E3A5F", font: "Arial" }),
				],
			});

		const bullet = (text: string) => {
			const t = safe(text);
			if (!t) return null;
			return new Paragraph({
				numbering: { reference: "bullets", level: 0 },
				spacing: { before: 20, after: 20 },
				children: [new TextRun({ text: t, size: 20, font: "Arial" })],
			});
		};

		// push helper that silently drops nulls
		const push = (
			arr: (Paragraph | Table)[],
			...items: (Paragraph | Table | null | undefined)[]
		) => {
			for (const item of items) {
				if (item != null) arr.push(item);
			}
		};

		const children: (Paragraph | Table)[] = [];

		// ── Name header ──────────────────────────────────────────────────────────
		const name = safe(data?.name) || "Your Name";
		push(
			children,
			new Paragraph({
				alignment: AlignmentType.CENTER,
				spacing: { before: 0, after: 40 },
				children: [
					new TextRun({
						text: name,
						bold: true,
						size: 52,
						color: "1E3A5F",
						font: "Arial",
					}),
				],
			})
		);

		// ── Headline (sub-title under name) ──────────────────────────────────────
		const headline = safe(data?.headline);
		if (headline) {
			push(
				children,
				new Paragraph({
					alignment: AlignmentType.CENTER,
					spacing: { before: 0, after: 30 },
					children: [
						new TextRun({
							text: headline,
							size: 24,
							italics: true,
							color: "2563EB",
							font: "Arial",
						}),
					],
				})
			);
		}

		// ── Contact line ─────────────────────────────────────────────────────────
		const contactParts = [
			safe(data?.email),
			safe(data?.phone),
			safe(data?.linkedin),
			safe(data?.github),
			safe(data?.website),
			safe(data?.location),
		]
			.filter(Boolean)
			.join("  |  ");

		if (contactParts) {
			push(
				children,
				new Paragraph({
					alignment: AlignmentType.CENTER,
					spacing: { before: 0, after: 60 },
					children: [
						new TextRun({
							text: contactParts,
							size: 18,
							color: "555555",
							font: "Arial",
						}),
					],
				})
			);
		}

		// ── Summary ──────────────────────────────────────────────────────────────
		const summary = safe(data?.summary);
		if (summary) {
			push(
				children,
				divider(),
				sectionHead("PROFESSIONAL SUMMARY"),
				new Paragraph({
					spacing: { before: 40, after: 80 },
					children: [new TextRun({ text: summary, size: 20, font: "Arial" })],
				})
			);
		}

		// ── Experience ───────────────────────────────────────────────────────────
		const experience = safeArr<StructuredResume["experience"][number]>(data?.experience).filter(
			(exp) => safe(exp?.title) || safe(exp?.company)
		);

		if (experience.length > 0) {
			push(children, divider(), sectionHead("PROFESSIONAL EXPERIENCE"));

			experience.forEach((exp, i) => {
				const title = safe(exp.title);
				const company = safe(exp.company);
				const location = safe(exp.location);
				const dates = safe(exp.dates);
				const keyAchievement = safe(exp.keyAchievement);
				const bullets = safeArr<string>(exp.bullets).map(safe).filter(Boolean);

				const titleRuns: TextRun[] = [];
				if (title)
					titleRuns.push(
						new TextRun({
							text: title,
							bold: true,
							size: 22,
							font: "Arial",
							color: "1E3A5F",
						})
					);
				if (company) {
					const companySuffix = location ? `${company}, ${location}` : company;
					titleRuns.push(
						new TextRun({
							text: `${title ? "  —  " : ""}${companySuffix}`,
							size: 20,
							font: "Arial",
							color: "444444",
						})
					);
				}

				if (titleRuns.length > 0) {
					push(
						children,
						new Paragraph({
							spacing: { before: i === 0 ? 80 : 120, after: 10 },
							children: titleRuns,
						})
					);
				}

				if (dates) {
					push(
						children,
						new Paragraph({
							spacing: { before: 0, after: 20 },
							children: [
								new TextRun({
									text: dates,
									size: 18,
									italics: true,
									color: "666666",
									font: "Arial",
								}),
							],
						})
					);
				}

				bullets.forEach((b) => push(children, bullet(b)));

				if (keyAchievement) {
					push(
						children,
						new Paragraph({
							spacing: { before: 20, after: 40 },
							children: [
								new TextRun({
									text: "Key Achievement: ",
									bold: true,
									size: 20,
									font: "Arial",
									color: "1E3A5F",
								}),
								new TextRun({
									text: keyAchievement,
									size: 20,
									font: "Arial",
									italics: true,
								}),
							],
						})
					);
				}
			});
		}

		// ── Education ────────────────────────────────────────────────────────────
		const education = safeArr<StructuredResume["education"][number]>(data?.education).filter(
			(edu) => safe(edu?.degree) || safe(edu?.school)
		);

		if (education.length > 0) {
			push(children, divider(), sectionHead("EDUCATION"));

			education.forEach((edu) => {
				const degree = safe(edu.degree);
				const school = safe(edu.school);
				const dates = safe(edu.dates);
				const details = safe(edu.details);
				const highlights = safeArr<string>(edu.highlights).map(safe).filter(Boolean);

				const degreeLine = [degree, school].filter(Boolean).join("  —  ");
				if (degreeLine) {
					push(
						children,
						new Paragraph({
							spacing: { before: 80, after: 10 },
							children: [
								new TextRun({
									text: degreeLine,
									bold: true,
									size: 22,
									font: "Arial",
									color: "1E3A5F",
								}),
							],
						})
					);
				}

				const metaLine = [dates, details].filter(Boolean).join("  |  ");
				if (metaLine) {
					push(
						children,
						new Paragraph({
							spacing: { before: 0, after: 20 },
							children: [
								new TextRun({
									text: metaLine,
									size: 18,
									italics: true,
									color: "666666",
									font: "Arial",
								}),
							],
						})
					);
				}

				highlights.forEach((h) => push(children, bullet(h)));
			});
		}

		// ── Projects ─────────────────────────────────────────────────────────────
		const projects = safeArr<StructuredResume["projects"][number]>(data?.projects).filter(
			(p) => safe(p?.name) || safe(p?.description)
		);

		if (projects.length > 0) {
			push(children, divider(), sectionHead("PROJECTS"));

			projects.forEach((proj, i) => {
				const projName = safe(proj.name);
				const link = safe(proj.link);
				const tech = safe(proj.technologies);
				const dates = safe(proj.dates);
				const description = safe(proj.description);
				const impact = safe(proj.impact);
				const bullets = safeArr<string>(proj.bullets).map(safe).filter(Boolean);

				const titleRuns: TextRun[] = [];
				if (projName)
					titleRuns.push(
						new TextRun({
							text: projName,
							bold: true,
							size: 22,
							font: "Arial",
							color: "1E3A5F",
						})
					);
				if (link)
					titleRuns.push(
						new TextRun({
							text: `  —  ${link}`,
							size: 18,
							font: "Arial",
							color: "2563EB",
						})
					);

				if (titleRuns.length > 0) {
					push(
						children,
						new Paragraph({
							spacing: { before: i === 0 ? 80 : 120, after: 10 },
							children: titleRuns,
						})
					);
				}

				if (tech) {
					push(
						children,
						new Paragraph({
							spacing: { before: 0, after: 6 },
							children: [
								new TextRun({
									text: tech,
									size: 18,
									italics: true,
									color: "666666",
									font: "Arial",
								}),
							],
						})
					);
				}

				if (dates) {
					push(
						children,
						new Paragraph({
							spacing: { before: 0, after: 10 },
							children: [
								new TextRun({
									text: dates,
									size: 18,
									italics: true,
									color: "666666",
									font: "Arial",
								}),
							],
						})
					);
				}

				if (description) {
					push(
						children,
						new Paragraph({
							spacing: { before: 10, after: 20 },
							children: [new TextRun({ text: description, size: 20, font: "Arial" })],
						})
					);
				}

				bullets.forEach((b) => push(children, bullet(b)));

				if (impact) {
					push(
						children,
						new Paragraph({
							spacing: { before: 20, after: 40 },
							children: [
								new TextRun({
									text: "Impact: ",
									bold: true,
									size: 20,
									font: "Arial",
									color: "1E3A5F",
								}),
								new TextRun({
									text: impact,
									size: 20,
									font: "Arial",
									italics: true,
								}),
							],
						})
					);
				}
			});
		}

		// ── Skills ───────────────────────────────────────────────────────────────
		const skills = safeArr<StructuredResume["skills"][number]>(data?.skills).filter(
			(s) => safe(s?.category) && safe(s?.items)
		);

		if (skills.length > 0) {
			push(children, divider(), sectionHead("TECHNICAL SKILLS"));
			push(
				children,
				new Table({
					width: { size: 10080, type: WidthType.DXA },
					columnWidths: [2520, 7560],
					rows: skills.map(
						(s) =>
							new TableRow({
								children: [
									new TableCell({
										borders: noBorders,
										width: { size: 2520, type: WidthType.DXA },
										margins: { top: 40, bottom: 40, left: 60, right: 60 },
										children: [
											new Paragraph({
												children: [
													new TextRun({
														text: s.category,
														bold: true,
														size: 20,
														font: "Arial",
													}),
												],
											}),
										],
									}),
									new TableCell({
										borders: noBorders,
										width: { size: 7560, type: WidthType.DXA },
										margins: { top: 40, bottom: 40, left: 60, right: 60 },
										children: [
											new Paragraph({
												children: [
													new TextRun({
														text: s.items,
														size: 20,
														font: "Arial",
													}),
												],
											}),
										],
									}),
								],
							})
					),
				})
			);
		}

		// ── Certifications ───────────────────────────────────────────────────────
		const certifications = safeArr<string>(data?.certifications).map(safe).filter(Boolean);

		if (certifications.length > 0) {
			push(children, divider(), sectionHead("CERTIFICATIONS & ACHIEVEMENTS"));
			certifications.forEach((c) => push(children, bullet(c)));
		}

		// ── Languages ────────────────────────────────────────────────────────────
		const languages = safeArr<string>(data?.languages).map(safe).filter(Boolean);

		if (languages.length > 0) {
			push(
				children,
				divider(),
				sectionHead("LANGUAGES"),
				new Paragraph({
					spacing: { before: 40, after: 80 },
					children: [
						new TextRun({ text: languages.join("  |  "), size: 20, font: "Arial" }),
					],
				})
			);
		}

		// ── Additional Sections ──────────────────────────────────────────────────
		const additionalSections = safeArr<
			StructuredResume["additionalSections"] extends (infer T)[] | undefined
			? NonNullable<T>
			: never
		>(data?.additionalSections).filter(
			(sec) => safe(sec?.title) && safeArr(sec?.entries).length > 0
		);

		for (const section of additionalSections) {
			const sectionTitle = safe(section.title).toUpperCase();
			const entries = safeArr<
				NonNullable<StructuredResume["additionalSections"]>[number]["entries"][number]
			>(section.entries).filter((e) => safe(e?.label) || safe(e?.description));

			push(children, divider(), sectionHead(sectionTitle));

			entries.forEach((entry, i) => {
				const label = safe(entry.label);
				const description = safe(entry.description);
				const date = safe(entry.date);

				const entryRuns: TextRun[] = [];
				if (label)
					entryRuns.push(
						new TextRun({
							text: label,
							bold: true,
							size: 21,
							font: "Arial",
							color: "1E3A5F",
						})
					);
				if (date)
					entryRuns.push(
						new TextRun({
							text: `  —  ${date}`,
							size: 18,
							italics: true,
							color: "666666",
							font: "Arial",
						})
					);

				if (entryRuns.length > 0) {
					push(
						children,
						new Paragraph({
							spacing: { before: i === 0 ? 80 : 100, after: 8 },
							children: entryRuns,
						})
					);
				}

				if (description) {
					push(
						children,
						new Paragraph({
							spacing: { before: 0, after: 30 },
							children: [new TextRun({ text: description, size: 20, font: "Arial" })],
						})
					);
				}
			});
		}

		// ── Build Document ───────────────────────────────────────────────────────
		const doc = new Document({
			numbering: {
				config: [
					{
						reference: "bullets",
						levels: [
							{
								level: 0,
								format: LevelFormat.BULLET,
								text: "\u2022",
								alignment: AlignmentType.LEFT,
								style: { paragraph: { indent: { left: 360, hanging: 180 } } },
							},
						],
					},
				],
			},
			styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
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
