import { API_URL } from './apiConfig';

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
    } catch (error: any) {
      return { success: false, message: "Server connection failed." };
    }
  },

  logout: () => {
    localStorage.removeItem("employee_auth");
    localStorage.removeItem("employee_token");
  }
};