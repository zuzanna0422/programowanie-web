import { Story, StoryCreatePayload } from '../models/Story';
import { safeParse } from './utils';

const STORAGE_KEY = 'manageMe:stories';
const UID_KEY = 'manageMe:story_uid';

export class StoryStorage {
  private nextUid(): number {
    const current = parseInt(localStorage.getItem(UID_KEY) ?? '100000', 10);
    const next = current + 1;
    localStorage.setItem(UID_KEY, String(next));
    return next;
  }

  private getAll(): Story[] {
    type Stored = Omit<Story, 'uid' | 'assigneeId'> & { uid?: number; assigneeId?: string | null };
    const raw = safeParse<Stored[]>(localStorage.getItem(STORAGE_KEY), []);
    return raw.map((s, i) => ({
      ...s,
      uid: s.uid ?? 100001 + i,
      assigneeId: s.assigneeId !== undefined ? s.assigneeId : null,
    }));
  }

  private saveAll(stories: Story[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
    } catch {
      console.error('ManageMe: failed to save stories');
    }
  }

  getAllByProject(projectId: string): Story[] {
    return this.getAll().filter((s) => s.projectId === projectId);
  }

  getById(id: string): Story | undefined {
    return this.getAll().find((s) => s.id === id);
  }

  create(payload: StoryCreatePayload): Story {
    const stories = this.getAll();
    const newStory: Story = {
      id: crypto.randomUUID(),
      uid: this.nextUid(),
      createdAt: new Date().toISOString(),
      ...payload,
    };
    stories.push(newStory);
    this.saveAll(stories);
    return newStory;
  }

  update(story: Story): Story {
    const stories = this.getAll().map((s) => (s.id === story.id ? story : s));
    this.saveAll(stories);
    return story;
  }

  delete(id: string): void {
    this.saveAll(this.getAll().filter((s) => s.id !== id));
  }

  deleteByProject(projectId: string): void {
    this.saveAll(this.getAll().filter((s) => s.projectId !== projectId));
  }
}
