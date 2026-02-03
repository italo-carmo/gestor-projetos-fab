import { Box, Card, CardContent, Typography } from '@mui/material';
import { useMe } from '../api/hooks';
import { can } from '../app/rbac';

export function AdminRbacPage() {
  const { data: me } = useMe();
  if (!can(me, 'roles', 'view') && !can(me, 'admin_rbac', 'export')) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Admin RBAC
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Acesso restrito.
        </Typography>
      </Box>
    );
  }
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Admin RBAC
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Matriz de permissoes, import/export e diff (placeholder).
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
