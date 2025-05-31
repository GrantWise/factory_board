'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Factory } from 'lucide-react';

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Validates and sanitizes login form inputs before submission
   * @param e - Form submission event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Client-side validation
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    // Validate required fields
    if (!trimmedUsername) {
      setError('Username is required');
      setIsLoading(false);
      return;
    }

    if (!trimmedPassword) {
      setError('Password is required');
      setIsLoading(false);
      return;
    }

    // Validate username format (alphanumeric and common special chars)
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmedUsername)) {
      setError('Username contains invalid characters');
      setIsLoading(false);
      return;
    }

    // Validate minimum password length
    if (trimmedPassword.length < 3) {
      setError('Password must be at least 3 characters long');
      setIsLoading(false);
      return;
    }

    try {
      await login(trimmedUsername, trimmedPassword);
      onSuccess?.();
    } catch (err: any) {
      setError(err.error || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Factory className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold">Factory Board</span>
          </div>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            Enter your credentials to access the manufacturing planning system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                required
                disabled={isLoading}
                maxLength={50}
                autoComplete="username"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !username || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            <p>Demo Credentials:</p>
            <div className="grid grid-cols-1 gap-1 mt-2 text-xs">
              <p><strong>Admin:</strong> admin / password123</p>
              <p><strong>Scheduler:</strong> scheduler1 / password123</p>
              <p><strong>Viewer:</strong> viewer1 / password123</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}