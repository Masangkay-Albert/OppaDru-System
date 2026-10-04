import { API_URL } from './apiConfig';

export const fetchWithEmployeeAuth = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const token = localStorage.getItem('employee_token');
  const headers = new Headers(init.headers || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...init, headers });
  if (response.status === 401) {
    localStorage.removeItem('employee_auth');
    localStorage.removeItem('employee_token');
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

      // Save to local storage
      localStorage.setItem("employee_auth", JSON.stringify(data.employee));
      localStorage.setItem("employee_token", data.token);

      return { success: true, position: data.position, message: "Login successful" };
    } catch {
      return { success: false, message: "Server connection failed." };
    }
  },

  logout: () => {
    localStorage.removeItem("employee_auth");
    localStorage.removeItem("employee_token");
  }
};