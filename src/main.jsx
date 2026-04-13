import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PasswordGate from "./PasswordGate.jsx";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PasswordGate>
      <App />
    </PasswordGate>
  </StrictMode>
);
