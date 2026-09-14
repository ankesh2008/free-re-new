export interface User {
  id: string;
  username: string;
  email: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem('freere_user');
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setStoredUser(user: User, token?: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('freere_user', JSON.stringify(user));
  if (token) localStorage.setItem('freere_token', token);
}

export function clearStoredUser() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('freere_user');
  localStorage.removeItem('freere_token');
}
