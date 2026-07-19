
import type { KitchenEmployee } from "../types/kitchen.type";

const STORAGE_KEY = "oppa_dru_kitchen_staff";

export const addKitchenService = {
  getEmployees: (): KitchenEmployee[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  addEmployee: async (employeeData: any): Promise<{ success: boolean; newEmployee?: KitchenEmployee }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const employees = addKitchenService.getEmployees();
        const newEmployee: KitchenEmployee = {
          _id: Math.random().toString(36).substr(2, 9),
          ...employeeData,
          isActive: true,
        };
        employees.push(newEmployee);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
        resolve({ success: true, newEmployee });
      }, 500);
    });
  },

  toggleEmployeeStatus: (id: string) => {
    const employees = addKitchenService.getEmployees();
    const updated = employees.map(e => e._id === id ? { ...e, isActive: !e.isActive } : e);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
};
export default addKitchenService;