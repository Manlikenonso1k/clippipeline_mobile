import { API_BASE_URL } from './config';
import { useAuthStore } from '@/store/authStore';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String(data.message)
        : `Request failed (${res.status})`;
    if (res.status === 401) await useAuthStore.getState().clear();
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}

function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * multipart/form-data request with upload progress (0..1). fetch() can't report
 * upload progress in React Native, so this uses XMLHttpRequest. The boundary /
 * Content-Type header is set by the runtime from the FormData body.
 */
export function apiUpload<T>(
  path: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
  method: 'POST' | 'PUT' = 'POST',
): Promise<T> {
  const token = useAuthStore.getState().token;
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_BASE_URL}${path}`);
    xhr.setRequestHeader('Accept', 'application/json');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(Math.min(1, e.loaded / e.total));
    };
    xhr.onload = () => {
      const data = parseBody(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve(data as T);
        return;
      }
      const message =
        typeof data === 'object' && data !== null && 'message' in data
          ? String((data as { message: unknown }).message)
          : `Request failed (${xhr.status})`;
      if (xhr.status === 401) void useAuthStore.getState().clear();
      reject(new ApiError(xhr.status, message, data));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Network error — check your connection and try again.'));
    xhr.ontimeout = () => reject(new ApiError(0, 'Upload timed out.'));
    xhr.send(form);
  });
}

/** First Laravel 422 field error, else the message. */
export function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { errors?: Record<string, string[]> } | null;
    const first = body?.errors ? Object.values(body.errors)[0]?.[0] : undefined;
    return first || err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong.';
}
