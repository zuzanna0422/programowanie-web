import type { User } from '../models/User';
import type { UserService } from '../api/userService';
import { el } from '../ui/dom';
import { ROLE_LABELS } from '../ui/labels';

const buildTeamMember = (user: User, className = 'team-member', showRole = true): HTMLElement => {
  const item = el('div', className);
  const avatar = el('span', 'user-avatar user-avatar--sm', `${user.firstName[0]}${user.lastName[0]}`);
  const info = el('div', 'team-member__info');
  info.append(el('span', 'team-member__name', `${user.firstName} ${user.lastName}`));
  if (showRole) {
    info.append(el('span', `role-badge role-badge--${user.role}`, ROLE_LABELS[user.role]));
  }
  item.append(avatar, info);
  return item;
};

export const buildTeamSection = (userService: UserService): HTMLElement => {
  const section = el('section', 'team-section');
  const loggedUser = userService.getLoggedUser();

  const adminGroup = el('div', 'team-sidebar-group');
  adminGroup.append(el('h2', 'team-sidebar-title', 'Admin'));
  adminGroup.append(buildTeamMember(loggedUser, 'team-member team-member--lead', false));

  const teamGroup = el('div', 'team-sidebar-group');
  teamGroup.append(el('h2', 'team-sidebar-title', 'Team'));

  const list = el('div', 'team-list');
  userService
    .getAllUsers()
    .filter((user) => user.id !== loggedUser.id)
    .forEach((user) => {
      list.append(buildTeamMember(user));
    });
  teamGroup.append(list);

  section.append(adminGroup, teamGroup);
  return section;
};
