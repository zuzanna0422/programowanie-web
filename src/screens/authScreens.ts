import type { User } from '../models/User';
import { el } from '../ui/dom';

type GoogleSignInResponse = { credential: string };

type LoginScreenOptions = {
  googleClientId: string;
  onGoogleSignIn: (resp: GoogleSignInResponse) => void;
};

type AccountStateOptions = {
  onSignOut: () => void;
};

type GuestScreenOptions = AccountStateOptions & {
  onCheckStatus: () => void;
};

const resetRoot = (root: HTMLElement) => {
  root.innerHTML = '';
  root.className = '';
};

export function showLoginView(root: HTMLElement, options: LoginScreenOptions): void {
  resetRoot(root);

  const screen = el('div', 'auth-screen');
  const card = el('div', 'auth-card');

  const logo = el('h1', 'auth-logo', 'ManageMe');
  const tagline = el('p', 'auth-tagline', 'Sign in to continue');

  card.append(logo, tagline);

  if (!options.googleClientId) {
    card.append(el('p', 'auth-error', 'Google Client ID not configured. Add VITE_GOOGLE_CLIENT_ID to .env'));
  } else {
    const btnWrap = el('div', 'google-btn-wrapper');
    btnWrap.id = 'google-signin-btn';
    card.append(btnWrap);

    const tryRender = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: options.googleClientId,
          callback: options.onGoogleSignIn,
        });
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

export function showGuestView(root: HTMLElement, user: User, options: GuestScreenOptions): void {
  resetRoot(root);

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
  checkBtn.addEventListener('click', options.onCheckStatus);

  const signOutBtn = el('button', 'button button-cancel auth-btn', 'Sign out');
  signOutBtn.type = 'button';
  signOutBtn.addEventListener('click', options.onSignOut);

  card.append(avatar, name, email, icon, heading, desc, checkBtn, signOutBtn);
  screen.append(card);
  root.append(screen);
}

export function showBlockedView(root: HTMLElement, options: AccountStateOptions): void {
  resetRoot(root);

  const screen = el('div', 'auth-screen');
  const card = el('div', 'auth-card');

  const icon = el('div', 'auth-state-icon auth-state-icon--danger', '🚫');
  const heading = el('h2', 'auth-state-heading', 'Account blocked');
  const desc = el('p', 'auth-state-desc', 'Your account has been blocked by an administrator. Please contact the system admin for more information.');

  const signOutBtn = el('button', 'button button-cancel auth-btn', 'Sign out');
  signOutBtn.type = 'button';
  signOutBtn.addEventListener('click', options.onSignOut);

  card.append(icon, heading, desc, signOutBtn);
  screen.append(card);
  root.append(screen);
}
