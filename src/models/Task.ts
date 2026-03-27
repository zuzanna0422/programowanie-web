export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Task {
  id: string;
  uid: number;
  name: string;
  description: string;
  priority: TaskPriority;
  storyId: string;
  estimatedHours: number;
  actualHours: number | null;
  status: TaskStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  assigneeId: string | null;
}

export type TaskCreatePayload = Omit<Task, 'id' | 'uid' | 'createdAt' | 'startedAt' | 'completedAt' | 'assigneeId' | 'actualHours'>;
