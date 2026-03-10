export interface StructuredResume {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  website?: string;
  headline: string;
  summary: string;
  experience: {
    title: string;
    company: string;
    location: string;
    dates: string;
    bullets: string[];
    keyAchievement?: string;
  }[];
  projects: {
    name: string;
    description: string;
    technologies: string;
    link?: string;
    dates?: string;
    bullets: string[];
    impact?: string;
  }[];
  education: {
    degree: string;
    school: string;
    dates: string;
    details: string;
    highlights?: string[];
  }[];
  skills: {
    category: string;
    items: string;
  }[];
  certifications: string[];
  languages?: string[];
  additionalSections?: {
    title: string;
    entries: {
      label: string;
      description: string;
      date?: string;
    }[];
  }[];
  polishSummary: PolishSummary;
}

export interface PolishSummary {
  changesApplied: string[];
  scoreImprovementAreas: string[];
  atsKeywordsInjected: string[];
  estimatedNewScore: number;
};
