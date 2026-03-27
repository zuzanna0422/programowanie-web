import { User } from '../models/User';

export class UserService {
  private static instance: UserService;

  private readonly users: User[] = [
    { id: 'mock-user-1', firstName: 'Zuzanna', lastName: 'Cholewa', role: 'admin' },
    { id: 'user-dev-1', firstName: 'Adam', lastName: 'Kowalski', role: 'developer' },
    { id: 'user-devops-1', firstName: 'Michał', lastName: 'Nowak', role: 'devops' },
    { id: 'user-dev-2', firstName: 'Katarzyna', lastName: 'Wiśniewska', role: 'developer' },
  ];

  private readonly loggedUserId = 'mock-user-1';

  private constructor() {}

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  getLoggedUser(): User {
    const user = this.users.find((u) => u.id === this.loggedUserId);
    if (!user) throw new Error(`Logged user "${this.loggedUserId}" not found in user list`);
    return user;
  }

  getUserById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  getAllUsers(): User[] {
    return this.users;
  }

  getAssignableUsers(): User[] {
    return this.users.filter((u) => u.role === 'developer' || u.role === 'devops');
  }
}
