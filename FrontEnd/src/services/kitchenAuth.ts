import { addKitchenService } from "./addKitchenService";
import type { KitchenEmployee } from "../types/kitchen.type";

export const kitchenAuth = {
  login: async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const employees = addKitchenService.getEmployees();
        
        // Find the employee matching the email and password
        const employee = employees.find((e: KitchenEmployee) => e.email === email && e.password === password);

        if (employee) {
          if (!employee.isActive) {
            resolve({ success: false, message: "Account is inactive. Please contact admin." });
          } else {
            // Save their session in local storage under a unique kitchen key
            localStorage.setItem("kitchen_auth", JSON.stringify(employee));
            resolve({ success: true, message: "Login successful" });
          }
        } else {
          resolve({ success: false, message: "Invalid email or password" });
        }
      }, 800);
    });
  },

  logout: () => {
    localStorage.removeItem("kitchen_auth");
  }
};