import type { CreateUserInput, LoginInput, RegisterInput, User } from '@auction/types';

export type ApiClientOptions = {
  baseUrl: string;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}/api${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && 'message' in payload && String(payload.message)) ||
      res.statusText ||
      'Request failed';
    throw new ApiError(res.status, message, payload);
  }
  return payload as T;
}

export function createApiClient({ baseUrl }: ApiClientOptions) {
  return {
    auth: {
      login: (body: LoginInput) =>
        request<User>(baseUrl, '/auth/login', { method: 'POST', body: JSON.stringify(body) }),
      register: (body: RegisterInput) =>
        request<User>(baseUrl, '/auth/register', { method: 'POST', body: JSON.stringify(body) }),
      logout: () => request<{ ok: true }>(baseUrl, '/auth/logout', { method: 'POST' }),
      me: () => request<User>(baseUrl, '/auth/me'),
      createUser: (body: CreateUserInput) =>
        request<User>(baseUrl, '/auth/users', { method: 'POST', body: JSON.stringify(body) }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
