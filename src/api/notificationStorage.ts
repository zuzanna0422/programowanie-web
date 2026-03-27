import { Notification, UserID } from '../models/Notification';

const STORAGE_KEY = 'manageMe:notifications';

export class NotificationStorage {
  private load(): Notification[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Notification[]) : [];
    } catch {
      return [];
    }
  }

  private save(data: Notification[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  create(data: Omit<Notification, 'id' | 'date' | 'isRead'>): Notification {
    const all = this.load();
    const notif: Notification = {
      ...data,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      date: new Date().toISOString(),
      isRead: false,
    };
    all.unshift(notif);
    this.save(all);
    return notif;
  }

  getById(id: string): Notification | undefined {
    return this.load().find((n) => n.id === id);
  }

  getByRecipient(userId: UserID): Notification[] {
    return this.load().filter((n) => n.recipientId === userId);
  }

  getUnreadCount(userId: UserID): number {
    return this.load().filter((n) => n.recipientId === userId && !n.isRead).length;
  }

  markRead(id: string): void {
    const all = this.load();
    const n = all.find((n) => n.id === id);
    if (n && !n.isRead) {
      n.isRead = true;
      this.save(all);
    }
  }

  markAllRead(userId: UserID): void {
    const all = this.load();
    let changed = false;
    all.forEach((n) => {
      if (n.recipientId === userId && !n.isRead) {
        n.isRead = true;
        changed = true;
      }
    });
    if (changed) this.save(all);
  }
}
