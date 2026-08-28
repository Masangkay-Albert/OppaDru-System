import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/Authcontext"; 
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import { CartProvider } from "./contexts/CartContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import { OrderProvider } from "./contexts/OrderContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import ToastProvider from "./modules/customer-side/components/ToastProvider";

// ============ CUSTOMER PAGES ============
import LandingPage from "./modules/customer-side/pages/LandingPage";
import LoginPage from "./modules/customer-side/pages/Loginpage";  
import RegistrationPage from "./modules/customer-side/pages/RegistrationPage";
import MenuPage from "./modules/customer-side/pages/MenuPage";
import FavoritesPage from "./modules/customer-side/pages/FavoritesPage";
import CheckoutPage from "./modules/customer-side/pages/CheckoutPage";
import OrderTrackingPage from "./modules/customer-side/pages/OrderTrackingPage";
import MyOrdersPage from "./modules/customer-side/pages/MyOrdersPage";
import SettingsPage from "./modules/customer-side/pages/SettingsPage";


// ============ ADMIN PAGES ============
import AdminLoginPage from "./modules/admin-side/pages/AdminLoginPage";
import AdminDashboardPage from "./modules/admin-side/pages/AdminDashboardPage";
import AdminProductsPage from "./modules/admin-side/pages/AdminProductsPage";
import AdminAddProductPage from "./modules/admin-side/pages/AdminAddProductPage";
import AdminOrdersPage from "./modules/admin-side/pages/AdminOrdersPage";
import AdminCustomersPage from "./modules/admin-side/pages/AdminCustomersPage";
import AdminEmployeesPage from "./modules/admin-side/pages/AdminEmployeesPage";
import AdminAdminsPage from "./modules/admin-side/pages/AdminAdminsPage";
import AdminReportsPage from "./modules/admin-side/pages/AdminReportsPage";
import AdminDelivery from "./modules/admin-side/pages/AdminDelivery";
import ProtectedAdminRoute from "./modules/admin-side/components/ProtectedAdminRoute";
import AdminKitchenPage from "./modules/admin-side/pages/AdminKitchenPage";

// ============ DRIVER PAGES ============
import DriverLoginPage from "./modules/driver-side/pages/DriverLoginPage";
import DriverDashboardPage from "./modules/driver-side/pages/DriverDashboardPage";

/// ============= Kitchen Page
import KitchenLoginPage from "./modules/kitchen-side/kitchenLogin";
import KitchenDashboardPage from "./modules/kitchen-side/kitchenDashboard";
import PaymentConfirmPage from "./modules/customer-side/pages/PaymentConfirmPage";
import ProtectedRoute from "./modules/customer-side/components/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <FavoritesProvider>
          <OrderProvider>
            <SettingsProvider>
              <AdminAuthProvider>
                <BrowserRouter>
                  <ToastProvider>
                    <Routes>
                      {/* ===== PUBLIC ROUTES ===== */}
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegistrationPage />} />

                      {/* ===== CUSTOMER ROUTES ===== */}
                      <Route path="/customer" element={<ProtectedRoute><MenuPage /></ProtectedRoute>} />
                      <Route path="/customer/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
                      <Route path="/customer/orders" element={<ProtectedRoute><MyOrdersPage /></ProtectedRoute>} />
                      <Route path="/customer/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                      <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
                      <Route path="/tracking" element={<ProtectedRoute><OrderTrackingPage /></ProtectedRoute>} />
                      <Route path="/payment/confirm/:reference" element={<PaymentConfirmPage />} />

                      {/* ===== ADMIN ROUTES ===== */}
                      <Route path="/admin/login" element={<AdminLoginPage />} />
                      <Route path="/admin" element={<ProtectedAdminRoute><AdminDashboardPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/dashboard" element={<ProtectedAdminRoute><AdminDashboardPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/products" element={<ProtectedAdminRoute><AdminProductsPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/products/add" element={<ProtectedAdminRoute><AdminAddProductPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/orders" element={<ProtectedAdminRoute><AdminOrdersPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/delivery" element={<ProtectedAdminRoute><AdminDelivery /></ProtectedAdminRoute>} />
                      <Route path="/admin/customers" element={<ProtectedAdminRoute><AdminCustomersPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/employees" element={<ProtectedAdminRoute><AdminEmployeesPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/reports" element={<ProtectedAdminRoute><AdminReportsPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/admins" element={<ProtectedAdminRoute><AdminAdminsPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/kitchen" element={<ProtectedAdminRoute><AdminKitchenPage /></ProtectedAdminRoute>} />

                      {/* ===== DRIVER ROUTES ===== */}
                      <Route path="/delivery/login" element={<DriverLoginPage />} />
                      <Route path="/delivery/dashboard" element={<DriverDashboardPage/>}/>

                      {/* ===== Kitchen ROUTES ===== */}
                      <Route path="/kitchen/login" element={<KitchenLoginPage/>}/>
                      <Route path="/kitchen/dashboard" element={<KitchenDashboardPage/>}/>

                    </Routes>
                  </ToastProvider>
                </BrowserRouter>
              </AdminAuthProvider>
            </SettingsProvider>
          </OrderProvider>
        </FavoritesProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;