export type UserRole = 'admin' | 'devops' | 'developer' | 'guest';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isBlocked: boolean;
  createdAt: string;
}
