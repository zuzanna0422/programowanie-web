import type { TaskPriority, TaskStatus } from '../models/Task';
import type { Priority, StoryStatus } from '../models/Story';
import type { UserRole } from '../models/User';

export const PRIORITY_LABELS: Record<TaskPriority | Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const STORY_STATUS_LABELS: Record<StoryStatus, string> = {
  todo: 'New',
  doing: 'In Progress',
  done: 'Done',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  doing: 'Doing',
  done: 'Done',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  developer: 'Developer',
  devops: 'DevOps',
  guest: 'Guest',
};
