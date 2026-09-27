import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './styles/globals.css';
import { ThemeProvider } from './components/ui/ThemeProvider';
import { routerConfig } from './routes/routerConfig';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <HashRouter {...routerConfig}>
        <ThemeProvider defaultTheme="light" storageKey="task-manager-theme">
          <App />
        </ThemeProvider>
      </HashRouter>
    </HelmetProvider>
  </React.StrictMode>
);
