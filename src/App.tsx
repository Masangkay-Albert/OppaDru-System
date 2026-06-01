import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./customr-side/pages/LandingPage";
import Loginpage from "./customr-side/pages/Loginpage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Loginpage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;