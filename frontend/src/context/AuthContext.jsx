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
    // Expose backend dynamically via secure public tunnel URL
    return 'https://eleven-nights-sleep.loca.lt/api';
  }
  return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();

// Create a custom axios instance for global defaults
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true' // Bypasses localtunnel's anti-phishing landing page in mobile app API requests
  }
});

// Configure request interceptor to automatically inject current token dynamically
api.interceptors.request.use(
  (config) => {
    const currentToken = localStorage.getItem('narubook_token');
    if (currentToken) {
      config.headers['Authorization'] = `Bearer ${currentToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const parseAxiosError = (err, defaultMsg) => {
  if (err.response) {
    // The server responded with a status code outside the 2xx range
    console.error(`Auth System - API Error [${err.response.status}]:`, err.response.data);
    return err.response.data?.error || defaultMsg;
  } else if (err.request) {
    // The request was made but no response was received (e.g. server offline, localtunnel down)
    console.error('Auth System - Network/Server connection failure:', err.request);
    return 'Network Error: Cannot connect to the server. Please verify the backend is running and check your connection.';
  } else {
    // Something happened setting up the request
    console.error('Auth System - Local request setup failure:', err.message);
    return `Client Error: ${err.message}`;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('narubook_token') || null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync token to localStorage and manage session state
  useEffect(() => {
    if (token) {
      localStorage.setItem('narubook_token', token);
      // Fetch session data ONLY if we don't have the user or profile already populated
      if (!user || !profile) {
        fetchSession();
      } else {
        setLoading(false);
      }
    } else {
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
            error.response.data && error.response.data.error &&
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
      console.error('Session fetch failed:', err.message);
      const errMsg = parseAxiosError(err, 'Failed to fetch session.');
      setError(errMsg);
      // Only clear credentials if the token is explicitly rejected as invalid or expired (401/403)
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const res = await api.post('/auth/login', { email, password });
      
      const loggedInToken = res.data.token;
      const loggedInUser = res.data.user;
      const loggedInProfile = res.data.profile;

      // Populate user and profile FIRST, then set token to bypass redundant fetchSession trigger
      setUser(loggedInUser);
      setProfile(loggedInProfile);
      setToken(loggedInToken);
      
      return { success: true };
    } catch (err) {
      const errMsg = parseAxiosError(err, 'Login failed. Please check credentials.');
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const signup = async (username, email, password) => {
    try {
      setError(null);
      const res = await api.post('/auth/signup', { username, email, password });
      
      const signedUpToken = res.data.token;
      const signedUpUser = res.data.user;
      const signedUpProfile = res.data.profile;

      setUser(signedUpUser);
      setProfile(signedUpProfile);
      setToken(signedUpToken);
      
      return { success: true };
    } catch (err) {
      const errMsg = parseAxiosError(err, 'Registration failed.');
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
      const errMsg = parseAxiosError(err, 'Profile update failed.');
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
      const errMsg = parseAxiosError(err, 'Password reset failed.');
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
