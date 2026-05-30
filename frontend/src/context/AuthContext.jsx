import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const getApiBaseUrl = () => {
  const isNative = 
    window.Capacitor || 
    window.location.origin.includes('capacitor://') || 
    window.location.origin.startsWith('file://') ||
    window.location.origin.includes('http://localhost:80');
  
  if (isNative) {
    return 'http://10.0.2.2:5000/api';
  }
  return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();

// Create a custom axios instance for global defaults
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Set Authorization header synchronously to prevent 401 race conditions during initial mount
const initialToken = localStorage.getItem('narubook_token');
if (initialToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('narubook_token') || null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Set global authorization header
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('narubook_token', token);
      fetchSession();
    } else {
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('narubook_token');
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  }, [token]);

  // Inject response interceptor to handle block status codes (403 status checking)
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 403 && 
            (error.response.data.error.includes('blocked') || error.response.data.error.includes('suspended'))) {
          // Force logout immediately if banned or suspended
          logout();
          alert(`Access Denied: ${error.response.data.error}`);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, []);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setProfile(res.data.profile);
      setError(null);
    } catch (err) {
      console.error('Session fetch failed, logging out:', err.message);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const res = await api.post('/auth/login', { email, password });
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true };
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Login failed. Please check credentials.';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const signup = async (username, email, password) => {
    try {
      setError(null);
      const res = await api.post('/auth/signup', { username, email, password });
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true };
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Registration failed.';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setProfile(null);
    localStorage.removeItem('narubook_token');
  };

  const updateProfile = async (profileData) => {
    try {
      setError(null);
      const res = await api.put('/users/profile', profileData);
      setProfile(res.data.profile);
      return { success: true };
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Profile update failed.';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const resetPassword = async (email, newPassword) => {
    try {
      setError(null);
      const res = await api.post('/auth/reset-password', { email, newPassword });
      return { success: true, message: res.data.message };
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Password reset failed.';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  return (
    <AuthContext.Provider value={{
      token,
      user,
      profile,
      loading,
      error,
      login,
      signup,
      logout,
      updateProfile,
      resetPassword,
      refreshSession: fetchSession
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
