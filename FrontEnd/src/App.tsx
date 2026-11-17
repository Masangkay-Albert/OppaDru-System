import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/Authcontext"; 
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import { FranchiseAuthProvider } from "./contexts/FranchiseAuthContext";
import { FranchiseApplicantAuthProvider } from "./contexts/FranchiseApplicantAuthContext";
import { CartProvider } from "./contexts/CartContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import { OrderProvider } from "./contexts/OrderContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { StoreHoursProvider } from "./contexts/StoreHoursContext";
import ToastProvider from "./modules/customer-side/components/ToastProvider";
import StoreHoursGate from "./modules/customer-side/components/StoreHoursGate";
import "./styles/thermal-receipt.css";

// ============ ADMIN PAGES ============
import ProtectedAdminRoute from "./modules/admin-side/components/ProtectedAdminRoute";

// ============ CUSTOMER PAGES ============
const LandingPage = lazy(() => import("./modules/customer-side/pages/LandingPage"));
const LoginPage = lazy(() => import("./modules/customer-side/pages/Loginpage"));
const RegistrationPage = lazy(() => import("./modules/customer-side/pages/RegistrationPage"));
const ForgotPasswordPage = lazy(() => import("./modules/customer-side/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./modules/customer-side/pages/ResetPasswordPage"));
const MenuPage = lazy(() => import("./modules/customer-side/pages/MenuPage"));
const FavoritesPage = lazy(() => import("./modules/customer-side/pages/FavoritesPage"));
const CheckoutPage = lazy(() => import("./modules/customer-side/pages/CheckoutPage"));
const OrderTrackingPage = lazy(() => import("./modules/customer-side/pages/OrderTrackingPage"));
const MyOrdersPage = lazy(() => import("./modules/customer-side/pages/MyOrdersPage"));
const SettingsPage = lazy(() => import("./modules/customer-side/pages/SettingsPage"));
const PaymentConfirmPage = lazy(() => import("./modules/customer-side/pages/PaymentConfirmPage"));

const AdminLoginPage = lazy(() => import("./modules/admin-side/pages/AdminLoginPage"));
const AdminDashboardPage = lazy(() => import("./modules/admin-side/pages/AdminDashboardPage"));
const AdminProductsPage = lazy(() => import("./modules/admin-side/pages/AdminProductsPage"));
const AdminAddonsPage = lazy(() => import("./modules/admin-side/pages/AdminAddonsPage"));
const AdminAddProductPage = lazy(() => import("./modules/admin-side/pages/AdminAddProductPage"));
const AdminOrdersPage = lazy(() => import("./modules/admin-side/pages/AdminOrdersPage"));
const AdminPromosPage = lazy(() => import("./modules/admin-side/pages/AdminPromosPage"));
const AdminDiscountApprovalsPage = lazy(() => import("./modules/admin-side/pages/AdminDiscountApprovalsPage"));
const AdminAnnouncementsPage = lazy(() => import("./modules/admin-side/pages/AdminAnnouncementsPage"));
const AdminCustomersPage = lazy(() => import("./modules/admin-side/pages/AdminCustomersPage"));
const AdminEmployeesPage = lazy(() => import("./modules/admin-side/pages/AdminEmployeesPage"));
const AdminAdminsPage = lazy(() => import("./modules/admin-side/pages/AdminAdminsPage"));
const AdminReportsPage = lazy(() => import("./modules/admin-side/pages/AdminReportsPage"));
const AdminDelivery = lazy(() => import("./modules/admin-side/pages/AdminDelivery"));
const AdminKitchenPage = lazy(() => import("./modules/admin-side/pages/AdminKitchenPage"));
const AdminPricingSettingsPage = lazy(() => import("./modules/admin-side/pages/AdminPricingSettingsPage"));
const AdminFranchisesPage = lazy(() => import("./modules/admin-side/pages/AdminFranchisesPage"));
const AdminFranchiseDetailPage = lazy(() => import("./modules/admin-side/pages/AdminFranchiseDetailPage"));
const AdminFranchiseAccountDetailPage = lazy(() => import("./modules/admin-side/pages/AdminFranchiseAccountDetailPage"));
const AdminFranchiseApplicationsPage = lazy(() => import("./modules/admin-side/pages/AdminFranchiseApplicationsPage"));
const AdminFranchiseApplicationDetailPage = lazy(() => import("./modules/admin-side/pages/AdminFranchiseApplicationDetailPage"));
const AdminInventoryPage = lazy(() => import("./modules/admin-side/pages/AdminInventoryPage"));
const AdminInventoryHistoryPage = lazy(() => import("./modules/admin-side/pages/AdminInventoryHistoryPage"));

// ============ FRANCHISE PAGES ============
const FranchiseLoginPage = lazy(() => import("./modules/franchise-side/pages/FranchiseLoginPage"));
const FranchiseDashboardPage = lazy(() => import("./modules/franchise-side/pages/FranchiseDashboardPage"));
const FranchisePOSPage = lazy(() => import("./modules/franchise-side/pages/FranchisePOSPage"));
const FranchisePosActivityPage = lazy(() => import("./modules/franchise-side/pages/FranchisePosActivityPage"));
const FranchiseOrdersPage = lazy(() => import("./modules/franchise-side/pages/FranchiseOrdersPage"));
const FranchiseIngredientInventoryPage = lazy(() => import("./modules/franchise-side/pages/FranchiseIngredientInventoryPage"));
const FranchiseIngredientInventoryHistoryPage = lazy(() => import("./modules/franchise-side/pages/FranchiseIngredientInventoryHistoryPage"));
const FranchiseReportsPage = lazy(() => import("./modules/franchise-side/pages/FranchiseReportsPage"));
const FranchiseUsersPage = lazy(() => import("./modules/franchise-side/pages/FranchiseUsersPage"));
const FranchiseSettingsPage = lazy(() => import("./modules/franchise-side/pages/FranchiseSettingsPage"));
const FranchiseManagementPage = lazy(() => import("./modules/franchise-side/pages/FranchiseManagementPage"));
const FranchiseApplicationPage = lazy(() => import("./modules/franchise-side/pages/FranchiseApplicationPage"));
const FranchiseOpportunitiesPage = lazy(() => import("./modules/franchise-side/pages/FranchiseOpportunitiesPage"));
const FranchiseMyApplicationsPage = lazy(() => import("./modules/franchise-side/pages/FranchiseMyApplicationsPage"));
const FranchiseApplicantLoginPage = lazy(() => import("./modules/franchise-side/pages/FranchiseApplicantLoginPage"));
const FranchiseApplicantRegisterPage = lazy(() => import("./modules/franchise-side/pages/FranchiseApplicantRegisterPage"));
const AnnouncementsPage = lazy(() => import("./modules/franchise-side/pages/FranchisePortalPages").then((module) => ({ default: module.AnnouncementsPage })));
const DiscountRequestsPage = lazy(() => import("./modules/franchise-side/pages/FranchisePortalPages").then((module) => ({ default: module.DiscountRequestsPage })));
const FeesPaymentsPage = lazy(() => import("./modules/franchise-side/pages/FranchisePortalPages").then((module) => ({ default: module.FeesPaymentsPage })));
const FranchiseDeliveryPage = lazy(() => import("./modules/franchise-side/pages/FranchisePortalPages").then((module) => ({ default: module.FranchiseDeliveryPage })));
const MenuAvailabilityPage = lazy(() => import("./modules/franchise-side/pages/FranchisePortalPages").then((module) => ({ default: module.MenuAvailabilityPage })));
const SupportResourcesPage = lazy(() => import("./modules/franchise-side/pages/FranchisePortalPages").then((module) => ({ default: module.SupportResourcesPage })));
import ProtectedFranchiseApplicantRoute from "./modules/franchise-side/components/ProtectedFranchiseApplicantRoute";
const CashierTransactionsPage = lazy(() => import("./modules/employee-side/pages/CashierTransactionsPage"));
import ProtectedFranchiseRoute from "./modules/franchise-side/components/ProtectedFranchiseRoute";

// ============ DRIVER PAGES ============
const DriverLoginPage = lazy(() => import("./modules/driver-side/pages/DriverLoginPage"));
const DriverDashboardPage = lazy(() => import("./modules/driver-side/pages/DriverDashboardPage"));

/// ============= Kitchen Page
const EmployeeLoginPage = lazy(() => import("./modules/employee-side/employeeLogin"));
const KitchenDashboardPage = lazy(() => import("./modules/kitchen-side/kitchenDashboard"));
import ProtectedRoute from "./modules/customer-side/components/ProtectedRoute";

// ============ EMPLOYEE / POS PAGES ============
import ProtectedEmployeeRoute from "./modules/employee-side/components/ProtectedEmployeeRoute";
import CashierLayout from "./modules/employee-side/components/CashierLayout";
const EmployeeMenuPage = lazy(() => import("./modules/employee-side/pages/EmployeeMenuPage"));
const EmployeeCheckoutPage = lazy(() => import("./modules/employee-side/pages/EmployeeCheckoutPage"));
const EmployeeOrdersPage = lazy(() => import("./modules/employee-side/pages/EmployeeOrdersPage"));
const EmployeeSettingsPage = lazy(() => import("./modules/employee-side/pages/EmployeeSettingsPage"));
const MostPopularMealsPage = lazy(() => import("./modules/employee-side/pages/MostPopularMealsPage"));
const EmployeeTopProductsPage = lazy(() => import("./modules/employee-side/pages/EmployeeTopProductsPage"));

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <FavoritesProvider>
          <OrderProvider>
            <SettingsProvider>
              <AdminAuthProvider>
                <FranchiseAuthProvider>
                  <FranchiseApplicantAuthProvider>
                  <BrowserRouter>
                    <ToastProvider>
                    <StoreHoursProvider>
                    <Suspense fallback={<div role="status" aria-live="polite" aria-busy="true" className="min-h-screen bg-[var(--oppa-cream)]">
                      <span className="sr-only">Loading page</span>
                    </div>}>
                    <Routes>
                      {/* ===== PUBLIC ROUTES ===== */}
                      <Route path="/franchise-opportunities" element={<FranchiseOpportunitiesPage />} />
                      <Route path="/franchise/applicant-access" element={<Navigate to="/franchise/applicant-login?returnTo=%2Ffranchise%2Fapply" replace />} />
                      <Route path="/franchise/applicant-login" element={<FranchiseApplicantLoginPage />} />
                      <Route path="/franchise/applicant-register" element={<FranchiseApplicantRegisterPage />} />
                      <Route path="/franchise/apply" element={<ProtectedFranchiseApplicantRoute><FranchiseApplicationPage /></ProtectedFranchiseApplicantRoute>} />
                      <Route path="/franchise/my-applications" element={<ProtectedFranchiseApplicantRoute><FranchiseMyApplicationsPage /></ProtectedFranchiseApplicantRoute>} />
                      <Route path="/franchise/track-application" element={<Navigate to="/franchise-opportunities" replace />} />
                      <Route path="/franchise/login" element={<FranchiseLoginPage />} />

                      {/* ===== CUSTOMER ROUTES ===== */}
                      <Route element={<StoreHoursGate />}>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegistrationPage />} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />
                        <Route path="/customer" element={<ProtectedRoute><MenuPage /></ProtectedRoute>} />
                        <Route path="/customer/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
                        <Route path="/customer/orders" element={<ProtectedRoute><MyOrdersPage /></ProtectedRoute>} />
                        <Route path="/customer/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                        <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
                        <Route path="/tracking" element={<ProtectedRoute><OrderTrackingPage /></ProtectedRoute>} />
                        <Route path="/orders/:id/track" element={<ProtectedRoute><OrderTrackingPage /></ProtectedRoute>} />
                        <Route path="/payment/confirm/:reference" element={<PaymentConfirmPage />} />
                      </Route>

                      {/* ===== ADMIN ROUTES ===== */}
                      <Route path="/admin/login" element={<AdminLoginPage />} />
                      <Route path="/admin" element={<ProtectedAdminRoute><AdminDashboardPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/dashboard" element={<ProtectedAdminRoute><AdminDashboardPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/products" element={<ProtectedAdminRoute><AdminProductsPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/addons" element={<ProtectedAdminRoute><AdminAddonsPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/products/add" element={<ProtectedAdminRoute><AdminAddProductPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/orders" element={<ProtectedAdminRoute><AdminOrdersPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/promos" element={<ProtectedAdminRoute><AdminPromosPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/discount-approvals" element={<ProtectedAdminRoute><AdminDiscountApprovalsPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/announcements" element={<ProtectedAdminRoute><AdminAnnouncementsPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/delivery" element={<ProtectedAdminRoute><AdminDelivery /></ProtectedAdminRoute>} />
                      <Route path="/admin/customers" element={<ProtectedAdminRoute><AdminCustomersPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/employees" element={<ProtectedAdminRoute><AdminEmployeesPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/reports" element={<ProtectedAdminRoute><AdminReportsPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/inventory" element={<ProtectedAdminRoute><AdminInventoryPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/inventory/history" element={<ProtectedAdminRoute><AdminInventoryHistoryPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/admins" element={<ProtectedAdminRoute systemAdministratorOnly><AdminAdminsPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/franchises" element={<ProtectedAdminRoute><AdminFranchisesPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/franchise-accounts/:id" element={<ProtectedAdminRoute><AdminFranchiseAccountDetailPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/franchises/:id" element={<ProtectedAdminRoute><AdminFranchiseDetailPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/franchise-applications" element={<ProtectedAdminRoute><AdminFranchiseApplicationsPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/franchise-applications/:id" element={<ProtectedAdminRoute><AdminFranchiseApplicationDetailPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/kitchen" element={<ProtectedAdminRoute><AdminKitchenPage /></ProtectedAdminRoute>} />
                      <Route path="/admin/settings/pricing" element={<ProtectedAdminRoute><AdminPricingSettingsPage /></ProtectedAdminRoute>} />

                      {/* ===== FRANCHISE ROUTES ===== */}
                      <Route path="/franchise" element={<ProtectedFranchiseRoute><FranchiseDashboardPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/dashboard" element={<ProtectedFranchiseRoute><FranchiseDashboardPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/management" element={<Navigate to="/franchise/profile" replace />} />
                      <Route path="/franchise/profile" element={<ProtectedFranchiseRoute allowedRoles={['owner']}><FranchiseManagementPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/pos" element={<ProtectedFranchiseRoute requirePos><FranchisePOSPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/pos/activity" element={<ProtectedFranchiseRoute><FranchisePosActivityPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/orders" element={<ProtectedFranchiseRoute><FranchiseOrdersPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/inventory" element={<Navigate to="/franchise/inventory/ingredients" replace />} />
                      <Route path="/franchise/inventory/ingredients" element={<ProtectedFranchiseRoute><FranchiseIngredientInventoryPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/inventory/ingredients/history" element={<ProtectedFranchiseRoute><FranchiseIngredientInventoryHistoryPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/reports" element={<ProtectedFranchiseRoute><FranchiseReportsPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/users" element={<ProtectedFranchiseRoute><FranchiseUsersPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/settings" element={<ProtectedFranchiseRoute><FranchiseSettingsPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/menu-availability" element={<ProtectedFranchiseRoute allowedRoles={['owner', 'manager']}><MenuAvailabilityPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/discount-requests" element={<ProtectedFranchiseRoute allowedRoles={['owner', 'manager']}><DiscountRequestsPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/fees-payments" element={<ProtectedFranchiseRoute allowedRoles={['owner']}><FeesPaymentsPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/announcements" element={<ProtectedFranchiseRoute><AnnouncementsPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/support" element={<ProtectedFranchiseRoute><SupportResourcesPage /></ProtectedFranchiseRoute>} />
                      <Route path="/franchise/delivery" element={<ProtectedFranchiseRoute allowedRoles={['owner', 'manager']}><FranchiseDeliveryPage /></ProtectedFranchiseRoute>} />

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
                      <Route path="/employee/favorites" element={<Navigate to="/employee" replace />} />
                      <Route path="/employee/popular" element={<ProtectedEmployeeRoute><MostPopularMealsPage /></ProtectedEmployeeRoute>} />
                      <Route path="/employee/settings" element={<ProtectedEmployeeRoute><EmployeeSettingsPage /></ProtectedEmployeeRoute>} />

                      {/* Cashier routes matching employeeLogin.tsx redirect */}
                      <Route path="/cashier" element={<ProtectedEmployeeRoute><EmployeeMenuPage /></ProtectedEmployeeRoute>} />
                      <Route path="/cashier/popular" element={<ProtectedEmployeeRoute portal="branch-cashier"><CashierLayout><MostPopularMealsPage /></CashierLayout></ProtectedEmployeeRoute>} />
                      <Route path="/cashier/pos" element={<ProtectedEmployeeRoute portal="branch-cashier"><CashierLayout><FranchisePOSPage /></CashierLayout></ProtectedEmployeeRoute>} />
                      <Route path="/cashier/top-products" element={<ProtectedEmployeeRoute portal="branch-cashier"><CashierLayout><EmployeeTopProductsPage /></CashierLayout></ProtectedEmployeeRoute>} />
                      <Route path="/employee/pos/top-products" element={<ProtectedEmployeeRoute portal="branch-cashier"><CashierLayout><EmployeeTopProductsPage /></CashierLayout></ProtectedEmployeeRoute>} />
                      <Route path="/cashier/branch-orders" element={<ProtectedEmployeeRoute portal="branch-cashier"><CashierLayout><CashierTransactionsPage /></CashierLayout></ProtectedEmployeeRoute>} />
                      <Route path="/cashier/checkout" element={<ProtectedEmployeeRoute><EmployeeCheckoutPage /></ProtectedEmployeeRoute>} />
                      <Route path="/cashier/orders" element={<ProtectedEmployeeRoute><EmployeeOrdersPage /></ProtectedEmployeeRoute>} />
                      <Route path="/cashier/favorites" element={<Navigate to="/cashier/pos?filter=favorites" replace />} />
                      <Route path="/cashier/settings" element={<ProtectedEmployeeRoute><EmployeeSettingsPage /></ProtectedEmployeeRoute>} />

                      <Route path="/kitchen/dashboard" element={<ProtectedEmployeeRoute portal="kitchen"><KitchenDashboardPage /></ProtectedEmployeeRoute>} />

                    </Routes>
                    </Suspense>
                    </StoreHoursProvider>
                    </ToastProvider>
                  </BrowserRouter>
                  </FranchiseApplicantAuthProvider>
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
