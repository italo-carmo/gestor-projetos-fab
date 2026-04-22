import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../app/toast";
import { parseApiError } from "../app/apiErrors";
import { resolveHomePath } from "../app/roleAccess";
import { ACTIVE_ROLE_STORAGE_KEY, api } from "../api/client";
import {
  useCreateCpcaPresidentSelfRegistration,
  useLogin,
  useLookupCpcaSelfRegistrationCandidate,
  useVerifyTwoFactor,
} from "../api/hooks";
import {
  CPCA_PRESIDENT_BULLETIN_ACCEPT,
  formatCpcaPresidentBulletinFileSize,
  type CpcaPresidentBulletinValidationResult,
  validateCpcaPresidentBulletinFile,
} from "../features/cpcaPresidentBulletinFile";

type TwoFactorState = {
  twoFactorToken: string;
  useBackupCode: boolean;
};

function asNonEmptyString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || "";
}

type CpcaSelfRegistrationLookupPreview = {
  identifier: string;
  profile: {
    uid: string;
    name?: string | null;
    email?: string | null;
    fabom?: string | null;
    postoGraduacao?: string | null;
    warName?: string | null;
  };
  locality?: {
    id: string;
    code: string;
    name: string;
    hasCpca: boolean;
  } | null;
};

type ValidCpcaPresidentBulletin = Extract<
  CpcaPresidentBulletinValidationResult,
  { ok: true }
>;

function formatOmLabel(
  code: string | null | undefined,
  name: string | null | undefined,
) {
  const codeValue = String(code ?? "").trim();
  const nameValue = String(name ?? "").trim();
  if (codeValue && nameValue) {
    if (
      codeValue.localeCompare(nameValue, "pt-BR", { sensitivity: "base" }) === 0
    ) {
      return codeValue;
    }
    return `${codeValue} - ${nameValue}`;
  }
  return codeValue || nameValue;
}

export function LoginPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorState, setTwoFactorState] = useState<TwoFactorState | null>(
    null,
  );
  const [totpCode, setTotpCode] = useState("");
  const [cpcaSelfRegistrationOpen, setCpcaSelfRegistrationOpen] =
    useState(false);
  const [cpcaIdentifier, setCpcaIdentifier] = useState("");
  const [cpcaIsSubstitution, setCpcaIsSubstitution] = useState(false);
  const [cpcaBulletinNumber, setCpcaBulletinNumber] = useState("");
  const [cpcaLookupPreview, setCpcaLookupPreview] =
    useState<CpcaSelfRegistrationLookupPreview | null>(null);
  const [cpcaBulletinFile, setCpcaBulletinFile] = useState<File | null>(null);
  const [cpcaBulletinFileValidation, setCpcaBulletinFileValidation] =
    useState<ValidCpcaPresidentBulletin | null>(null);
  const [cpcaBulletinFileError, setCpcaBulletinFileError] = useState("");
  const [cpcaBulletinFileIsValidating, setCpcaBulletinFileIsValidating] =
    useState(false);
  const loginMutation = useLogin();
  const verifyMutation = useVerifyTwoFactor();
  const cpcaSelfRegistrationLookupMutation =
    useLookupCpcaSelfRegistrationCandidate();
  const cpcaSelfRegistrationMutation = useCreateCpcaPresidentSelfRegistration();
  const navigate = useNavigate();
  const toast = useToast();

  const normalizeCpfInput = (value: string) => value.replace(/\D/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalizedLogin = login.includes("@")
        ? login.trim()
        : normalizeCpfInput(login);
      const data = await loginMutation.mutateAsync({
        login: normalizedLogin,
        password,
      });

      const requiresTwoFactorSetup = Boolean(
        data?.requiresTwoFactorSetup ?? data?.requires_two_factor_setup,
      );
      const requiresTwoFactor = Boolean(
        data?.requiresTwoFactor ?? data?.requires_two_factor,
      );
      const accessToken = asNonEmptyString(
        data?.accessToken ?? data?.access_token,
      );
      const refreshToken = asNonEmptyString(
        data?.refreshToken ?? data?.refresh_token,
      );

      if (requiresTwoFactorSetup) {
        sessionStorage.setItem(
          "2fa_setup",
          JSON.stringify({
            setupToken: asNonEmptyString(data?.setupToken ?? data?.setup_token),
            qrCodeDataUrl: asNonEmptyString(
              data?.qrCodeDataUrl ?? data?.qr_code_data_url,
            ),
            manualEntryKey: asNonEmptyString(
              data?.manualEntryKey ?? data?.manual_entry_key,
            ),
          }),
        );
        navigate("/2fa-setup", { replace: true });
        return;
      }

      if (requiresTwoFactor) {
        setTwoFactorState({
          twoFactorToken: asNonEmptyString(
            data?.twoFactorToken ?? data?.two_factor_token,
          ),
          useBackupCode: false,
        });
        return;
      }

      if (!accessToken) {
        throw new Error(
          "Não foi possível concluir o login. Atualize a página e tente novamente.",
        );
      }

      localStorage.setItem("accessToken", accessToken);
      if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
      localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
      const me = (await api.get("/auth/me")).data;
      toast.push({ message: "Login realizado", severity: "success" });
      navigate(resolveHomePath(me));
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Credenciais inválidas",
        severity: "error",
      });
    }
  };

  const handleVerify2fa = async () => {
    if (!twoFactorState) return;
    const normalized = totpCode.replace(/\s/g, "").trim();
    if (!normalized) {
      toast.push({ message: "Digite o código", severity: "warning" });
      return;
    }
    try {
      const data = await verifyMutation.mutateAsync({
        twoFactorToken: twoFactorState.twoFactorToken,
        code: normalized,
      });
      const accessToken = asNonEmptyString(
        data?.accessToken ?? data?.access_token,
      );
      const refreshToken = asNonEmptyString(
        data?.refreshToken ?? data?.refresh_token,
      );
      if (!accessToken) {
        throw new Error(
          "Não foi possível validar o token de acesso após o código 2FA.",
        );
      }
      localStorage.setItem("accessToken", accessToken);
      if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
      localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
      const me = (await api.get("/auth/me")).data;
      toast.push({ message: "Login realizado", severity: "success" });
      navigate(resolveHomePath(me));
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Código inválido",
        severity: "error",
      });
    }
  };

  const resetCpcaSelfRegistrationForm = () => {
    setCpcaIdentifier("");
    setCpcaIsSubstitution(false);
    setCpcaBulletinNumber("");
    setCpcaLookupPreview(null);
    setCpcaBulletinFile(null);
    setCpcaBulletinFileValidation(null);
    setCpcaBulletinFileError("");
    setCpcaBulletinFileIsValidating(false);
  };

  const handleCpcaBulletinFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0] ?? null;
    event.target.value = "";

    setCpcaBulletinFile(null);
    setCpcaBulletinFileValidation(null);
    setCpcaBulletinFileError("");

    if (!selectedFile) return;

    setCpcaBulletinFileIsValidating(true);
    try {
      const validation = await validateCpcaPresidentBulletinFile(selectedFile);
      if (!validation.ok) {
        setCpcaBulletinFileError(validation.message);
        return;
      }
      setCpcaBulletinFile(selectedFile);
      setCpcaBulletinFileValidation(validation);
    } finally {
      setCpcaBulletinFileIsValidating(false);
    }
  };

  const handleLookupCpcaSelfRegistrationCandidate = async () => {
    const identifier = cpcaIdentifier.trim();
    if (!identifier) {
      toast.push({
        message: "Informe e-mail ou CPF para buscar no LDAP.",
        severity: "warning",
      });
      return;
    }
    try {
      const result = (await cpcaSelfRegistrationLookupMutation.mutateAsync({
        identifier,
      })) as {
        profile?: {
          uid: string;
          name?: string | null;
          email?: string | null;
          fabom?: string | null;
          postoGraduacao?: string | null;
          warName?: string | null;
        };
        locality?: {
          id: string;
          code: string;
          name: string;
          hasCpca: boolean;
        } | null;
      };
      if (!result?.profile?.uid) {
        setCpcaLookupPreview(null);
        toast.push({
          message: "Nenhum militar encontrado no LDAP.",
          severity: "warning",
        });
        return;
      }
      setCpcaLookupPreview({
        identifier,
        profile: result.profile,
        locality: result.locality ?? null,
      });
      toast.push({
        message: "Militar encontrado no LDAP.",
        severity: "success",
      });
    } catch (error) {
      setCpcaLookupPreview(null);
      const payload = parseApiError(error);
      toast.push({
        message: payload.message ?? "Erro ao buscar militar no LDAP.",
        severity: "error",
      });
    }
  };

  const handleSubmitCpcaSelfRegistration = async () => {
    const identifier = cpcaIdentifier.trim();
    const localityId = String(cpcaLookupPreview?.locality?.id ?? "").trim();
    const bulletinNumber = cpcaBulletinNumber.trim();
    if (!identifier || !localityId || !bulletinNumber) {
      toast.push({
        message:
          "Preencha e-mail/CPF, faça a busca LDAP e informe o boletim para enviar a solicitação.",
        severity: "warning",
      });
      return;
    }
    if (!cpcaBulletinFile || !cpcaBulletinFileValidation) {
      toast.push({
        message:
          cpcaBulletinFileError ||
          "Anexe o boletim publicado em PDF, PNG ou JPG antes de enviar a solicitação.",
        severity: "warning",
      });
      return;
    }
    if (cpcaBulletinFileIsValidating) {
      toast.push({
        message: "Aguarde a validação do arquivo do boletim.",
        severity: "info",
      });
      return;
    }
    if (
      !cpcaLookupPreview ||
      cpcaLookupPreview.identifier.toLowerCase() !== identifier.toLowerCase()
    ) {
      toast.push({
        message:
          'Clique em "Buscar" e valide os dados do militar antes de enviar.',
        severity: "warning",
      });
      return;
    }
    try {
      await cpcaSelfRegistrationMutation.mutateAsync({
        identifier,
        localityId,
        isSubstitution: cpcaIsSubstitution,
        bulletinNumber,
        bulletinFile: cpcaBulletinFile,
      });
      toast.push({
        message: "Solicitação enviada para homologação da COMGEP.",
        severity: "success",
      });
      setCpcaSelfRegistrationOpen(false);
      resetCpcaSelfRegistrationForm();
    } catch (error) {
      const payload = parseApiError(error);
      toast.push({
        message:
          payload.message ?? "Erro ao enviar solicitação de presidente CPCA.",
        severity: "error",
      });
    }
  };

  if (twoFactorState) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          px: 2.2,
          py: { xs: 3, md: 4.5 },
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(180deg, #f6fbff 0%, #eef6fb 100%)",
        }}
      >
        <Card
          sx={{
            width: "100%",
            maxWidth: 440,
            boxShadow: "0 22px 45px rgba(9, 43, 54, 0.14)",
          }}
        >
          <CardContent sx={{ p: { xs: 2.6, md: 3.4 } }}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ mb: 1 }}
            >
              <LockRoundedIcon sx={{ color: "primary.main" }} />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Verificação em duas etapas
              </Typography>
            </Stack>

            {!twoFactorState.useBackupCode ? (
              <>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2.5 }}
                >
                  Abra o <strong>Google Authenticator</strong> no seu celular e
                  digite o código de 6 dígitos:
                </Typography>
                <TextField
                  size="small"
                  label="Código de 6 dígitos"
                  value={totpCode}
                  onChange={(e) =>
                    setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputProps={{
                    inputMode: "numeric",
                    maxLength: 6,
                    style: {
                      letterSpacing: "0.3em",
                      fontWeight: 700,
                      fontSize: 18,
                      textAlign: "center",
                    },
                  }}
                  placeholder="000000"
                  fullWidth
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleVerify2fa();
                  }}
                  sx={{ mb: 2 }}
                />
                <Button
                  variant="contained"
                  fullWidth
                  disabled={totpCode.length !== 6 || verifyMutation.isPending}
                  onClick={handleVerify2fa}
                >
                  {verifyMutation.isPending ? "Verificando..." : "Verificar"}
                </Button>
                <Divider sx={{ my: 2 }} />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  Perdeu o acesso ao aplicativo?
                </Typography>
                <Button
                  size="small"
                  onClick={() => {
                    setTotpCode("");
                    setTwoFactorState({
                      ...twoFactorState,
                      useBackupCode: true,
                    });
                  }}
                >
                  Usar código de recuperação
                </Button>
              </>
            ) : (
              <>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2.5 }}
                >
                  Digite um dos seus códigos de recuperação (formato XXXX-XXXX):
                </Typography>
                <TextField
                  size="small"
                  label="Código de recuperação"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.slice(0, 9))}
                  inputProps={{
                    style: {
                      letterSpacing: "0.1em",
                      fontWeight: 700,
                      fontSize: 16,
                      textAlign: "center",
                    },
                  }}
                  placeholder="XXXX-XXXX"
                  fullWidth
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleVerify2fa();
                  }}
                  sx={{ mb: 1 }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 2 }}
                >
                  Cada código só pode ser usado uma vez. Se não tem mais
                  códigos, procure o setor de TI.
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  disabled={!totpCode.trim() || verifyMutation.isPending}
                  onClick={handleVerify2fa}
                >
                  {verifyMutation.isPending ? "Verificando..." : "Verificar"}
                </Button>
                <Button
                  size="small"
                  startIcon={<ArrowBackRoundedIcon />}
                  onClick={() => {
                    setTotpCode("");
                    setTwoFactorState({
                      ...twoFactorState,
                      useBackupCode: false,
                    });
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
                setTotpCode("");
                setPassword("");
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
        minHeight: "100vh",
        px: 2.2,
        py: { xs: 3, md: 4.5 },
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(180deg, #f6fbff 0%, #eef6fb 100%)",
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 1080,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.2fr 1fr" },
          gap: 2.2,
        }}
      >
        <Card
          sx={{
            display: "grid",
            placeItems: "center",
            p: { xs: 3, md: 4 },
            minHeight: { xs: 270, md: 420 },
            background:
              "linear-gradient(145deg, rgba(12,101,126,0.93), rgba(8,73,91,0.95))",
            boxShadow: "0 24px 44px rgba(7, 46, 60, 0.28)",
          }}
        >
          <Box
            component="img"
            src="/logo-png.png"
            alt="CIPAVD"
            sx={{
              width: { xs: "92%", md: "85%" },
              maxWidth: 520,
              maxHeight: { xs: 280, md: 420 },
              objectFit: "contain",
              display: "block",
              mx: "auto",
              filter: "drop-shadow(0 18px 30px rgba(3, 23, 30, 0.35))",
            }}
          />
        </Card>

        <Card
          sx={{
            width: "100%",
            maxWidth: 430,
            alignSelf: "stretch",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 22px 45px rgba(9, 43, 54, 0.14)",
          }}
        >
          <CardContent
            sx={{ width: "100%", maxWidth: 390, p: { xs: 2.6, md: 3.4 } }}
          >
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Entrar
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, mb: 2.4 }}
            >
              Informe seu CPF e senha do Portal.
            </Typography>
            <Box
              component="form"
              onSubmit={handleSubmit}
              display="grid"
              gap={1.5}
            >
              <TextField
                name="login"
                label="CPF"
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(normalizeCpfInput(e.target.value))}
                inputProps={{
                  inputMode: "numeric",
                  pattern: "[0-9]*",
                  maxLength: 11,
                }}
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
              <Button
                variant="contained"
                type="submit"
                disabled={loginMutation.isPending}
                sx={{ mt: 0.6 }}
              >
                {loginMutation.isPending ? "Entrando..." : "Entrar"}
              </Button>
              <Button
                variant="text"
                onClick={() => setCpcaSelfRegistrationOpen(true)}
                sx={{ mt: 0.4 }}
              >
                Cadastro de presidente CPCA
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Dialog
        open={cpcaSelfRegistrationOpen}
        onClose={() => {
          if (cpcaSelfRegistrationMutation.isPending) return;
          setCpcaSelfRegistrationOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Solicitar cadastro como presidente CPCA</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.4 }}>
            Este fluxo é para o militar que deseja se cadastrar como presidente
            da comissão CPCA da sua OM. A solicitação ficará pendente até
            homologação pela gestão nacional.
          </Typography>
          <Stack spacing={1.2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <TextField
                size="small"
                label="E-mail ou CPF"
                value={cpcaIdentifier}
                onChange={(event) => {
                  setCpcaIdentifier(event.target.value);
                  setCpcaLookupPreview(null);
                }}
                fullWidth
              />
              <Button
                variant="outlined"
                onClick={() => {
                  void handleLookupCpcaSelfRegistrationCandidate();
                }}
                disabled={cpcaSelfRegistrationLookupMutation.isPending}
                sx={{ minHeight: 40 }}
              >
                {cpcaSelfRegistrationLookupMutation.isPending
                  ? "Buscando..."
                  : "Buscar"}
              </Button>
            </Stack>
            {cpcaLookupPreview ? (
              <>
                <Alert severity="info">
                  Militar encontrado:{" "}
                  <strong>
                    {cpcaLookupPreview.profile.name ||
                      cpcaLookupPreview.profile.uid}
                  </strong>
                  {" · "}UID/CPF: {cpcaLookupPreview.profile.uid}
                  {" · "}Email:{" "}
                  {cpcaLookupPreview.profile.email || "Não informado"}
                </Alert>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                  <TextField
                    size="small"
                    label="Posto/Graduação"
                    value={
                      cpcaLookupPreview.profile.postoGraduacao ||
                      "Não identificado"
                    }
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Nome de guerra"
                    value={
                      cpcaLookupPreview.profile.warName ||
                      cpcaLookupPreview.profile.name ||
                      "Não identificado"
                    }
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                </Stack>
              </>
            ) : null}
            <TextField
              size="small"
              label="OM"
              value={
                cpcaLookupPreview?.locality
                  ? formatOmLabel(
                      cpcaLookupPreview.locality.code,
                      cpcaLookupPreview.locality.name,
                    )
                  : ""
              }
              InputProps={{ readOnly: true }}
              fullWidth
              helperText="Preenchida automaticamente via LDAP. Não é possível alterar."
            />
            <TextField
              select
              size="small"
              label="É substituição do presidente anterior?"
              value={cpcaIsSubstitution ? "SIM" : "NAO"}
              onChange={(event) =>
                setCpcaIsSubstitution(event.target.value === "SIM")
              }
            >
              <MenuItem value="SIM">Sim</MenuItem>
              <MenuItem value="NAO">Não</MenuItem>
            </TextField>
            <TextField
              size="small"
              label="Número do boletim de designação"
              value={cpcaBulletinNumber}
              onChange={(event) => setCpcaBulletinNumber(event.target.value)}
              fullWidth
            />
            <Box
              sx={{
                border: "1px dashed",
                borderColor: cpcaBulletinFileError
                  ? "error.main"
                  : cpcaBulletinFile
                    ? "success.main"
                    : "divider",
                borderRadius: 2,
                px: 1.5,
                py: 1.4,
                bgcolor: cpcaBulletinFile
                  ? "rgba(46, 125, 50, 0.06)"
                  : "background.paper",
              }}
            >
              <Stack spacing={1.1}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                >
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Publicação do boletim
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Envie a imagem ou PDF do boletim que publicou a comissão
                      com o seu nome. Tipos aceitos: PDF, PNG e JPG. Limite de
                      10 MB.
                    </Typography>
                  </Box>
                  <Button
                    component="label"
                    variant="outlined"
                    size="small"
                    startIcon={<UploadFileRoundedIcon />}
                    disabled={cpcaBulletinFileIsValidating}
                  >
                    {cpcaBulletinFile ? "Trocar arquivo" : "Selecionar arquivo"}
                    <input
                      hidden
                      type="file"
                      accept={CPCA_PRESIDENT_BULLETIN_ACCEPT}
                      onChange={(event) => {
                        void handleCpcaBulletinFileChange(event);
                      }}
                    />
                  </Button>
                </Stack>

                {cpcaBulletinFileIsValidating ? (
                  <Alert severity="info">
                    Validando assinatura e tipo real do arquivo...
                  </Alert>
                ) : null}

                {cpcaBulletinFile ? (
                  <Alert
                    severity="success"
                    action={
                      <Button
                        size="small"
                        color="inherit"
                        startIcon={<DeleteOutlineRoundedIcon />}
                        onClick={() => {
                          setCpcaBulletinFile(null);
                          setCpcaBulletinFileValidation(null);
                          setCpcaBulletinFileError("");
                        }}
                      >
                        Remover
                      </Button>
                    }
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                    >
                      <Stack direction="row" spacing={0.8} alignItems="center">
                        {cpcaBulletinFileValidation?.kind === "pdf" ? (
                          <PictureAsPdfRoundedIcon fontSize="small" />
                        ) : (
                          <ImageRoundedIcon fontSize="small" />
                        )}
                        <Typography variant="body2" fontWeight={600}>
                          {cpcaBulletinFile.name}
                        </Typography>
                      </Stack>
                      <Chip
                        size="small"
                        label={formatCpcaPresidentBulletinFileSize(
                          cpcaBulletinFile.size,
                        )}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={
                          cpcaBulletinFileValidation?.kind === "pdf"
                            ? "PDF validado"
                            : "Imagem validada"
                        }
                        color="success"
                        variant="outlined"
                      />
                    </Stack>
                  </Alert>
                ) : null}

                {cpcaBulletinFileError ? (
                  <Alert severity="error">{cpcaBulletinFileError}</Alert>
                ) : null}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (cpcaSelfRegistrationMutation.isPending) return;
              setCpcaSelfRegistrationOpen(false);
            }}
            color="inherit"
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitCpcaSelfRegistration}
            disabled={
              cpcaSelfRegistrationMutation.isPending ||
              cpcaBulletinFileIsValidating ||
              !cpcaBulletinFile ||
              !cpcaBulletinFileValidation
            }
          >
            {cpcaSelfRegistrationMutation.isPending
              ? "Enviando..."
              : "Enviar para homologação"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
