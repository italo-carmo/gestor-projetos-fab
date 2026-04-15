import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useMe } from '../api/hooks';
import { resolveHomePath } from './roleAccess';

type RequireRoleAccessProps = {
  allow: (user: any) => boolean;
  children: ReactElement;
};

export function RequireRoleAccess({ allow, children }: RequireRoleAccessProps) {
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

  if (!allow(data)) {
    return <Navigate to={resolveHomePath(data)} replace />;
  }

  return children;
}
