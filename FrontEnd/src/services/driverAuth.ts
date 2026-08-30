// Replace this with your actual local Laravel URL if different
const API_BASE_URL = "http://localhost:8000/api";

export const driverAuth = {
  login: async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/driver/login`, {
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
      localStorage.setItem("driver_auth", JSON.stringify(data.driver));
      localStorage.setItem("driver_token", data.token);

      return { success: true, message: "Login successful" };
    } catch (error: any) {
      return { success: false, message: "Server connection failed. Is Laravel running?" };
    }
  },

  logout: async () => {
    const token = localStorage.getItem("driver_token");
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/driver/logout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/json",
          },
        });
      } catch (error) {
        console.error("Logout request failed", error);
      }
    }
    
    // Clear local storage regardless of API success
    localStorage.removeItem("driver_auth");
    localStorage.removeItem("driver_token");
  }
};