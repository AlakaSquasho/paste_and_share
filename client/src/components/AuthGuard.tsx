// client/src/components/AuthGuard.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Optionally verify token validity with a backend call here
      // For now, we rely on the interceptor to catch 401s
      setIsAuthenticated(true);
      setIsLoading(false);
    };

    checkAuth();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-sand dark:bg-night">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-ink/10 border-t-accent dark:border-white/10"></div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
}
