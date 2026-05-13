import { Task, TaskCreatePayload } from '../models/Task';
import { safeParse } from './utils';
import { storageSetItem } from './storageDriver';

const STORAGE_KEY = 'manageMe:tasks';
const UID_KEY = 'manageMe:task_uid';

export class TaskStorage {
  private nextUid(): number {
    const current = parseInt(localStorage.getItem(UID_KEY) ?? '200000', 10);
    const next = current + 1;
    storageSetItem(UID_KEY, String(next));
    return next;
  }

  private getAll(): Task[] {
    return safeParse<Task[]>(localStorage.getItem(STORAGE_KEY), []);
  }

  private saveAll(tasks: Task[]): void {
    storageSetItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  getAllByStory(storyId: string): Task[] {
    return this.getAll().filter((t) => t.storyId === storyId);
  }

  getAllByStories(storyIds: string[]): Task[] {
    return this.getAll().filter((t) => storyIds.includes(t.storyId));
  }

  getById(id: string): Task | undefined {
    return this.getAll().find((t) => t.id === id);
  }

  create(payload: TaskCreatePayload): Task {
    const tasks = this.getAll();
    const newTask: Task = {
      id: crypto.randomUUID(),
      uid: this.nextUid(),
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      assigneeId: null,
      actualHours: null,
      ...payload,
    };
    tasks.push(newTask);
    this.saveAll(tasks);
    return newTask;
  }

  update(task: Task): Task {
    const tasks = this.getAll().map((t) => (t.id === task.id ? task : t));
    this.saveAll(tasks);
    return task;
  }

  delete(id: string): void {
    this.saveAll(this.getAll().filter((t) => t.id !== id));
  }

  deleteByStory(storyId: string): void {
    this.saveAll(this.getAll().filter((t) => t.storyId !== storyId));
  }
}
