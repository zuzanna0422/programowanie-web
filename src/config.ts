// Email that receives admin role immediately on first login (super admin).
// All other new users get the 'guest' role and await approval.
export const SUPER_ADMIN_EMAIL = 'zuzia.cholewa@gmail.com';

// Set VITE_GOOGLE_CLIENT_ID in a .env file at the project root.
// Example: VITE_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ?? '';

export const STORAGE_DRIVER = ((import.meta.env.VITE_STORAGE_DRIVER as string) ?? 'localStorage') as
  | 'localStorage'
  | 'supabase';

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) ?? '';
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? '';
