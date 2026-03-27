export type UserRole = 'admin' | 'devops' | 'developer';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}
