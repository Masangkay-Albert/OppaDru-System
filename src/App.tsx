import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./modules/customer-side/pages/LandingPage";
import LoginPage from "./modules/customer-side/pages/Loginpage";
import RegistrationPage from "./modules/customer-side/pages/RegistrationPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegistrationPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;