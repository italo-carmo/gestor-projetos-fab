import { Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { resolveHomePath } from '../app/roleAccess';
import { api } from '../api/client';
import { useLogin } from '../api/hooks';

export function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const loginMutation = useLogin();
  const navigate = useNavigate();
  const toast = useToast();

  const normalizeCpfInput = (value: string) => value.replace(/\D/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalizedLogin = login.includes('@') ? login.trim() : normalizeCpfInput(login);
      const data = await loginMutation.mutateAsync({ login: normalizedLogin, password });
      if (data?.accessToken) localStorage.setItem('accessToken', data.accessToken);
      if (data?.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      const me = (await api.get('/auth/me')).data;
      toast.push({ message: 'Login realizado', severity: 'success' });
      navigate(resolveHomePath(me));
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Credenciais inválidas', severity: 'error' });
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: 2.2,
        py: { xs: 3, md: 4.5 },
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(180deg, #f6fbff 0%, #eef6fb 100%)',
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
            placeItems: 'center',
            p: { xs: 3, md: 4 },
            minHeight: { xs: 270, md: 420 },
            background: 'linear-gradient(145deg, rgba(12,101,126,0.93), rgba(8,73,91,0.95))',
            boxShadow: '0 24px 44px rgba(7, 46, 60, 0.28)',
          }}
        >
          <Box
            component="img"
            src="/logo-png.png"
            alt="CIPAVD"
            sx={{
              width: { xs: '92%', md: '85%' },
              maxWidth: 520,
              maxHeight: { xs: 280, md: 420 },
              objectFit: 'contain',
              display: 'block',
              mx: 'auto',
              filter: 'drop-shadow(0 18px 30px rgba(3, 23, 30, 0.35))',
            }}
          />
        </Card>

        <Card
          sx={{
            width: '100%',
            maxWidth: 430,
            alignSelf: 'stretch',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 22px 45px rgba(9, 43, 54, 0.14)',
          }}
        >
          <CardContent sx={{ width: '100%', maxWidth: 390, p: { xs: 2.6, md: 3.4 } }}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Entrar
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.4 }}>
              Informe seu CPF e senha do Portal.
            </Typography>
            <Box component="form" onSubmit={handleSubmit} display="grid" gap={1.5}>
              <TextField
                name="login"
                label="CPF"
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(normalizeCpfInput(e.target.value))}
                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 11 }}
                placeholder="Somente números"
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
              <Button variant="contained" type="submit" disabled={loginMutation.isPending} sx={{ mt: 0.6 }}>
                {loginMutation.isPending ? 'Entrando...' : 'Entrar'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
