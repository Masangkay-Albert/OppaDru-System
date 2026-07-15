import { addDriver } from "./addDriver";
import type { DeliveryPartner } from "../types/driver.type"; // Import the type

export const driverAuth = {
  login: async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const drivers = addDriver.getDrivers();
        
        
        const driver = drivers.find((d: DeliveryPartner) => d.email === email && d.password === password);

        if (driver) {
          if (!driver.isActive) {
            resolve({ success: false, message: "Account is inactive. Please contact admin." });
          } else {
            localStorage.setItem("driver_auth", JSON.stringify(driver));
            resolve({ success: true, message: "Login successful" });
          }
        } else {
          resolve({ success: false, message: "Invalid email or password" });
        }
      }, 800);
    });
  },

  logout: () => {
    localStorage.removeItem("driver_auth");
  }
};