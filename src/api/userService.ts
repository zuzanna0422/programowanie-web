import { User } from '../models/User';
import { UserStorage } from './userStorage';
import { AuthService } from './authService';

export class UserService {
  private static instance: UserService;
  private userStorage = new UserStorage();
  private authService = AuthService.getInstance();

  private constructor() {}

  static getInstance(): UserService {
    if (!UserService.instance) UserService.instance = new UserService();
    return UserService.instance;
  }

  getLoggedUser(): User {
    const session = this.authService.getSession();
    if (!session) throw new Error('Not authenticated');
    const user = this.userStorage.getById(session.userId);
    if (!user) throw new Error(`User not found: ${session.userId}`);
    return user;
  }

  getUserById(id: string): User | undefined {
    return this.userStorage.getById(id);
  }

  getAllUsers(): User[] {
    return this.userStorage.getAll();
  }

  getAssignableUsers(): User[] {
    return this.userStorage.getAssignable();
  }

  getSelectableForStory(): User[] {
    return this.userStorage.getSelectableForStory();
  }

  updateUser(user: User): void {
    this.userStorage.upsert(user);
  }
}
