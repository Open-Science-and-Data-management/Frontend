import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Navbar } from '@/components/ui/navbar';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>React TypeScript Template</title>
        <meta name="description" content="React TypeScript Template Application" />
      </Helmet>
      
      <Navbar>
        <div className="flex items-center space-x-4">
          <ThemeToggle />
        </div>
      </Navbar>
      
      <main className="container mx-auto py-6 px-4">
        {children}
      </main>
      
      <footer className="border-t py-4 text-center text-sm text-muted-foreground">
        <div className="container mx-auto">
          <p>© {new Date().getFullYear()} Luis Alamo. MIT License.</p>
        </div>
      </footer>
    </div>
  );
};
