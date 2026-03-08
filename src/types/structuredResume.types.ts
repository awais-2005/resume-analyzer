export interface StructuredResume {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  website?: string;
  summary: string;
  experience: {
    title: string;
    company: string;
    location: string;
    dates: string;
    bullets: string[];
  }[];
  projects: {
    name: string;
    description: string;
    technologies: string;
    link?: string;
    dates?: string;
    bullets: string[];
  }[];
  education: {
    degree: string;
    school: string;
    dates: string;
    details: string;
  }[];
  skills: {
    category: string;
    items: string;
  }[];
  certifications: string[];
  languages?: string[];
}
