export interface CurrentUser {
  username: string;
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
