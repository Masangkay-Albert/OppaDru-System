import { useEffect, useState } from "react";
import { PlusIcon, XIcon, PhoneIcon, MailIcon, ChefHat } from "lucide-react";
import { addKitchenService } from "../../../services/addKitchenService";
import type { KitchenEmployee } from "../../../types/kitchen.type";
import AdminLayout from '../components/AdminLayout';

export default function AdminKitchenPage() {
  const [employees, setEmployees] = useState<KitchenEmployee[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "" });

  useEffect(() => {
    setEmployees(addKitchenService.getEmployees());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addKitchenService.addEmployee(form);
    if (result.success) {
      setEmployees(addKitchenService.getEmployees()); 
      setForm({ name: "", email: "", password: "", phone: "", role: "" });
      setShowForm(false);
    }
  };

  const handleToggle = (id: string) => {
    addKitchenService.toggleEmployeeStatus(id);
    setEmployees(addKitchenService.getEmployees());
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-6 min-h-screen">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[var(--oppa-green)]">Kitchen Staff</h1>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-[var(--oppa-green)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--oppa-green-dark)] transition-colors flex items-center gap-2">
            <PlusIcon className="size-4" /> Add Kitchen Staff
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <div key={emp._id} className="bg-white rounded-2xl border border-[var(--oppa-border)] p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-[var(--oppa-green)] flex items-center justify-center text-white font-semibold">
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--oppa-green)] text-sm">{emp.name}</p>
                    <p className="text-xs text-[var(--oppa-text-muted)] capitalize flex items-center gap-1 mt-0.5">
                      <ChefHat className="w-3 h-3" /> {emp.role}
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 text-[10px] font-semibold rounded-full ${emp.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {emp.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="text-sm text-[var(--oppa-text-muted)] space-y-1">
                <p className="flex items-center gap-2"><MailIcon className="w-3.5 h-3.5" /> {emp.email}</p>
                <p className="flex items-center gap-2"><PhoneIcon className="w-3.5 h-3.5" /> {emp.phone}</p>
              </div>
              <button onClick={() => handleToggle(emp._id)} className="w-full py-2 text-xs font-medium rounded-lg bg-[var(--oppa-green)]/10 text-[var(--oppa-green)] hover:bg-[var(--oppa-green)]/20">
                {emp.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl border border-[var(--oppa-border)]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-[var(--oppa-green)]">Onboard Kitchen Staff</h2>
                <button type="button" onClick={() => setShowForm(false)} className="text-[var(--oppa-text-muted)] hover:text-gray-700">
                  <XIcon className="size-5" />
                </button>
              </div>
              <div className="space-y-4">
                <input type="text" placeholder="Full Name" required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full p-3 rounded-xl border border-[var(--oppa-border)] outline-none focus:ring-2 focus:ring-[var(--oppa-green)]" />
                <input type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full p-3 rounded-xl border border-[var(--oppa-border)] outline-none focus:ring-2 focus:ring-[var(--oppa-green)]" />
                <input type="password" placeholder="Password" required value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="w-full p-3 rounded-xl border border-[var(--oppa-border)] outline-none focus:ring-2 focus:ring-[var(--oppa-green)]" />
                
                <select required value={form.role} onChange={(e) => setForm({...form, role: e.target.value})} className="w-full p-3 rounded-xl border border-[var(--oppa-border)] outline-none focus:ring-2 focus:ring-[var(--oppa-green)] bg-white">
                  <option value="" disabled>Select Role</option>
                  <option value="head chef">Head Chef</option>
                  <option value="line cook">Line Cook</option>
                  <option value="prep cook">Prep Cook</option>
                  <option value="dishwasher">Dishwasher</option>
                </select>
                
                <input type="number" placeholder="Phone Number" required value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="w-full p-3 rounded-xl border border-[var(--oppa-border)] outline-none focus:ring-2 focus:ring-[var(--oppa-green)]" />
                
                <button type="submit" className="w-full py-3 bg-[var(--oppa-green)] text-white rounded-xl font-semibold hover:bg-[var(--oppa-green-dark)] transition-colors">
                  Add Kitchen Employee
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}