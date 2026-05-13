import { User, UserRole } from '../models/User';
import { storageSetItem } from './storageDriver';

const STORAGE_KEY = 'manageMe:users';

export class UserStorage {
  private load(): User[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as User[]) : [];
    } catch {
      return [];
    }
  }

  private save(users: User[]): void {
    storageSetItem(STORAGE_KEY, JSON.stringify(users));
  }

  getAll(): User[] {
    return this.load();
  }

  getById(id: string): User | undefined {
    return this.load().find((u) => u.id === id);
  }

  getByEmail(email: string): User | undefined {
    return this.load().find((u) => u.email === email);
  }

  upsert(user: User): void {
    const all = this.load();
    const idx = all.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      all[idx] = user;
    } else {
      all.push(user);
    }
    this.save(all);
  }

  getAdmins(): User[] {
    return this.load().filter((u) => u.role === 'admin' && !u.isBlocked);
  }

  getAssignable(): User[] {
    return this.load().filter(
      (u) => (u.role === 'developer' || u.role === 'devops') && !u.isBlocked,
    );
  }

  getSelectableForStory(): User[] {
    return this.load().filter(
      (u) => (u.role as UserRole) !== 'guest' && !u.isBlocked,
    );
  }
}
