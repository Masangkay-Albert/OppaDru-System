import type { DeliveryPartner } from "../types/driver.type";

const STORAGE_KEY = "oppa_dru_drivers";

export const addDriver = {
  getDrivers: (): DeliveryPartner[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  
  addDriver: async (driverData: any): Promise<{ success: boolean; newDriver?: DeliveryPartner }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const drivers = addDriver.getDrivers();
        const newDriver: DeliveryPartner = {
          _id: Math.random().toString(36).substr(2, 9),
          ...driverData,
          isActive: true,
        };
        drivers.push(newDriver);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(drivers));
        resolve({ success: true, newDriver });
      }, 500);
    });
  },

  
  toggleDriverStatus: (id: string) => {
    const drivers = addDriver.getDrivers();
    const updated = drivers.map(d => d._id === id ? { ...d, isActive: !d.isActive } : d);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
};