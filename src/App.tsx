import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./customr-side/pages/LandingPage";
import Loginpage from "./customr-side/pages/Loginpage";
import RegistrationPage from "./customr-side/pages/RegistrationPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Loginpage />} />
         <Route path="/register" element={<RegistrationPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;