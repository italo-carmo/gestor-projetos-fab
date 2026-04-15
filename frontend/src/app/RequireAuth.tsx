import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useMe } from '../api/hooks';

export function RequireAuth({ children }: { children: ReactElement }) {
  const { data, isLoading, isError } = useMe();
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
        Carregando…
      </div>
    );
  }
  if (isError || !data?.id) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
