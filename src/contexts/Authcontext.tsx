// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import * as authService from '../services/authService';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'customer' | 'admin' | 'employee';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (fullName: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ✅ GAMIT ANG authService
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // ✅ GAMIT ANG authService.validateCredentials
      const validUser = authService.validateCredentials(email, password);
      
      if (validUser) {
        const userData: User = {
          id: validUser.id,
          fullName: validUser.fullName,
          email: validUser.email,
          role: validUser.role as 'customer'
        };
        setUser(userData);
        // ✅ GAMIT ANG authService.setCurrentUser
        authService.setCurrentUser(userData);
        setIsLoading(false);
        return true;
      }
      setIsLoading(false);
      return false;
    } catch (error) {
      setIsLoading(false);
      return false;
    }
  };

  const register = async (fullName: string, email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // ✅ GAMIT ANG authService.isEmailTaken
      if (authService.isEmailTaken(email)) {
        setIsLoading(false);
        return false;
      }
      
      // ✅ GAMIT ANG authService.createUserObject at saveUser
      const newUserId = Date.now().toString();
      const newUser = authService.createUserObject(newUserId, fullName, email, password);
      authService.saveUser(newUser);
      
      setIsLoading(false);
      return true;
    } catch (error) {
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    // ✅ GAMIT ANG authService.removeCurrentUser
    authService.removeCurrentUser();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};