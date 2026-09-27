import React from 'react';
import { MainLayout } from './layouts/MainLayout';
import AppRoutes from './routes/AppRoutes';

const App: React.FC = () => {
  return (
    <MainLayout>
      <AppRoutes />
    </MainLayout>
  );
};

export default App;
