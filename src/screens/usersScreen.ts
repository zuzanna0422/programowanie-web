import type { UserRole } from '../models/User';
import type { UserService } from '../api/userService';
import { el } from '../ui/dom';
import { ROLE_LABELS } from '../ui/labels';

type UsersScreenOptions = {
  userService: UserService;
  onBack: () => void;
};

export class UsersScreen {
  readonly element: HTMLElement;
  private readonly userService: UserService;
  private readonly listContent: HTMLElement;
  private readonly onBack: () => void;

  constructor(options: UsersScreenOptions) {
    this.userService = options.userService;
    this.onBack = options.onBack;
    this.element = el('div', 'view view-users view--hidden');

    const backBtn = el('button', 'button button-back', '← Back');
    backBtn.type = 'button';
    backBtn.addEventListener('click', () => this.back());

    const header = el('div', 'notif-list-header');
    header.append(el('h2', undefined, 'User Management'));

    this.listContent = el('div', 'users-list');
    this.element.append(backBtn, header, this.listContent);
  }

  show(): void {
    this.element.classList.remove('view--hidden');
    this.render();
  }

  hide(): void {
    this.element.classList.add('view--hidden');
  }

  private back(): void {
    this.hide();
    this.onBack();
  }

  private render(): void {
    const users = this.userService.getAllUsers();
    const currentUser = this.userService.getLoggedUser();
    this.listContent.innerHTML = '';

    if (users.length === 0) {
      this.listContent.append(el('p', 'empty-state', 'No users yet.'));
      return;
    }

    const roles: UserRole[] = ['admin', 'devops', 'developer', 'guest'];

    users.forEach((u) => {
      const isSelf = u.id === currentUser.id;
      const row = el('div', `user-mgmt-row${u.isBlocked ? ' user-mgmt-row--blocked' : ''}`);

      const avatarEl = el('span', 'user-avatar user-avatar--sm', `${u.firstName[0]}${u.lastName[0]}`);

      const info = el('div', 'user-mgmt-info');
      info.append(el('span', 'user-mgmt-name', `${u.firstName} ${u.lastName}`));
      info.append(el('span', 'user-mgmt-email', u.email));

      const roleSelect = el('select', 'user-mgmt-role-select');
      roles.forEach((r) => {
        const opt = el('option');
        opt.value = r;
        opt.textContent = ROLE_LABELS[r];
        if (r === u.role) opt.selected = true;
        roleSelect.append(opt);
      });
      roleSelect.disabled = isSelf;
      roleSelect.addEventListener('change', () => {
        this.userService.updateUser({ ...u, role: roleSelect.value as UserRole });
        this.render();
      });

      const blockBtn = el('button', `button ${u.isBlocked ? 'user-mgmt-btn--unblock' : 'user-mgmt-btn--block'}`, u.isBlocked ? 'Unblock' : 'Block');
      blockBtn.type = 'button';
      blockBtn.disabled = isSelf;
      blockBtn.addEventListener('click', () => {
        this.userService.updateUser({ ...u, isBlocked: !u.isBlocked });
        this.render();
      });

      row.append(avatarEl, info, roleSelect, blockBtn);
      this.listContent.append(row);
    });
  }
}
