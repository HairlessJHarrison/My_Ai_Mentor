const API_BASE = '/api/v1';

export async function api(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
        config.body = JSON.stringify(config.body);
    }

    if (config.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    const res = await fetch(url, config);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.detail || err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export const get = (endpoint) => api(endpoint);
export const post = (endpoint, body) => api(endpoint, { method: 'POST', body });
export const put = (endpoint, body) => api(endpoint, { method: 'PUT', body });
export const del = (endpoint) => api(endpoint, { method: 'DELETE' });
