import { Box, Button, Card, CardContent, Chip, Stack, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { useLogin } from '../api/hooks';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await login.mutateAsync({ email: email.trim().toLowerCase(), password });
      if (data?.accessToken) localStorage.setItem('accessToken', data.accessToken);
      if (data?.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      toast.push({ message: 'Login realizado', severity: 'success' });
      navigate('/dashboard/national');
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Credenciais inválidas', severity: 'error' });
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: 2,
        py: { xs: 3, md: 4 },
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 1080,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' },
          gap: 2.2,
        }}
      >
        <Card
          sx={{
            display: 'grid',
            alignContent: 'space-between',
            p: { xs: 3, md: 4 },
            minHeight: { xs: 270, md: 420 },
            background: 'linear-gradient(145deg, rgba(12,101,126,0.93), rgba(8,73,91,0.95))',
            color: 'white',
            borderColor: alpha('#0C657E', 0.32),
            boxShadow: '0 24px 44px rgba(7, 46, 60, 0.28)',
          }}
        >
          <Box>
            <Typography variant="overline" sx={{ letterSpacing: '0.09em', opacity: 0.92 }}>
              Sistema Institucional
            </Typography>
            <Typography variant="h3" sx={{ fontSize: { xs: 30, md: 40 }, lineHeight: 1.1, mt: 0.8, maxWidth: 420 }}>
              Gestão Profissional da Comissão
            </Typography>
            <Typography variant="body1" sx={{ mt: 1.5, opacity: 0.92, maxWidth: 500 }}>
              Acompanhe atividades externas, tarefas internas, reuniões, checklists e relatórios em uma experiência unificada.
            </Typography>
          </Box>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Chip label="Atividades" size="small" sx={{ bgcolor: alpha('#fff', 0.14), color: 'white' }} />
            <Chip label="Relatórios" size="small" sx={{ bgcolor: alpha('#fff', 0.14), color: 'white' }} />
            <Chip label="Auditoria" size="small" sx={{ bgcolor: alpha('#fff', 0.14), color: 'white' }} />
            <Chip label="RBAC" size="small" sx={{ bgcolor: alpha('#fff', 0.14), color: 'white' }} />
          </Stack>
        </Card>

        <Card sx={{ alignSelf: 'stretch', display: 'grid', placeItems: 'center' }}>
          <CardContent sx={{ width: '100%', maxWidth: 390, p: { xs: 2.6, md: 3.4 } }}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Entrar
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.4 }}>
              Informe seu email institucional e senha.
            </Typography>
            <Box component="form" onSubmit={handleSubmit} display="grid" gap={1.5}>
              <TextField
                name="email"
                label="Email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
              />
              <TextField
                name="password"
                label="Senha"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
              />
              <Button variant="contained" type="submit" disabled={login.isPending} sx={{ mt: 0.6 }}>
                {login.isPending ? 'Entrando...' : 'Entrar'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
