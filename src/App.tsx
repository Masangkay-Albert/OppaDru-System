// src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/Authcontext";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import { CartProvider } from "./contexts/CartContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import { OrderProvider } from "./contexts/OrderContext";
import ToastProvider from "./modules/customer-side/components/ToastProvider";
import LandingPage from "./modules/customer-side/pages/LandingPage";
import LoginPage from "./modules/customer-side/pages/Loginpage";
import RegistrationPage from "./modules/customer-side/pages/RegistrationPage";
import MenuPage from "./modules/customer-side/pages/MenuPage";
import FavoritesPage from "./modules/customer-side/pages/FavoritesPage";
import CheckoutPage from "./modules/customer-side/pages/CheckoutPage";
import OrderTrackingPage from "./modules/customer-side/pages/OrderTrackingPage";

// Admin-side pages
import AdminLoginPage from "./modules/admin-side/pages/AdminLoginPage";
import AdminDashboardPage from "./modules/admin-side/pages/AdminDashboardPage";
import AdminProductsPage from "./modules/admin-side/pages/AdminProductsPage";
import AdminAddProductPage from "./modules/admin-side/pages/AdminAddProductPage";
import AdminOrdersPage from "./modules/admin-side/pages/AdminOrdersPage";
import AdminCustomersPage from "./modules/admin-side/pages/AdminCustomersPage";
import AdminEmployeesPage from "./modules/admin-side/pages/AdminEmployeesPage";
import AdminReportsPage from "./modules/admin-side/pages/AdminReportsPage";
import ProtectedAdminRoute from "./modules/admin-side/components/ProtectedAdminRoute";

function App() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        <CartProvider>
          <FavoritesProvider>
            <OrderProvider>
              <BrowserRouter>
                <ToastProvider>
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegistrationPage />} />
                    <Route path="/customer" element={<MenuPage />} />
                    <Route path="/customer/favorites" element={<FavoritesPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/tracking" element={<OrderTrackingPage />} />

                    {/* Admin-side routes */}
                    <Route path="/admin/login" element={<AdminLoginPage />} />
                    <Route
                      path="/admin/dashboard"
                      element={
                        <ProtectedAdminRoute>
                          <AdminDashboardPage />
                        </ProtectedAdminRoute>
                      }
                    />
                    <Route
                      path="/admin/products"
                      element={
                        <ProtectedAdminRoute>
                          <AdminProductsPage />
                        </ProtectedAdminRoute>
                      }
                    />
                    <Route
                      path="/admin/products/add"
                      element={
                        <ProtectedAdminRoute>
                          <AdminAddProductPage />
                        </ProtectedAdminRoute>
                      }
                    />
                    <Route
                      path="/admin/orders"
                      element={
                        <ProtectedAdminRoute>
                          <AdminOrdersPage />
                        </ProtectedAdminRoute>
                      }
                    />
                    <Route
                      path="/admin/customers"
                      element={
                        <ProtectedAdminRoute>
                          <AdminCustomersPage />
                        </ProtectedAdminRoute>
                      }
                    />
                    <Route
                      path="/admin/employees"
                      element={
                        <ProtectedAdminRoute>
                          <AdminEmployeesPage />
                        </ProtectedAdminRoute>
                      }
                    />
                    <Route
                      path="/admin/reports"
                      element={
                        <ProtectedAdminRoute>
                          <AdminReportsPage />
                        </ProtectedAdminRoute>
                      }
                    />
                  </Routes>
                </ToastProvider>
              </BrowserRouter>
            </OrderProvider>
          </FavoritesProvider>
        </CartProvider>
      </AdminAuthProvider>
    </AuthProvider>
  );
}

export default App;