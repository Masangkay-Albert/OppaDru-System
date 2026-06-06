// App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/Authcontext";
import { CartProvider } from "./contexts/CartContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import LandingPage from "./modules/customer-side/pages/LandingPage";
import LoginPage from "./modules/customer-side/pages/Loginpage";
import RegistrationPage from "./modules/customer-side/pages/RegistrationPage";
import MenuPage from "./modules/customer-side/pages/MenuPage";
import FavoritesPage from "./modules/customer-side/pages/FavoritesPage";
import CheckoutPage from "./modules/customer-side/pages/CheckoutPage";

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <FavoritesProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegistrationPage />} />
              <Route path="/customer" element={<MenuPage />} />
              <Route path="/customer/favorites" element={<FavoritesPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
            </Routes>
          </BrowserRouter>
        </FavoritesProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;