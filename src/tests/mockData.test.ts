import { StructuredResume } from "../types/structuredResume.types";

export const mockResume: Partial<StructuredResume> = {
    name: "Wasi Ahmed",
    email: "wasi@example.com",
    phone: "+92 300 1234567",
    location: "Islamabad, Pakistan",
    linkedin: "linkedin.com/in/wasiahmed",
    github: "github.com/wasiahmed",
    website: "wasiahmed.dev",
    headline: "Full Stack Developer",
    summary:
        "Third-year Computer Science student at NUML with hands-on experience building full-stack web applications. Passionate about backend architecture, AI-integrated tools, and clean TypeScript codebases.",

    experience: [
        {
            title: "Backend Developer Intern",
            company: "TechCorp Islamabad",
            location: "Islamabad, Pakistan",
            dates: "June 2024 - September 2024",
            bullets: [
                "Built REST APIs with Node.js and Express serving 10k+ daily requests",
                "Integrated Gemini AI API for document analysis features",
                "Reduced average response time by 40% through query optimization",
            ],
            keyAchievement: "Shipped resume analyzer MVP in 3 weeks solo",
        },
    ],

    projects: [
        {
            name: "Resume Analyzer",
            description:
                "AI-powered resume analysis tool with scoring, polishing, and PDF export features",
            technologies: "Node.js, Express, TypeScript, React, Next.js, Gemini API",
            link: "github.com/wasiahmed/resume-analyzer",
            dates: "2024 - Present",
            bullets: [
                "Designed weighted scoring system with ATS, keyword, and impact scores",
                "Built DOCX template engine supporting multiple resume layouts",
                "Implemented suggestion-apply endpoint preserving original formatting",
            ],
            impact: "Reduced resume revision time by 60% in user testing",
        },
        {
            name: "Keyword Research Tool",
            description: "Python CLI tool for scoring and ranking keywords from Excel/CSV datasets",
            technologies: "Python, pandas, openpyxl",
            dates: "2024",
            bullets: [
                "Processes 10k+ keywords with configurable weighted scoring formula",
                "Exports styled recommended.xlsx with category breakdowns",
            ],
        },
    ],

    education: [
        {
            degree: "BS Computer Science",
            school: "National University of Modern Languages (NUML)",
            dates: "2022 - Present",
            details: "Third Year",
            highlights: [
                "Relevant coursework: Data Structures, OOP, Digital Logic Design, Linear Algebra",
                "Active member of the university coding club",
            ],
        },
    ],

    skills: [
        { category: "Languages", items: "TypeScript, JavaScript, Python, C++" },
        { category: "Backend", items: "Node.js, Express.js, REST APIs" },
        { category: "Frontend", items: "React, Next.js, Tailwind CSS" },
        { category: "Tools", items: "Git, VS Code, Puppeteer, Handlebars" },
        { category: "AI/ML", items: "Gemini API, Prompt Engineering" },
    ],

    certifications: [
        "Google Developer Student Club - Web Dev Track 2023",
        "freeCodeCamp Responsive Web Design Certification",
    ],

    languages: ["Urdu (Native)", "English (Fluent)"],

    additionalSections: [
        {
            title: "Awards",
            entries: [
                {
                    label: "Best Project - NUML Hackathon",
                    description: "Won 1st place for an AI-based student assistant chatbot",
                    date: "March 2024",
                },
            ],
        },
    ],
};
