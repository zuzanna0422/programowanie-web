import { safeParse } from './utils';

export interface Project {
  id: string;
  name: string;
  description: string;
}

const STORAGE_KEY = 'manageMe:projects';
const ACTIVE_KEY = 'manageMe:activeProject';

type ProjectCreatePayload = Omit<Project, 'id'>;

type LegacyProject = Project & { nazwa?: string; opis?: string };

export class ProjectStorage {
  getAll(): Project[] {
    const raw = safeParse<LegacyProject[]>(localStorage.getItem(STORAGE_KEY), []);
    return raw.map((p) => ({
      id: p.id,
      name: p.name ?? p.nazwa ?? '',
      description: p.description ?? p.opis ?? '',
    }));
  }

  getById(id: string): Project | undefined {
    return this.getAll().find((p) => p.id === id);
  }

  create(payload: ProjectCreatePayload): Project {
    const projects = this.getAll();
    const newProject: Project = { id: crypto.randomUUID(), ...payload };
    projects.push(newProject);
    this.saveAll(projects);
    return newProject;
  }

  update(project: Project): Project {
    const projects = this.getAll().map((p) => (p.id === project.id ? project : p));
    this.saveAll(projects);
    return project;
  }

  delete(id: string): void {
    this.saveAll(this.getAll().filter((p) => p.id !== id));
  }

  getActiveProjectId(): string | null {
    return localStorage.getItem(ACTIVE_KEY);
  }

  setActiveProjectId(id: string | null): void {
    if (id === null) {
      localStorage.removeItem(ACTIVE_KEY);
    } else {
      localStorage.setItem(ACTIVE_KEY, id);
    }
  }

  private saveAll(projects: Project[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch {
      console.error('ManageMe: failed to save projects');
    }
  }
}
