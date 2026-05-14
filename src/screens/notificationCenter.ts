import type { Notification as AppNotification } from '../models/Notification';
import type { NotificationStorage } from '../api/notificationStorage';
import type { UserService } from '../api/userService';
import { el } from '../ui/dom';
import { fmtDateTime } from '../ui/format';
import { PRIORITY_LABELS } from '../ui/labels';

type NotificationCenterOptions = {
  notificationStorage: NotificationStorage;
  userService: UserService;
  onBackToPreviousView: () => void;
};

export class NotificationCenter {
  readonly badge: HTMLElement;
  readonly listView: HTMLElement;
  readonly detailView: HTMLElement;
  readonly dialog: HTMLElement;

  private readonly notificationStorage: NotificationStorage;
  private readonly userService: UserService;
  private readonly onBackToPreviousView: () => void;
  private readonly listContainer: HTMLElement;
  private readonly detailContent: HTMLElement;
  private readonly dialogTitle: HTMLElement;
  private readonly dialogMessage: HTMLElement;
  private readonly dialogPriority: HTMLElement;
  private readonly dialogViewBtn: HTMLButtonElement;
  private dialogQueue: AppNotification[] = [];
  private dialogActive = false;

  constructor(options: NotificationCenterOptions) {
    this.notificationStorage = options.notificationStorage;
    this.userService = options.userService;
    this.onBackToPreviousView = options.onBackToPreviousView;

    this.badge = el('span', 'notif-bell-dot notif-bell-dot--hidden');
    this.listView = el('div', 'view view-notif-list view--hidden');
    this.detailView = el('div', 'view view-notif-detail view--hidden');
    this.dialog = el('div', 'notif-dialog-container notif-dialog--hidden');

    this.listContainer = el('div', 'notif-list');
    this.detailContent = el('div', 'notif-detail-content');
    this.dialogTitle = el('h3', 'notif-dialog__title');
    this.dialogMessage = el('p', 'notif-dialog__message');
    this.dialogPriority = el('span', 'priority-badge');
    this.dialogViewBtn = el('button', 'button button-primary', 'View');

    this.buildListView();
    this.buildDetailView();
    this.buildDialog();
  }

  showList(): void {
    this.detailView.classList.add('view--hidden');
    this.listView.classList.remove('view--hidden');
    this.renderList();
  }

  hideAll(): void {
    this.listView.classList.add('view--hidden');
    this.detailView.classList.add('view--hidden');
  }

  send(data: Omit<AppNotification, 'id' | 'date' | 'isRead'>): void {
    const notif = this.notificationStorage.create(data);
    const currentUser = this.userService.getLoggedUser();
    if (notif.recipientId === currentUser.id) {
      this.refreshBadge();
      if (notif.priority === 'medium' || notif.priority === 'high') {
        this.dialogQueue.push(notif);
        if (!this.dialogActive) this.processDialogQueue();
      }
    }
  }

  refreshBadge(): void {
    const count = this.notificationStorage.getUnreadCount(this.userService.getLoggedUser().id);
    this.badge.classList.toggle('notif-bell-dot--hidden', count === 0);
  }

  private buildListView(): void {
    const backBtn = el('button', 'button button-back', '← Back');
    backBtn.type = 'button';
    backBtn.addEventListener('click', () => {
      this.listView.classList.add('view--hidden');
      this.onBackToPreviousView();
    });

    const header = el('div', 'notif-list-header');
    const title = el('h2', undefined, 'Notifications');
    const markAllBtn = el('button', 'button button-cancel', 'Mark all as read');
    markAllBtn.type = 'button';
    markAllBtn.addEventListener('click', () => {
      this.notificationStorage.markAllRead(this.userService.getLoggedUser().id);
      this.refreshBadge();
      this.renderList();
    });
    header.append(title, markAllBtn);

    this.listView.append(backBtn, header, this.listContainer);
  }

  private buildDetailView(): void {
    const backBtn = el('button', 'button button-back', '← Back');
    backBtn.type = 'button';
    backBtn.addEventListener('click', () => {
      this.detailView.classList.add('view--hidden');
      this.listView.classList.remove('view--hidden');
      this.renderList();
    });

    this.detailView.append(backBtn, this.detailContent);
  }

  private buildDialog(): void {
    const box = el('div', 'notif-dialog-box');

    const dialogHeader = el('div', 'notif-dialog__header');
    const closeBtn = el('button', 'modal-close', '✕');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', () => this.dismissDialog());
    dialogHeader.append(this.dialogPriority, closeBtn);

    this.dialogViewBtn.type = 'button';
    const dismissBtn = el('button', 'button button-cancel', 'Dismiss');
    dismissBtn.type = 'button';
    dismissBtn.addEventListener('click', () => this.dismissDialog());
    const dialogActions = el('div', 'notif-dialog__actions');
    dialogActions.append(this.dialogViewBtn, dismissBtn);

    box.append(dialogHeader, this.dialogTitle, this.dialogMessage, dialogActions);
    this.dialog.append(box);
  }

  private showDetail(id: string): void {
    this.notificationStorage.markRead(id);
    this.refreshBadge();
    this.listView.classList.add('view--hidden');
    this.detailView.classList.remove('view--hidden');
    this.renderDetail(id);
  }

  private renderList(): void {
    const user = this.userService.getLoggedUser();
    const notifs = this.notificationStorage.getByRecipient(user.id);
    this.listContainer.innerHTML = '';

    if (notifs.length === 0) {
      this.listContainer.append(el('p', 'empty-state', 'No notifications yet.'));
      return;
    }

    notifs.forEach((notif) => {
      const item = el('div', `notif-item${notif.isRead ? '' : ' notif-item--unread'}`);
      const dot = el('span', `notif-item__dot${notif.isRead ? ' notif-item__dot--read' : ''}`);
      const body = el('div', 'notif-item__body');
      const header = el('div', 'notif-item__header');
      header.append(
        el('span', 'notif-item__title', notif.title),
        el('span', `priority-badge priority-badge--${notif.priority}`, PRIORITY_LABELS[notif.priority]),
        el('span', 'notif-item__date', fmtDateTime(notif.date)),
      );

      const message = el('p', 'notif-item__message', notif.message);
      body.append(header, message);

      if (!notif.isRead) {
        const actions = el('div', 'notif-item__actions');
        const markReadBtn = el('button', 'button button-cancel notif-item__mark-read', 'Mark as read');
        markReadBtn.type = 'button';
        markReadBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.notificationStorage.markRead(notif.id);
          this.refreshBadge();
          this.renderList();
        });
        actions.append(markReadBtn);
        body.append(actions);
      }

      item.append(dot, body);
      item.addEventListener('click', () => this.showDetail(notif.id));
      this.listContainer.append(item);
    });
  }

  private renderDetail(id: string): void {
    const notif = this.notificationStorage.getById(id);
    this.detailContent.innerHTML = '';

    if (!notif) {
      this.detailContent.append(el('p', 'empty-state', 'Notification not found.'));
      return;
    }

    const header = el('div', 'notif-detail__header');
    header.append(
      el('h2', 'notif-detail__title', notif.title),
      el('span', `priority-badge priority-badge--${notif.priority}`, PRIORITY_LABELS[notif.priority]),
    );

    const meta = el('div', 'notif-detail__meta');
    meta.append(
      el('span', 'notif-detail__date', fmtDateTime(notif.date)),
      el('span', `notif-detail__status notif-detail__status--${notif.isRead ? 'read' : 'unread'}`, notif.isRead ? 'Read' : 'Unread'),
    );

    const message = el('p', 'notif-detail__message', notif.message);
    this.detailContent.append(header, meta, message);
  }

  private processDialogQueue(): void {
    if (this.dialogQueue.length === 0) {
      this.dialogActive = false;
      return;
    }
    this.dialogActive = true;
    const notif = this.dialogQueue.shift()!;
    this.dialogTitle.textContent = notif.title;
    this.dialogMessage.textContent = notif.message;
    this.dialogPriority.textContent = PRIORITY_LABELS[notif.priority];
    this.dialogPriority.className = `priority-badge priority-badge--${notif.priority}`;
    this.dialogViewBtn.onclick = () => {
      this.dismissDialog();
      this.showDetail(notif.id);
    };
    this.dialog.classList.remove('notif-dialog--hidden');
  }

  private dismissDialog(): void {
    this.dialog.classList.add('notif-dialog--hidden');
    setTimeout(() => this.processDialogQueue(), 300);
  }
}
