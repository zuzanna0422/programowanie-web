import { User } from '../models/User';

export class UserService {
  private static instance: UserService;

  private readonly currentUser: User = {
    id: 'mock-user-1',
    firstName: 'Zuzanna',
    lastName: 'Cholewa',
  };

  private constructor() {}

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  getLoggedUser(): User {
    return this.currentUser;
  }

  getUserById(id: string): User | undefined {
    return this.currentUser.id === id ? this.currentUser : undefined;
  }
}
