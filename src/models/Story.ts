export type Priority = 'low' | 'medium' | 'high';
export type StoryStatus = 'todo' | 'doing' | 'done';

export interface Story {
  id: string;
  uid: number;
  name: string;
  description: string;
  priority: Priority;
  projectId: string;
  createdAt: string;
  status: StoryStatus;
  ownerId: string;
  assigneeId: string | null;
}

export type StoryCreatePayload = Omit<Story, 'id' | 'uid' | 'createdAt'>;
