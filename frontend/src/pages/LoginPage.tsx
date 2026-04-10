import { Box, Button, Card, CardContent, Divider, Stack, TextField, Typography } from '@mui/material';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { resolveHomePath } from '../app/roleAccess';
import { ACTIVE_ROLE_STORAGE_KEY, api } from '../api/client';
import { useLogin, useVerifyTwoFactor } from '../api/hooks';

type TwoFactorState = {
  twoFactorToken: string;
  useBackupCode: boolean;
};

export function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorState, setTwoFactorState] = useState<TwoFactorState | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const loginMutation = useLogin();
  const verifyMutation = useVerifyTwoFactor();
  const navigate = useNavigate();
  const toast = useToast();

  const normalizeCpfInput = (value: string) => value.replace(/\D/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalizedLogin = login.includes('@') ? login.trim() : normalizeCpfInput(login);
      const data = await loginMutation.mutateAsync({ login: normalizedLogin, password });

      if (data?.requiresTwoFactorSetup) {
        sessionStorage.setItem(
          '2fa_setup',
          JSON.stringify({
            setupToken: data.setupToken,
            qrCodeDataUrl: data.qrCodeDataUrl,
            manualEntryKey: data.manualEntryKey,
          }),
        );
        navigate('/2fa-setup', { replace: true });
        return;
      }

      if (data?.requiresTwoFactor) {
        setTwoFactorState({ twoFactorToken: data.twoFactorToken, useBackupCode: false });
        return;
      }

      if (data?.accessToken) localStorage.setItem('accessToken', data.accessToken);
      if (data?.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
      const me = (await api.get('/auth/me')).data;
      toast.push({ message: 'Login realizado', severity: 'success' });
      navigate(resolveHomePath(me));
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({ message: payload.message ?? 'Credenciais inválidas', severity: 'error' });
    }
  };

  const handleVerify2fa = async () => {
    if (!twoFactorState) return;
    const normalized = totpCode.replace(/\s/g, '').trim();
    if (!normalized) {
      toast.push({ message: 'Digite o código', severity: 'warning' });
      return;
    }
    try {
      const data = await verifyMutation.mutateAsync({
        twoFactorToken: twoFactorState.twoFactorToken,
        code: normalized,
      });
      if (data?.accessToken) localStorage.setItem('accessToken', data.accessToken);
      if (data?.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
      const me = (await api.get('/auth/me')).data;
      toast.push({ message: 'Login realizado', severity: 'success' });
      navigate(resolveHomePath(me));
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? 'Código inválido',
        severity: 'error',
      });
    }
  };

  if (twoFactorState) {
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
        <Card
          sx={{
            width: '100%',
            maxWidth: 440,
            boxShadow: '0 22px 45px rgba(9, 43, 54, 0.14)',
          }}
        >
          <CardContent sx={{ p: { xs: 2.6, md: 3.4 } }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <LockRoundedIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Verificação em duas etapas
              </Typography>
            </Stack>

            {!twoFactorState.useBackupCode ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                  Abra o <strong>Google Authenticator</strong> no seu celular e digite o código de 6
                  dígitos:
                </Typography>
                <TextField
                  size="small"
                  label="Código de 6 dígitos"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputProps={{
                    inputMode: 'numeric',
                    maxLength: 6,
                    style: { letterSpacing: '0.3em', fontWeight: 700, fontSize: 18, textAlign: 'center' },
                  }}
                  placeholder="000000"
                  fullWidth
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleVerify2fa();
                  }}
                  sx={{ mb: 2 }}
                />
                <Button
                  variant="contained"
                  fullWidth
                  disabled={totpCode.length !== 6 || verifyMutation.isPending}
                  onClick={handleVerify2fa}
                >
                  {verifyMutation.isPending ? 'Verificando...' : 'Verificar'}
                </Button>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Perdeu o acesso ao aplicativo?
                </Typography>
                <Button
                  size="small"
                  onClick={() => {
                    setTotpCode('');
                    setTwoFactorState({ ...twoFactorState, useBackupCode: true });
                  }}
                >
                  Usar código de recuperação
                </Button>
              </>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                  Digite um dos seus códigos de recuperação (formato XXXX-XXXX):
                </Typography>
                <TextField
                  size="small"
                  label="Código de recuperação"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.slice(0, 9))}
                  inputProps={{
                    style: { letterSpacing: '0.1em', fontWeight: 700, fontSize: 16, textAlign: 'center' },
                  }}
                  placeholder="XXXX-XXXX"
                  fullWidth
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleVerify2fa();
                  }}
                  sx={{ mb: 1 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Cada código só pode ser usado uma vez. Se não tem mais códigos, procure o setor de TI.
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  disabled={!totpCode.trim() || verifyMutation.isPending}
                  onClick={handleVerify2fa}
                >
                  {verifyMutation.isPending ? 'Verificando...' : 'Verificar'}
                </Button>
                <Button
                  size="small"
                  startIcon={<ArrowBackRoundedIcon />}
                  onClick={() => {
                    setTotpCode('');
                    setTwoFactorState({ ...twoFactorState, useBackupCode: false });
                  }}
                  sx={{ mt: 1.5 }}
                >
                  Voltar ao código do aplicativo
                </Button>
              </>
            )}

            <Button
              size="small"
              color="inherit"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={() => {
                setTwoFactorState(null);
                setTotpCode('');
                setPassword('');
              }}
              sx={{ mt: 1 }}
            >
              Voltar ao login
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

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
