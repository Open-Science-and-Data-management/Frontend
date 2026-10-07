import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./styles/globals.css";
import { ThemeProvider } from "./components/ui/ThemeProvider";
import { routerConfig } from "./routes/routerConfig";
import { installPlanEffects } from "./store/planEffects";

// Cross-store consequences of a plan version coming into force.
installPlanEffects();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter {...routerConfig}>
        <ThemeProvider defaultTheme="light" storageKey="task-manager-theme">
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>,
);
