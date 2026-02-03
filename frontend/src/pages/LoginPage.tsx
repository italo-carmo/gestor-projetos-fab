import { Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useLogin } from '../api/hooks';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await login.mutateAsync({ email, password });
      if (data?.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
      }
      if (data?.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      toast.push({ message: 'Login realizado', severity: 'success' });
      navigate('/dashboard/national');
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Credenciais invalidas', severity: 'error' });
    }
  };

  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
      <Card sx={{ width: 360 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            SMIF Gestao
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Acesse com seu usuario
          </Typography>
          <Box component="form" onSubmit={handleSubmit} display="grid" gap={2} mt={2}>
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button variant="contained" type="submit" disabled={login.isPending}>
              Entrar
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
