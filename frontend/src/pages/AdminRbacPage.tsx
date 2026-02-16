import {
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMe, usePermissionsCatalog, useRbacExport, useRbacImport, useRbacSimulate, useRoles, useUsers, useUpdateUser, useEloRoles } from '../api/hooks';
import { can } from '../app/rbac';
import { useState, useMemo } from 'react';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { PermissionScope } from '../constants/enums';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';

type RbacExport = { version?: string; roles?: Array<{ name: string; permissions?: Array<{ resource: string; action: string; scope: string }> }> };

function validateRbacPayload(payload: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!payload || typeof payload !== 'object') {
    errors.push('Payload deve ser um objeto JSON.');
    return { valid: false, errors };
  }
  const p = payload as Record<string, unknown>;
  if (!p.roles || !Array.isArray(p.roles)) {
    errors.push('Campo "roles" é obrigatório e deve ser um array.');
    return { valid: false, errors };
  }
  const validScopes = new Set(PermissionScope);
  p.roles.forEach((role: unknown, idx: number) => {
    if (!role || typeof role !== 'object') {
      errors.push(`Role[${idx}]: deve ser um objeto.`);
      return;
    }
    const r = role as Record<string, unknown>;
    if (!r.permissions || !Array.isArray(r.permissions)) return;
    r.permissions.forEach((perm: unknown, pidx: number) => {
      const pm = perm as Record<string, unknown>;
      if (!pm.resource || !pm.action || !pm.scope) {
        errors.push(`Role[${idx}].permissions[${pidx}]: resource, action e scope são obrigatórios.`);
      } else if (!validScopes.has(pm.scope as string)) {
        errors.push(`Role[${idx}].permissions[${pidx}]: scope inválido "${pm.scope}".`);
      }
    });
  });
  return { valid: errors.length === 0, errors };
}

function computeDiff(current: RbacExport, incoming: RbacExport) {
  const currentRoles = new Map((current.roles ?? []).map((r) => [r.name, r]));
  const incomingRoles = incoming.roles ?? [];
  const rolesCreated: string[] = [];
  const rolesUpdated: string[] = [];
  const permsByRole: Record<string, { added: string[]; removed: string[] }> = {};

  incomingRoles.forEach((inc) => {
    const curr = currentRoles.get(inc.name);
    const incPerms = new Set((inc.permissions ?? []).map((p) => `${p.resource}:${p.action}:${p.scope}`));
    if (!curr) {
      rolesCreated.push(inc.name);
      permsByRole[inc.name] = { added: Array.from(incPerms), removed: [] };
    } else {
      const currPerms = new Set((curr.permissions ?? []).map((p) => `${p.resource}:${p.action}:${p.scope}`));
      const added = Array.from(incPerms).filter((p) => !currPerms.has(p));
      const removed = Array.from(currPerms).filter((p) => !incPerms.has(p));
      if (added.length || removed.length) {
        rolesUpdated.push(inc.name);
        permsByRole[inc.name] = { added, removed };
      }
    }
  });

  return { rolesCreated, rolesUpdated, permsByRole };
}

export function AdminRbacPage() {
  const { data: me } = useMe();
  const toast = useToast();
  const rolesQuery = useRoles();
  const usersQuery = useUsers();
  const permissionsQuery = usePermissionsCatalog();
  const exportQuery = useRbacExport();
  const rbacImport = useRbacImport();
  const [importStep, setImportStep] = useState(0);
  const [importPayload, setImportPayload] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [simUserId, setSimUserId] = useState('');
  const [simRoleId, setSimRoleId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const simulateQuery = useRbacSimulate({
    userId: simUserId || undefined,
    roleId: simRoleId || undefined,
  });
  const updateUser = useUpdateUser();
  const eloRolesQuery = useEloRoles();
  const eloRoles = eloRolesQuery.data?.items ?? [];

  const currentExport = (exportQuery.data ?? {}) as RbacExport;
  const parsedIncoming = useMemo(() => {
    try {
      return JSON.parse(importPayload || '{}') as RbacExport;
    } catch {
      return null;
    }
  }, [importPayload]);

  const validation = useMemo(() => (parsedIncoming ? validateRbacPayload(parsedIncoming) : null), [parsedIncoming]);
  const diff = useMemo(
    () => (parsedIncoming && validation?.valid ? computeDiff(currentExport, parsedIncoming) : null),
    [currentExport, parsedIncoming, validation?.valid],
  );

  const handleExportDownload = () => {
    const data = exportQuery.data ?? {};
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rbac-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.push({ message: 'Exportação baixada', severity: 'success' });
  };

  const handleImportConfirm = async () => {
    setConfirmOpen(false);
    try {
      const payload = JSON.parse(importPayload || '{}');
      await rbacImport.mutateAsync({ payload, mode: importMode });
      toast.push({ message: 'RBAC importado com sucesso', severity: 'success' });
      setImportStep(0);
      setImportPayload('');
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Erro na importação', severity: 'error' });
    }
  };

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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Matriz de permissões: exporte, importe e simule permissões por usuário ou role.
      </Typography>

      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Exportar / Importar
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
              <Button variant="contained" onClick={handleExportDownload} disabled={!exportQuery.data}>
                Baixar JSON
              </Button>
              <Button variant="outlined" onClick={() => setImportStep(1)}>
                Importar JSON
              </Button>
            </Stack>

            {importStep > 0 && (
              <Box sx={{ mt: 3 }}>
                <Stepper activeStep={importStep} sx={{ mb: 2 }}>
                  <Step><StepLabel>Arquivo / Colar</StepLabel></Step>
                  <Step><StepLabel>Revisar alterações</StepLabel></Step>
                  <Step><StepLabel>Confirmar</StepLabel></Step>
                </Stepper>

                {importStep === 1 && (
                  <Stack spacing={2}>
                    <TextField
                      select
                      size="small"
                      label="Modo"
                      value={importMode}
                      onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
                      sx={{ minWidth: 160 }}
                    >
                      <MenuItem value="merge">Mesclar (adicionar permissões)</MenuItem>
                      <MenuItem value="replace">Substituir (substituir por papel)</MenuItem>
                    </TextField>
                    <TextField
                      multiline
                      minRows={8}
                      placeholder='{"version":"1.0","roles":[...]}'
                      value={importPayload}
                      onChange={(e) => setImportPayload(e.target.value)}
                      fullWidth
                      error={!!validation && !validation.valid}
                      helperText={validation?.errors?.slice(0, 3).join(' ')}
                    />
                    {validation?.valid && diff && (
                      <Typography variant="body2" color="text.secondary">
                        Papéis a criar: {diff.rolesCreated.length}. Papéis a atualizar: {diff.rolesUpdated.length}.
                      </Typography>
                    )}
                    <Stack direction="row" spacing={1}>
                      <Button variant="text" onClick={() => setImportStep(0)}>Cancelar</Button>
                      <Button
                        variant="contained"
                        onClick={() => setImportStep(2)}
                        disabled={!validation?.valid}
                      >
                        Revisar alterações
                      </Button>
                    </Stack>
                  </Stack>
                )}

                {importStep === 2 && diff && (
                  <Stack spacing={2}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Papel</TableCell>
                          <TableCell>Adicionadas</TableCell>
                          <TableCell>Removidas</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[...diff.rolesCreated, ...diff.rolesUpdated].map((roleName) => {
                          const { added, removed } = diff.permsByRole[roleName] ?? { added: [], removed: [] };
                          return (
                            <TableRow key={roleName}>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>{roleName}</Typography>
                                {diff.rolesCreated.includes(roleName) && (
                                  <Typography variant="caption" color="primary">(nova)</Typography>
                                )}
                              </TableCell>
                              <TableCell>{added.slice(0, 5).join(', ')}{added.length > 5 ? ` +${added.length - 5}` : ''}</TableCell>
                              <TableCell>{removed.slice(0, 5).join(', ')}{removed.length > 5 ? ` +${removed.length - 5}` : ''}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    <Stack direction="row" spacing={1}>
                      <Button variant="text" onClick={() => setImportStep(1)}>Voltar</Button>
                      <Button variant="contained" color="primary" onClick={() => setConfirmOpen(true)}>
                        Confirmar importação
                      </Button>
                    </Stack>
                  </Stack>
                )}
              </Box>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Simulador de permissão
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                select
                size="small"
                label="Usuário"
                value={simUserId}
                onChange={(e) => { setSimUserId(e.target.value); setSimRoleId(''); }}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="">Selecionar</MenuItem>
                {(usersQuery.data?.items ?? []).map((user: any) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Papel"
                value={simRoleId}
                onChange={(e) => { setSimRoleId(e.target.value); setSimUserId(''); }}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="">Selecionar</MenuItem>
                {(rolesQuery.data?.items ?? []).map((role: any) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Typography variant="subtitle2" sx={{ mt: 2 }}>Permissões efetivas</Typography>
            <Box component="pre" sx={{ background: '#F5F8FC', p: 2, borderRadius: 2, overflow: 'auto', fontSize: 12 }}>
              {simulateQuery.data ? JSON.stringify(simulateQuery.data.permissions, null, 2) : 'Selecione usuário ou role.'}
            </Box>
          </CardContent>
        </Card>

        {can(me, 'users', 'view') && can(me, 'users', 'update') && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Responsáveis por Elo (nível Brasil)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Atribua o Elo que cada usuário acompanha a nível nacional (ex.: Psicologia, SSO). Esses usuários verão apenas os checklists do respectivo Elo.
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Usuário</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Elo responsável</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(usersQuery.data?.items ?? []).map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={user.eloRoleId ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateUser.mutate(
                              { id: user.id, eloRoleId: val || null },
                              {
                                onSuccess: () => toast.push({ message: 'Elo atualizado', severity: 'success' }),
                                onError: (err) => toast.push({ message: parseApiError(err).message ?? 'Erro ao atualizar', severity: 'error' }),
                              },
                            );
                          }}
                          disabled={updateUser.isPending}
                          sx={{ minWidth: 200 }}
                        >
                          <MenuItem value="">Nenhum</MenuItem>
                          {eloRoles.map((r: any) => (
                            <MenuItem key={r.id} value={r.id}>{r.name} ({r.code})</MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Catálogo de permissões
            </Typography>
            <Box component="pre" sx={{ background: '#F5F8FC', p: 2, borderRadius: 2, overflow: 'auto', fontSize: 12 }}>
              {permissionsQuery.data ? JSON.stringify(permissionsQuery.data.items, null, 2) : 'Carregando...'}
            </Box>
          </CardContent>
        </Card>
      </Stack>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar importaçãoação"
        message={`Importar matriz RBAC em modo "${importMode === 'merge' ? 'mesclar' : 'substituir'}"? Isso alterará as permissões dos papéis listados.`}
        confirmLabel="Importar"
        cancelLabel="Cancelar"
        onConfirm={handleImportConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </Box>
  );
}
