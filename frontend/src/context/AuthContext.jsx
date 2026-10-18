import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    const token = apiClient.getToken();
    if (token) {
      refreshProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const refreshProfile = async () => {
    try {
      const profile = await apiClient.getProfile();
      setUser(profile);
    } catch (err) {
      console.error('Failed to load profile:', err);
      apiClient.setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (identifier, password, referralCode = '') => {
    const res = await apiClient.login(identifier, password, referralCode);
    apiClient.setToken(res.access_token);
    setUser(res.user);
    setIsAuthModalOpen(false);
    return res;
  };

  const register = async (phone, fullName, password, countryCode, referralCode, username = '') => {
    const res = await apiClient.register(phone, fullName, password, countryCode, referralCode, username);
    apiClient.setToken(res.access_token);
    setUser(res.user);
    setIsAuthModalOpen(false);
    return res;
  };

  const logout = () => {
    apiClient.setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshProfile,
        isAuthModalOpen,
        setIsAuthModalOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
