import { API_URL } from './apiConfig';

export const fetchWithEmployeeAuth = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const token = sessionStorage.getItem('employee_token');
  const redirectToLogin = () => {
    sessionStorage.removeItem('employee_auth');
    sessionStorage.removeItem('employee_token');
    const loginPath = window.location.pathname.startsWith('/kitchen')
      ? '/kitchen/login'
      : window.location.pathname.startsWith('/cashier')
        ? '/cashier/login'
        : '/employee/login';
    if (window.location.pathname !== loginPath) window.location.assign(loginPath);
  };
  if (!token) {
    redirectToLogin();
    return new Response(JSON.stringify({ message: 'Your session expired. Please sign in again.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const headers = new Headers(init.headers || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...init, headers });
  if (response.status === 401) {
    redirectToLogin();
  }
  return response;
};

const API_BASE_URL = API_URL;

export const employeeAuth = {
  login: async (email: string, password: string): Promise<{ success: boolean; position?: string; message?: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/employee/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.message || "Invalid credentials." };
      }

      // Keep employee credentials scoped to this browser tab.
      sessionStorage.setItem("employee_auth", JSON.stringify(data.employee));
      sessionStorage.setItem("employee_token", data.token);

      return { success: true, position: data.position, message: "Login successful" };
    } catch {
      return { success: false, message: "Server connection failed." };
    }
  },

  logout: () => {
    const token = sessionStorage.getItem('employee_token');
    sessionStorage.removeItem("employee_auth");
    sessionStorage.removeItem("employee_token");
    if (token) {
      void fetch(`${API_BASE_URL}/employee/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }).catch((error: unknown) => {
        console.error('Employee logout request failed', error);
      });
    }
  }
};