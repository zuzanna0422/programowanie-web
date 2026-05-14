import './styles.css';
import { UserStorage } from './api/userStorage';
import { AuthService } from './api/authService';
import { NotificationStorage } from './api/notificationStorage';
import { hydrateDatabaseStorage } from './api/storageDriver';
import { SUPER_ADMIN_EMAIL, GOOGLE_CLIENT_ID } from './config';
import { showBlockedView, showGuestView, showLoginView } from './screens/authScreens';

const root = document.getElementById('app')!;
const userStorage = new UserStorage();
const authService = AuthService.getInstance();
const notifStorage = new NotificationStorage();

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
    showBlockedView(root, { onSignOut: signOutToLogin });
    return;
  }

  authService.setSession(user.id);
  renderView();
}

function renderView(): void {
  const session = authService.getSession();
  if (!session) { showLoginScreen(); return; }

  let user = userStorage.getById(session.userId);
  if (!user) { authService.clearSession(); showLoginScreen(); return; }

  if (user.email === SUPER_ADMIN_EMAIL && user.role !== 'admin') {
    user = { ...user, role: 'admin', isBlocked: false };
    userStorage.upsert(user);
  }

  if (user.isBlocked) { showBlockedView(root, { onSignOut: signOutToLogin }); return; }
  if (user.role === 'guest') {
    showGuestView(root, user, {
      onCheckStatus: renderView,
      onSignOut: signOutToLogin,
    });
    return;
  }

  launchApp();
}

function showLoginScreen(): void {
  showLoginView(root, {
    googleClientId: GOOGLE_CLIENT_ID,
    onGoogleSignIn,
  });
}

function signOutToLogin(): void {
  authService.clearSession();
  if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
  showLoginScreen();
}

function launchApp(): void {
  root.innerHTML = '';
  root.className = '';
  import('./App').then(({ App }) => new App(root));
}

hydrateDatabaseStorage().finally(() => renderView());
