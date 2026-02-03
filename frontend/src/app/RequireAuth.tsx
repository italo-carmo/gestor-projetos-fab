import { Navigate } from 'react-router-dom';
import { useMe } from '../api/hooks';

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { data, isLoading } = useMe();
  if (isLoading) return children;
  if (!data?.id) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
