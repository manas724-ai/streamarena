export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : undefined;
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? res.statusText);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string, token?: string | null) => request<T>(path, { method: 'GET' }, token),
  post: <T>(path: string, data?: unknown, token?: string | null) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }, token),
  patch: <T>(path: string, data?: unknown, token?: string | null) =>
    request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }, token),
};

export { ApiError };
