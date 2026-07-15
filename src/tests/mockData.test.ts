// import { PdfService } from "../services/pdf.service";
import { StructuredResume } from "../types/structuredResume.types";

export const structuredResumeExample: StructuredResume = {
    name: "John Doe",
    email: "johndoe@example.com",
    phone: "+1-555-0199",
    location: "New York, NY",
    linkedin: "https://linkedin.com/in/johndoe",
    github: "https://github.com/johndoe",
    website: "https://johndoe.dev", // Optional
    profileImage: "https://example.com/profiles/johndoe.jpg", // Optional
    headline: "Full Stack Software Engineer",
    summary: "Results-driven Software Engineer with over 4 years of experience building scalable web applications. Passionate about optimization, clean code, and cloud architecture.",
    experience: [
        {
            title: "Senior Software Engineer",
            company: "Tech Corp",
            location: "New York, NY",
            dates: "Jan 2024 - Present",
            bullets: [
                "Led a team of 4 developers to migrate a monolithic architecture into microservices, reducing server response times by 30%.",
                "Optimized database queries in PostgreSQL, improving dashboard loading speed by 45%.",
                "Implemented automated CI/CD pipelines using GitHub Actions, cutting deployment time in half."
            ],
            keyAchievement: "Successfully migrated legacy systems with zero downtime." // Optional
        },
        {
            title: "Software Engineer",
            company: "Web Solutions Inc",
            location: "Remote",
            dates: "Jun 2022 - Dec 2023",
            bullets: [
                "Developed and maintained responsive web applications using React.js and Node.js.",
                "Collaborated closely with UI/UX designers to implement pixel-perfect user interfaces."
            ]
        }
    ],
    projects: [
        {
            name: "E-Commerce Analytics Dashboard",
            description: "A real-time data visualization platform tracking daily sales, user retention, and inventory turnover.",
            technologies: "React, Node.js, Express, Chart.js, TailwindCSS",
            link: "https://github.com/johndoe/analytics-dashboard", // Optional
            dates: "Mar 2025 - May 2025", // Optional
            bullets: [
                "Processed millions of daily data points using WebSockets for live dashboard updates.",
                "Integrated secure JWT authentication and role-based access control."
            ],
            impact: "Increased operational efficiency for alpha clients by 20%." // Optional
        }
    ],
    education: [
        {
            degree: "Bachelor of Science in Computer Science",
            school: "State University",
            dates: "Sep 2018 - May 2022",
            details: "Graduated with Honors. Specialized in Software Engineering.",
            highlights: [
                "Dean's List (all semesters)",
                "Cap-stone project won 'Best Innovation' award"
            ] // Optional
        }
    ],
    skills: [
        {
            category: "Languages",
            items: "JavaScript, TypeScript, Python, HTML/CSS, SQL"
        },
        {
            category: "Frameworks & Tools",
            items: "React, Node.js, Next.js, FastAPI, Docker, Git, AWS"
        }
    ],
    certifications: [
        "AWS Certified Solutions Architect – Associate",
        "Meta Front-End Developer Professional Certificate"
    ],
    languages: ["English (Native)", "Spanish (Conversational)"], // Optional
    additionalSections: [
        {
            title: "Awards & Honors",
            entries: [
                {
                    label: "Hackathon Winner",
                    description: "Placed 1st out of 50 teams at CityHack 2025 for building an AI-powered study tool.",
                    date: "Nov 2025" // Optional
                }
            ]
        }
    ], // Optional
    polishSummary: {
        changesApplied: [
            "Replaced weak verbs with strong action verbs (e.g., changed 'helped build' to 'Led a team to migrate').",
            "Quantified impact by adding specific metrics (e.g., 'reducing server response times by 30%').",
            "Aligned professional summary to target high-level Software Engineering roles."
        ],
        scoreImprovementAreas: [
            "Strengthened project description metrics.",
            "Fixed formatting consistency across dates."
        ],
        atsKeywordsInjected: [
            "Microservices",
            "CI/CD pipelines",
            "PostgreSQL optimization",
            "Cloud architecture"
        ],
        estimatedNewScore: 88
    }
};

// const pdfService = PdfService.getInstance();
// (async function () { await pdfService.renderToFile(structuredResumeExample, "temp1", "mock1.pdf") })();
