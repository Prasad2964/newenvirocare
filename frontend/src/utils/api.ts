const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://newenvirocare-1.onrender.com';

console.log('[API] Backend URL:', BACKEND_URL);

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  async get(path: string) {
    const url = `${BACKEND_URL}${path}`;
    console.log('[API] GET', url);
    try {
      const res = await fetch(url, { headers: this.getHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        console.error('[API] GET error', res.status, err);
        throw new Error(err.detail || `Request failed (${res.status})`);
      }
      return res.json();
    } catch (e: any) {
      console.error('[API] GET failed', url, e.message);
      throw e;
    }
  }

  async post(path: string, body?: any) {
    const url = `${BACKEND_URL}${path}`;
    console.log('[API] POST', url, body ? JSON.stringify(body) : '');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        console.error('[API] POST error', res.status, err);
        throw new Error(err.detail || `Request failed (${res.status})`);
      }
      return res.json();
    } catch (e: any) {
      console.error('[API] POST failed', url, e.message);
      throw e;
    }
  }

  async delete(path: string) {
    const url = `${BACKEND_URL}${path}`;
    console.log('[API] DELETE', url);
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        console.error('[API] DELETE error', res.status, err);
        throw new Error(err.detail || `Request failed (${res.status})`);
      }
      return res.json();
    } catch (e: any) {
      console.error('[API] DELETE failed', url, e.message);
      throw e;
    }
  }
}

export const api = new ApiClient();
export default api;
