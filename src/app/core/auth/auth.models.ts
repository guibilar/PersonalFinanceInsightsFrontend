/**
 * What the user can do (T60). `read-only` can only read (the read-only token of Hestia.Api); every write gets 403.
 * An old server sends no scope: that counts as `full`.
 */
export type UserScope = 'full' | 'read-only';

export interface CurrentUser {
  username: string;
  scope?: UserScope;
}

export interface LoginInput {
  username: string;
  password: string;
  /** Keep the session after the browser closes. */
  rememberMe: boolean;
}

export interface SignedOutSessions {
  /** How many other sessions (browsers, devices) were signed out. */
  count: number;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
