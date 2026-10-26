export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T = Record<string, unknown>>(
  path: string,
  options?: RequestInit
): Promise<T> {
  if (!path.startsWith('/api')) {
    throw new Error('مسیرهای API کلاینت باید نسبی و با پیشوند /api باشند.');
  }

  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const resp = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!resp.ok) {
      throw new ApiClientError(
        resp.status,
        'HTTP_ERROR',
        `خطای ارتباط با سرور (کد ${resp.status})`
      );
    }
    return undefined as T;
  }

  const data = (await resp.json()) as {
    ok?: boolean;
    error?: { code?: string; message?: string; details?: unknown };
  } & T;

  if (!resp.ok || data.ok === false) {
    throw new ApiClientError(
      resp.status,
      data.error?.code || 'API_ERROR',
      data.error?.message || 'خطایی در پردازش درخواست رخ داد.',
      data.error?.details
    );
  }

  return data;
}
