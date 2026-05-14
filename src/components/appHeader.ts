import type { User } from '../models/User';
import { AuthService } from '../api/authService';
import { el } from '../ui/dom';

type AppHeaderOptions = {
  user: User;
  notificationBadge: HTMLElement;
  onShowNotifications: () => void;
  onShowUsers: () => void;
};

export const buildAppHeader = (options: AppHeaderOptions): HTMLElement => {
  const { user } = options;
  const header = el('header', 'app-header');

  const brand = el('div', 'app-header__brand');
  const h1 = el('h1');
  h1.textContent = 'ManageMe';
  brand.append(h1);

  const right = el('div', 'app-header__right');

  const themeBtn = el('button', 'theme-toggle');
  themeBtn.type = 'button';
  themeBtn.setAttribute('aria-label', 'Toggle dark mode');
  const isDark = document.documentElement.classList.contains('dark');
  themeBtn.textContent = isDark ? '☀' : '☾';
  themeBtn.addEventListener('click', () => {
    const dark = document.documentElement.classList.toggle('dark');
    themeBtn.textContent = dark ? '☀' : '☾';
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  });

  const notifBellWrapper = el('div', 'notif-bell-wrapper');
  const notifBellBtn = el('button', 'notif-bell-btn');
  notifBellBtn.type = 'button';
  notifBellBtn.setAttribute('aria-label', 'Notifications');
  notifBellBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
  notifBellBtn.addEventListener('click', options.onShowNotifications);
  notifBellWrapper.append(notifBellBtn, options.notificationBadge);

  const userInfo = el('div', 'app-header__user');
  const avatar = el('span', 'user-avatar', `${user.firstName[0]}${user.lastName[0]}`);
  const userName = el('span', 'user-name', `${user.firstName} ${user.lastName}`);
  userInfo.append(avatar, userName);

  right.append(themeBtn, notifBellWrapper);

  if (user.role === 'admin') {
    const usersBtn = el('button', 'notif-nav-link', 'Users');
    usersBtn.type = 'button';
    usersBtn.addEventListener('click', options.onShowUsers);
    right.append(usersBtn);
  }

  const signOutBtn = el('button', 'notif-nav-link', 'Sign out');
  signOutBtn.type = 'button';
  signOutBtn.addEventListener('click', () => {
    AuthService.getInstance().clearSession();
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    window.location.reload();
  });

  right.append(userInfo, signOutBtn);
  header.append(brand, right);
  return header;
};
