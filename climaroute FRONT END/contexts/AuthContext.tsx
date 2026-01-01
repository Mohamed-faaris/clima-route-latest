import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '../services/apiservice';

export interface User {
  email: string;
  name: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<User>;
  signup: (email: string, name: string, password?: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children?: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check local storage on mount
    const storedUser = localStorage.getItem('clima_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setIsAuthenticated(true);
      // Restore userEmail and userName for trip tracking
      if (parsedUser.email) localStorage.setItem('userEmail', parsedUser.email);
      if (parsedUser.name) localStorage.setItem('userName', parsedUser.name);
    }
  }, []);

  const login = async (email: string, password?: string): Promise<User> => {
    // Call backend login
    const res = await apiService.login(email, password || '');
    // res expected: { token, user: { email, name, role } }
    const u = res.user || res;
    console.log('[Auth] Login response user:', u);
    const userObj: User = { email: u.email, name: u.name, role: u.role?.toLowerCase() === 'admin' ? 'admin' : 'user' };
    console.log('[Auth] Logged in user:', userObj);
    setUser(userObj);
    setIsAuthenticated(true);
    localStorage.setItem('clima_user', JSON.stringify(userObj));
    localStorage.setItem('userEmail', u.email); // Store email for trip tracking
    localStorage.setItem('userName', u.name); // Store name for display
    if (res.token) localStorage.setItem('clima_token', res.token);
    return userObj;
  };

  const signup = async (email: string, name: string, password?: string) => {
    const res = await apiService.signup(email, name, password);
    // res expected: { token, user: { email, name, role } }
    const u = res.user || res;
    const userObj: User = { email: u.email, name: u.name, role: u.role?.toLowerCase() === 'admin' ? 'admin' : 'user' };
    setUser(userObj);
    setIsAuthenticated(true);
    localStorage.setItem('clima_user', JSON.stringify(userObj));
    localStorage.setItem('userEmail', u.email); // Store email for trip tracking
    localStorage.setItem('userName', u.name); // Store name for display
    if (res.token) localStorage.setItem('clima_token', res.token);
    return userObj;
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    // Clear user authentication data
    localStorage.removeItem('clima_user');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('clima_token');
    
    // Clear all navigation/trip data to prevent cross-user data leakage
    localStorage.removeItem('climaRoute_navigation_active');
    localStorage.removeItem('climaRoute_origin');
    localStorage.removeItem('climaRoute_dest');
    localStorage.removeItem('climaRoute_originAddress');
    localStorage.removeItem('climaRoute_destAddress');
    localStorage.removeItem('climaRoute_data');
    localStorage.removeItem('climaRoute_userPosition');
    localStorage.removeItem('climaRoute_selectedRoute');
    localStorage.removeItem('climaRoute_tripStartTime');
    localStorage.removeItem('climaRoute_weather');
    localStorage.removeItem('climaRoute_navStartCoords');
    localStorage.removeItem('climaRoute_timeLeft');
    localStorage.removeItem('climaRoute_tripId');
    localStorage.removeItem('climaRoute_liveSpeed');
    localStorage.removeItem('climaRoute_eta');
    
    // Clear session storage as well
    sessionStorage.clear();
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};