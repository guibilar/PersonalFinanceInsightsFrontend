export interface CurrentUser {
  username: string;
}

export interface LoginInput {
  username: string;
  password: string;
  /** Keep the session after the browser closes. */
  rememberMe: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
