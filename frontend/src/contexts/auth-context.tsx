'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User } from '@/types/manufacturing';
import { authService } from '@/lib/api-services';
import { api } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: (refreshToken: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (roles: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Check if user has specific permission based on role
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;

    const rolePermissions = {
      admin: [
        'users:read', 'users:write', 'users:delete',
        'work_centres:read', 'work_centres:write', 'work_centres:delete',
        'orders:read', 'orders:write', 'orders:delete', 'orders:move',
        'analytics:read', 'planning:read', 'planning:write'
      ],
      scheduler: [
        'work_centres:read',
        'orders:read', 'orders:write', 'orders:move',
        'analytics:read', 'planning:read', 'planning:write'
      ],
      viewer: [
        'work_centres:read',
        'orders:read',
        'analytics:read', 'planning:read'
      ]
    };

    return rolePermissions[user.role]?.includes(permission) || false;
  };

  // Check if user has specific role(s)
  const hasRole = (roles: string | string[]): boolean => {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  };

  const login = async (username: string, password: string): Promise<void> => {
    try {
      const response = await authService.login(username, password);
      
      // Validate response structure
      if (!response || !response.user) {
        throw new Error('Invalid response from server');
      }
      
      setUser(response.user);
      
      // Store refresh token in localStorage
      if (response.refresh_token) {
        localStorage.setItem('refresh_token', response.refresh_token);
      }
    } catch (error: unknown) {
      const err = error as { message?: string; error?: string; status?: number; code?: string }
      console.error('Login failed:', {
        message: err?.message || 'Unknown error',
        error: err?.error || 'No error details',
        status: err?.status || 'No status',
        code: err?.code || 'No code'
      });
      
      // Re-throw with better error structure
      const errorToThrow = {
        error: err?.error || err?.message || 'Login failed',
        code: err?.code || 'LOGIN_FAILED',
        status: err?.status || 500
      };
      
      throw errorToThrow;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
      api.setToken(null);
      localStorage.removeItem('refresh_token');
    }
  };

  const refreshToken = useCallback(async (refreshTokenValue: string): Promise<void> => {
    try {
      const response = await authService.refreshToken(refreshTokenValue);
      setUser(response.user);
      
      if (response.refresh_token) {
        localStorage.setItem('refresh_token', response.refresh_token);
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      // If refresh fails, logout user
      await logout();
      throw error;
    }
  }, [logout]);

  // Initialize auth state on mount
  useEffect(() => {
    let isMounted = true;
    
    const initializeAuth = async () => {
      const token = api.getToken();
      
      if (token && isMounted) {
        try {
          const response = await authService.getCurrentUser();
          if (isMounted) {
            setUser(response.user);
          }
        } catch (error: unknown) {
          // Check if it's a rate limiting error
          const err = error as { status?: number };
          if (err.status === 429) {
            // Rate limited - skip auth check for now
            if (isMounted) {
              setIsLoading(false);
            }
            return;
          }
          
          // Other auth errors - clear tokens
          if (isMounted) {
            api.setToken(null);
            localStorage.removeItem('refresh_token');
          }
        }
      }
      
      if (isMounted) {
        setIsLoading(false);
      }
    };

    initializeAuth();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-refresh token when it's about to expire
  useEffect(() => {
    if (!user || !api.getToken()) return;

    const token = api.getToken();
    if (!token) return;

    try {
      // Decode JWT to get expiration time
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = tokenPayload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeUntilExpiry = expirationTime - currentTime;
      
      // Refresh token 5 minutes before it expires
      const refreshTime = timeUntilExpiry - (5 * 60 * 1000);
      
      if (refreshTime > 0) {
        const refreshTimeout = setTimeout(async () => {
          const refreshTokenValue = localStorage.getItem('refresh_token');
          if (refreshTokenValue) {
            try {
              await refreshToken(refreshTokenValue);
            } catch (error) {
              console.error('Auto refresh failed:', error);
            }
          }
        }, refreshTime);

        return () => clearTimeout(refreshTimeout);
      }
    } catch (error) {
      console.error('Failed to decode token for auto-refresh:', error);
    }
  }, [user, refreshToken]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshToken,
    hasPermission,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};