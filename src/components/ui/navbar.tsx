import React from 'react';
import { Link } from 'react-router-dom';

interface NavbarProps {
  children?: React.ReactNode;
}

export const Navbar: React.FC<NavbarProps> = ({ children }) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">React TypeScript Template</span>
          </Link>
          
          <nav className="hidden md:flex gap-6">
            <Link to="/tasks" className="text-sm font-medium transition-colors hover:text-primary">
              Tasks
            </Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          {children}
        </div>
      </div>
    </header>
  );
};
