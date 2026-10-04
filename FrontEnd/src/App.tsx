import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/Authcontext"; 
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import { FranchiseAuthProvider } from "./contexts/FranchiseAuthContext";
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
import ProtectedAdminRoute from "./modules/admin-side/components/ProtectedAdminRoute";

const AdminLoginPage = lazy(() => import("./modules/admin-side/pages/AdminLoginPage"));
const AdminDashboardPage = lazy(() => import("./modules/admin-side/pages/AdminDashboardPage"));
const AdminProductsPage = lazy(() => import("./modules/admin-side/pages/AdminProductsPage"));
const AdminAddonsPage = lazy(() => import("./modules/admin-side/pages/AdminAddonsPage"));
const AdminAddProductPage = lazy(() => import("./modules/admin-side/pages/AdminAddProductPage"));
const AdminOrdersPage = lazy(() => import("./modules/admin-side/pages/AdminOrdersPage"));
const AdminDiscountApprovalsPage = lazy(() => import("./modules/admin-side/pages/AdminDiscountApprovalsPage"));
const AdminCustomersPage = lazy(() => import("./modules/admin-side/pages/AdminCustomersPage"));
const AdminEmployeesPage = lazy(() => import("./modules/admin-side/pages/AdminEmployeesPage"));
const AdminAdminsPage = lazy(() => import("./modules/admin-side/pages/AdminAdminsPage"));
const AdminReportsPage = lazy(() => import("./modules/admin-side/pages/AdminReportsPage"));
const AdminDelivery = lazy(() => import("./modules/admin-side/pages/AdminDelivery"));
const AdminKitchenPage = lazy(() => import("./modules/admin-side/pages/AdminKitchenPage"));
const AdminPricingSettingsPage = lazy(() => import("./modules/admin-side/pages/AdminPricingSettingsPage"));
const AdminFranchisesPage = lazy(() => import("./modules/admin-side/pages/AdminFranchisesPage"));
const AdminFranchiseDetailPage = lazy(() => import("./modules/admin-side/pages/AdminFranchiseDetailPage"));
const AdminFranchiseApplicationsPage = lazy(() => import("./modules/admin-side/pages/AdminFranchiseApplicationsPage"));

// ============ FRANCHISE PAGES ============
const FranchiseLoginPage = lazy(() => import("./modules/franchise-side/pages/FranchiseLoginPage"));
const FranchiseDashboardPage = lazy(() => import("./modules/franchise-side/pages/FranchiseDashboardPage"));
const FranchisePOSPage = lazy(() => import("./modules/franchise-side/pages/FranchisePOSPage"));
const FranchiseOrdersPage = lazy(() => import("./modules/franchise-side/pages/FranchiseOrdersPage"));
const FranchiseInventoryPage = lazy(() => import("./modules/franchise-side/pages/FranchiseInventoryPage"));
const FranchiseReportsPage = lazy(() => import("./modules/franchise-side/pages/FranchiseReportsPage"));
const FranchiseUsersPage = lazy(() => import("./modules/franchise-side/pages/FranchiseUsersPage"));
const FranchiseSettingsPage = lazy(() => import("./modules/franchise-side/pages/FranchiseSettingsPage"));
const FranchiseApplicationPage = lazy(() => import("./modules/franchise-side/pages/FranchiseApplicationPage"));
import ProtectedFranchiseRoute from "./modules/franchise-side/components/ProtectedFranchiseRoute";

// ============ DRIVER PAGES ============
import DriverLoginPage from "./modules/driver-side/pages/DriverLoginPage";
import DriverDashboardPage from "./modules/driver-side/pages/DriverDashboardPage";

/// ============= Kitchen Page
import EmployeeLoginPage from "./modules/employee-side/employeeLogin";
import KitchenDashboardPage from "./modules/kitchen-side/kitchenDashboard";
import PaymentConfirmPage from "./modules/customer-side/pages/PaymentConfirmPage";
import ProtectedRoute from "./modules/customer-side/components/ProtectedRoute";

// ============ EMPLOYEE / POS PAGES ============
import ProtectedEmployeeRoute from "./modules/employee-side/components/ProtectedEmployeeRoute";
import EmployeeMenuPage from "./modules/employee-side/pages/EmployeeMenuPage";
import EmployeeCheckoutPage from "./modules/employee-side/pages/EmployeeCheckoutPage";
import EmployeeOrdersPage from "./modules/employee-side/pages/EmployeeOrdersPage";
import EmployeeFavoritesPage from "./modules/employee-side/pages/EmployeeFavoritesPage";
import EmployeeSettingsPage from "./modules/employee-side/pages/EmployeeSettingsPage";

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <FavoritesProvider>
          <OrderProvider>
            <SettingsProvider>
              <AdminAuthProvider>
                <FranchiseAuthProvider>
                  <BrowserRouter>
                    <ToastProvider>
                    <Suspense fallback={<div className="min-h-screen bg-[var(--oppa-cream)] p-8 text-center text-sm text-[var(--oppa-text-muted)]">Loading page...</div>}>
                    <Routes>
                      {/* ===== PUBLIC ROUTES ===== */}
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegistrationPage />} />
                      <Route path="/franchise/apply" element={<FranchiseApplicationPage />} />
                      <Route path="/franchise/login" element={<FranchiseLoginPage />} />

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
                      <Route path="/admin/addons" element={<ProtectedAdminRoute><AdminAddonsPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/products/add" element={<ProtectedAdminRoute><AdminAddProductPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/orders" element={<ProtectedAdminRoute><AdminOrdersPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/discount-approvals" element={<ProtectedAdminRoute><AdminDiscountApprovalsPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/delivery" element={<ProtectedAdminRoute><AdminDelivery /></ProtectedAdminRoute>} />
                      <Route path="/admin/customers" element={<ProtectedAdminRoute><AdminCustomersPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/employees" element={<ProtectedAdminRoute><AdminEmployeesPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/reports" element={<ProtectedAdminRoute><AdminReportsPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/admins" element={<ProtectedAdminRoute><AdminAdminsPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/franchises" element={<ProtectedAdminRoute><AdminFranchisesPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/franchises/:id" element={<ProtectedAdminRoute><AdminFranchiseDetailPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/franchise-applications" element={<ProtectedAdminRoute><AdminFranchiseApplicationsPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/kitchen" element={<ProtectedAdminRoute><AdminKitchenPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/settings/pricing" element={<ProtectedAdminRoute><AdminPricingSettingsPage /></ProtectedAdminRoute>} />

                      {/* ===== FRANCHISE ROUTES ===== */}
                      <Route path="/franchise" element={<ProtectedFranchiseRoute><FranchiseDashboardPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/dashboard" element={<ProtectedFranchiseRoute><FranchiseDashboardPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/pos" element={<ProtectedFranchiseRoute><FranchisePOSPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/orders" element={<ProtectedFranchiseRoute><FranchiseOrdersPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/inventory" element={<ProtectedFranchiseRoute><FranchiseInventoryPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/reports" element={<ProtectedFranchiseRoute><FranchiseReportsPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/users" element={<ProtectedFranchiseRoute><FranchiseUsersPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/settings" element={<ProtectedFranchiseRoute><FranchiseSettingsPage /></ProtectedFranchiseRoute>} />

                      {/* ===== DRIVER ROUTES ===== */}
                      <Route path="/delivery/login" element={<DriverLoginPage />} />
                      <Route path="/delivery/dashboard" element={<DriverDashboardPage/>}/>

                      {/* ===== Employee ROUTES ===== */}
                      <Route path="/employee/login" element={<EmployeeLoginPage />} />
                      <Route path="/staff/login" element={<EmployeeLoginPage />} />
                      <Route path="/cashier/login" element={<EmployeeLoginPage />} />
                      <Route path="/kitchen/login" element={<EmployeeLoginPage portal="kitchen" />} />
                      <Route path="/employee" element={<ProtectedEmployeeRoute><EmployeeMenuPage /></ProtectedEmployeeRoute>} />
                      <Route path="/employee/checkout" element={<ProtectedEmployeeRoute><EmployeeCheckoutPage /></ProtectedEmployeeRoute>} />
                      <Route path="/employee/pos" element={<ProtectedEmployeeRoute><EmployeeCheckoutPage /></ProtectedEmployeeRoute>} />
                      <Route path="/employee/orders" element={<ProtectedEmployeeRoute><EmployeeOrdersPage /></ProtectedEmployeeRoute>} />
                      <Route path="/employee/favorites" element={<ProtectedEmployeeRoute><EmployeeFavoritesPage /></ProtectedEmployeeRoute>} />
                      <Route path="/employee/settings" element={<ProtectedEmployeeRoute><EmployeeSettingsPage /></ProtectedEmployeeRoute>} />

                      {/* Cashier routes matching employeeLogin.tsx redirect */}
                      <Route path="/cashier" element={<ProtectedEmployeeRoute><EmployeeMenuPage /></ProtectedEmployeeRoute>} />
                      <Route path="/cashier/checkout" element={<ProtectedEmployeeRoute><EmployeeCheckoutPage /></ProtectedEmployeeRoute>} />
                      <Route path="/cashier/orders" element={<ProtectedEmployeeRoute><EmployeeOrdersPage /></ProtectedEmployeeRoute>} />
                      <Route path="/cashier/favorites" element={<ProtectedEmployeeRoute><EmployeeFavoritesPage /></ProtectedEmployeeRoute>} />
                      <Route path="/cashier/settings" element={<ProtectedEmployeeRoute><EmployeeSettingsPage /></ProtectedEmployeeRoute>} />

                      <Route path="/kitchen/dashboard" element={<KitchenDashboardPage />} />

                    </Routes>
                    </Suspense>
                    </ToastProvider>
                  </BrowserRouter>
                </FranchiseAuthProvider>
              </AdminAuthProvider>
            </SettingsProvider>
          </OrderProvider>
        </FavoritesProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;