import './styles.css';
import { UserStorage } from './api/userStorage';
import { AuthService } from './api/authService';
import { NotificationStorage } from './api/notificationStorage';
import { hydrateDatabaseStorage } from './api/storageDriver';
import { SUPER_ADMIN_EMAIL, GOOGLE_CLIENT_ID } from './config';
import type { User } from './models/User';

const root = document.getElementById('app')!;
const userStorage = new UserStorage();
const authService = AuthService.getInstance();
const notifStorage = new NotificationStorage();

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

function parseJwt(token: string): Record<string, string> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)) as Record<string, string>;
  } catch {
    return {};
  }
}

function onGoogleSignIn(resp: { credential: string }): void {
  const p = parseJwt(resp.credential);
  const googleId = p['sub'] ?? crypto.randomUUID();
  const email = p['email'] ?? '';
  const firstName = p['given_name'] || (p['name'] ?? 'User').split(' ')[0];
  const lastName = p['family_name'] || (p['name'] ?? '').split(' ').slice(1).join(' ');

  let user = userStorage.getByEmail(email);

  if (!user) {
    const role = email === SUPER_ADMIN_EMAIL ? 'admin' : 'guest';
    user = {
      id: googleId,
      firstName,
      lastName,
      email,
      role,
      isBlocked: false,
      createdAt: new Date().toISOString(),
    };
    userStorage.upsert(user);

    if (email !== SUPER_ADMIN_EMAIL) {
      userStorage.getAdmins().forEach((admin) => {
        notifStorage.create({
          title: 'New user registration',
          message: `${firstName} ${lastName} (${email}) registered and is awaiting account approval.`,
          priority: 'high',
          recipientId: admin.id,
        });
      });
    }
  } else if (email === SUPER_ADMIN_EMAIL && user.role !== 'admin') {
    user = { ...user, role: 'admin', isBlocked: false };
    userStorage.upsert(user);
  }

  if (user.isBlocked) {
    showBlockedView();
    return;
  }

  authService.setSession(user.id);
  renderView();
}

function renderView(): void {
  const session = authService.getSession();
  if (!session) { showLoginView(); return; }

  let user = userStorage.getById(session.userId);
  if (!user) { authService.clearSession(); showLoginView(); return; }

  if (user.email === SUPER_ADMIN_EMAIL && user.role !== 'admin') {
    user = { ...user, role: 'admin', isBlocked: false };
    userStorage.upsert(user);
  }

  if (user.isBlocked) { showBlockedView(); return; }
  if (user.role === 'guest') { showGuestView(user); return; }

  launchApp();
}

function showLoginView(): void {
  root.innerHTML = '';
  root.className = '';

  const screen = el('div', 'auth-screen');
  const card = el('div', 'auth-card');

  const logo = el('h1', 'auth-logo', 'ManageMe');
  const tagline = el('p', 'auth-tagline', 'Sign in to continue');

  card.append(logo, tagline);

  if (!GOOGLE_CLIENT_ID) {
    card.append(el('p', 'auth-error', 'Google Client ID not configured. Add VITE_GOOGLE_CLIENT_ID to .env'));
  } else {
    const btnWrap = el('div', 'google-btn-wrapper');
    btnWrap.id = 'google-signin-btn';
    card.append(btnWrap);

    const tryRender = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onGoogleSignIn });
        window.google.accounts.id.renderButton(btnWrap, { theme: 'outline', size: 'large', width: '280' });
      } else {
        setTimeout(tryRender, 100);
      }
    };
    tryRender();
  }

  screen.append(card);
  root.append(screen);
}

function showGuestView(user: User): void {
  root.innerHTML = '';
  root.className = '';

  const screen = el('div', 'auth-screen');
  const card = el('div', 'auth-card');

  const avatar = el('div', 'auth-avatar', `${user.firstName[0]}${user.lastName[0]}`);
  const name = el('p', 'auth-user-name', `${user.firstName} ${user.lastName}`);
  const email = el('p', 'auth-user-email', user.email);
  const icon = el('div', 'auth-state-icon', '⏳');
  const heading = el('h2', 'auth-state-heading', 'Awaiting account approval');
  const desc = el('p', 'auth-state-desc', 'Your account has been created and is waiting for an administrator to assign your role. Use the button below to check if your access has been granted.');

  const checkBtn = el('button', 'button button-primary auth-btn', 'Check status');
  checkBtn.type = 'button';
  checkBtn.addEventListener('click', () => renderView());

  const signOutBtn = el('button', 'button button-cancel auth-btn', 'Sign out');
  signOutBtn.type = 'button';
  signOutBtn.addEventListener('click', () => {
    authService.clearSession();
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    showLoginView();
  });

  card.append(avatar, name, email, icon, heading, desc, checkBtn, signOutBtn);
  screen.append(card);
  root.append(screen);
}

function showBlockedView(): void {
  root.innerHTML = '';
  root.className = '';

  const screen = el('div', 'auth-screen');
  const card = el('div', 'auth-card');

  const icon = el('div', 'auth-state-icon auth-state-icon--danger', '🚫');
  const heading = el('h2', 'auth-state-heading', 'Account blocked');
  const desc = el('p', 'auth-state-desc', 'Your account has been blocked by an administrator. Please contact the system admin for more information.');

  const signOutBtn = el('button', 'button button-cancel auth-btn', 'Sign out');
  signOutBtn.type = 'button';
  signOutBtn.addEventListener('click', () => {
    authService.clearSession();
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    showLoginView();
  });

  card.append(icon, heading, desc, signOutBtn);
  screen.append(card);
  root.append(screen);
}

function launchApp(): void {
  root.innerHTML = '';
  root.className = '';
  import('./App').then(({ App }) => new App(root));
}

hydrateDatabaseStorage().finally(() => renderView());
