import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import PhoneAndroidRoundedIcon from '@mui/icons-material/PhoneAndroidRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../app/toast';
import { parseApiError } from '../app/apiErrors';
import { resolveHomePath } from '../app/roleAccess';
import { ACTIVE_ROLE_STORAGE_KEY, api } from '../api/client';
import { useConfirmTwoFactorSetup } from '../api/hooks';

type SetupData = {
  setupToken: string;
  qrCodeDataUrl: string;
  manualEntryKey: string;
};

export function TwoFactorSetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirmSetup = useConfirmTwoFactorSetup();

  const stored = sessionStorage.getItem('2fa_setup');
  const setupData: SetupData | null = stored ? JSON.parse(stored) : null;

  const [code, setCode] = useState('');
  const [step, setStep] = useState<'scan' | 'backup'>('scan');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    if (!setupData) navigate('/login', { replace: true });
  }, [setupData, navigate]);

  if (!setupData) return null;

  const handleConfirmCode = async () => {
    const normalized = code.replace(/\s/g, '').trim();
    if (normalized.length !== 6) {
      toast.push({ message: 'Digite o código de 6 dígitos', severity: 'warning' });
      return;
    }
    try {
      const data = await confirmSetup.mutateAsync({
        setupToken: setupData.setupToken,
        code: normalized,
      });
      if (data?.accessToken) localStorage.setItem('accessToken', data.accessToken);
      if (data?.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
      setBackupCodes(data?.backupCodes ?? []);
      setStep('backup');
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? 'Código inválido. Verifique e tente novamente.',
        severity: 'error',
      });
    }
  };

  const handleFinish = async () => {
    sessionStorage.removeItem('2fa_setup');
    await queryClient.resetQueries();
    try {
      const me = (await api.get('/auth/me')).data;
      toast.push({ message: 'Autenticação em dois fatores ativada com sucesso!', severity: 'success' });
      navigate(resolveHomePath(me), { replace: true });
    } catch {
      window.location.href = '/';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.push({ message: 'Copiado!', severity: 'success' });
    });
  };

  if (step === 'backup') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          px: 2,
          py: 4,
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(180deg, #f6fbff 0%, #eef6fb 100%)',
        }}
      >
        <Card sx={{ maxWidth: 540, width: '100%', boxShadow: '0 22px 45px rgba(9, 43, 54, 0.14)' }}>
          <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <CheckCircleRoundedIcon sx={{ color: 'success.main', fontSize: 32 }} />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Verificação ativada!
              </Typography>
            </Stack>

            <Box
              sx={{
                p: 2.5,
                borderRadius: 2,
                bgcolor: 'warning.50',
                border: '1px solid',
                borderColor: 'warning.200',
                mb: 2.5,
                background: 'linear-gradient(135deg, #FFF8E1 0%, #FFF3E0 100%)',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#E65100', mb: 1 }}>
                Guarde estes códigos de recuperação!
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Se você perder o celular ou não conseguir abrir o Google Authenticator, use um destes
                códigos para entrar no sistema. Cada código só pode ser usado <strong>uma única vez</strong>.
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 1,
                  mb: 2,
                }}
              >
                {backupCodes.map((bc, i) => (
                  <Chip
                    key={i}
                    label={`${i + 1}. ${bc}`}
                    variant="outlined"
                    sx={{ fontFamily: 'monospace', fontWeight: 600, justifyContent: 'flex-start' }}
                  />
                ))}
              </Box>

              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyRoundedIcon />}
                  onClick={() => copyToClipboard(backupCodes.join('\n'))}
                >
                  Copiar códigos
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PrintRoundedIcon />}
                  onClick={() => {
                    const w = window.open('', '_blank');
                    if (w) {
                      w.document.write(
                        `<html><head><title>Códigos de Recuperação - Gestor CIPAVD</title></head><body style="font-family:monospace;padding:40px"><h2>Códigos de Recuperação</h2><p>Gestor CIPAVD - Autenticação em Dois Fatores</p><hr/><ol>${backupCodes.map((c) => `<li style="margin:8px 0;font-size:18px">${c}</li>`).join('')}</ol><hr/><p style="color:#666">Cada código só pode ser usado uma vez. Guarde em local seguro.</p></body></html>`,
                      );
                      w.print();
                    }
                  }}
                >
                  Imprimir
                </Button>
              </Stack>
            </Box>

            <FormControlLabel
              control={
                <Checkbox
                  checked={savedConfirmed}
                  onChange={(e) => setSavedConfirmed(e.target.checked)}
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Li e guardei meus códigos de recuperação em local seguro
                </Typography>
              }
              sx={{ mb: 2 }}
            />

            <Button
              variant="contained"
              fullWidth
              size="large"
              disabled={!savedConfirmed}
              onClick={handleFinish}
            >
              Concluir e acessar o sistema
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
        px: 2,
        py: 4,
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(180deg, #f6fbff 0%, #eef6fb 100%)',
      }}
    >
      <Card sx={{ maxWidth: 540, width: '100%', boxShadow: '0 22px 45px rgba(9, 43, 54, 0.14)' }}>
        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <LockRoundedIcon sx={{ color: 'primary.main', fontSize: 30 }} />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Proteção Extra para sua Conta
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            A partir de agora, você precisará de um código de verificação além da sua senha para
            acessar o sistema. Isso protege sua conta mesmo que alguém descubra sua senha.
          </Typography>

          <Divider sx={{ mb: 2.5 }} />

          {/* PASSO 1 */}
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Chip label="Passo 1" size="small" color="primary" sx={{ fontWeight: 700 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Baixe o aplicativo
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Instale o <strong>Google Authenticator</strong> no seu celular. Ele é gratuito e gera
              códigos de segurança para o login.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PhoneAndroidRoundedIcon />}
                href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
                target="_blank"
                rel="noopener"
              >
                Google Play (Android)
              </Button>
              <Button
                size="small"
                variant="outlined"
                href="https://apps.apple.com/app/google-authenticator/id388497605"
                target="_blank"
                rel="noopener"
              >
                App Store (iPhone)
              </Button>
            </Stack>
          </Box>

          {/* PASSO 2 */}
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Chip label="Passo 2" size="small" color="primary" sx={{ fontWeight: 700 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Escaneie o QR Code
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Abra o Google Authenticator, toque no botão <strong>+</strong> (adicionar) e depois em{' '}
              <strong>Ler código QR</strong>. Aponte a câmera do celular para o código abaixo:
            </Typography>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                p: 2,
                mb: 1.5,
                bgcolor: '#FFFFFF',
                borderRadius: 2,
                border: '2px dashed',
                borderColor: 'divider',
              }}
            >
              <Box
                component="img"
                src={setupData.qrCodeDataUrl}
                alt="QR Code para Google Authenticator"
                sx={{ width: 220, height: 220 }}
              />
            </Box>

            <Box
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Não consegue escanear? Use a chave manual:
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.06em', flexGrow: 1 }}
                >
                  {setupData.manualEntryKey}
                </Typography>
                <Tooltip title={copiedKey ? 'Copiado!' : 'Copiar chave'}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      copyToClipboard(setupData.manualEntryKey.replace(/\s/g, ''));
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                  >
                    <ContentCopyRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          </Box>

          {/* PASSO 3 */}
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Chip label="Passo 3" size="small" color="primary" sx={{ fontWeight: 700 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Confirme o código
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Após escanear, o aplicativo vai mostrar um código de 6 números que muda a cada 30
              segundos. Digite esse código abaixo para confirmar:
            </Typography>

            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <TextField
                size="small"
                label="Código de 6 dígitos"
                value={code}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(val);
                }}
                inputProps={{ inputMode: 'numeric', maxLength: 6, style: { letterSpacing: '0.3em', fontWeight: 700, fontSize: 18 } }}
                placeholder="000000"
                sx={{ flex: 1 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmCode();
                }}
              />
              <Button
                variant="contained"
                size="large"
                disabled={code.length !== 6 || confirmSetup.isPending}
                onClick={handleConfirmCode}
                startIcon={<QrCode2RoundedIcon />}
                sx={{ minHeight: 40 }}
              >
                {confirmSetup.isPending ? 'Verificando...' : 'Confirmar e Ativar'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
