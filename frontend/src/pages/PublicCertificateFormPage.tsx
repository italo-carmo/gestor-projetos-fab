import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Divider,
  FormControlLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import {
  usePublicCertificateForm,
  useSubmitPublicCertificateForm,
} from "../api/hooks";
import { parseApiError } from "../app/apiErrors";
import { useToast } from "../app/toast";
import {
  CERTIFICATE_QUESTION_TYPE_LABELS,
  formatCertificateDate,
  isValidEmailInput,
  normalizeCertificateFullNameInput,
  type CertificateQuestionType,
} from "../certificates/certificateHelpers";

type PublicCertificateQuestion = {
  id: string;
  label: string;
  type: CertificateQuestionType;
  required: boolean;
  options?: string[];
};

type PublicCertificateForm = {
  id: string;
  name: string;
  location: string;
  eventDate: string;
  eventTime: string;
  description?: string | null;
  formTitle?: string | null;
  formDescription?: string | null;
  questions?: PublicCertificateQuestion[];
};

function normalizeCheckboxAnswer(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function renderAnswerValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value ?? "");
}

export function PublicCertificateFormPage() {
  const params = useParams();
  const slug = String(params.slug ?? "");
  const toast = useToast();
  const formQuery = usePublicCertificateForm(slug);
  const submitForm = useSubmitPublicCertificateForm(slug);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState<{
    fullName: string;
    email: string;
  } | null>(null);

  const form = formQuery.data as PublicCertificateForm | undefined;
  const questions = useMemo(() => form?.questions ?? [], [form?.questions]);

  const setAnswer = (questionId: string, value: unknown) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const toggleCheckboxAnswer = (questionId: string, option: string) => {
    setAnswers((current) => {
      const selected = normalizeCheckboxAnswer(current[questionId]);
      const next = selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option];
      return { ...current, [questionId]: next };
    });
  };

  const validateRequiredQuestions = () => {
    for (const question of questions) {
      if (!question.required) continue;
      const value = answers[question.id];
      if (question.type === "CHECKBOXES") {
        if (normalizeCheckboxAnswer(value).length === 0) return false;
        continue;
      }
      if (!String(value ?? "").trim()) return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    const normalizedName = normalizeCertificateFullNameInput(fullName);
    const normalizedEmail = email.trim().toLocaleLowerCase("pt-BR");
    setFullName(normalizedName);
    setEmail(normalizedEmail);

    if (!normalizedName) {
      toast.push({ message: "Informe o nome completo.", severity: "warning" });
      return;
    }
    if (!isValidEmailInput(normalizedEmail)) {
      toast.push({ message: "Informe um e-mail valido.", severity: "warning" });
      return;
    }
    if (!validateRequiredQuestions()) {
      toast.push({
        message: "Responda todas as perguntas obrigatorias.",
        severity: "warning",
      });
      return;
    }

    try {
      const result = (await submitForm.mutateAsync({
        fullName: normalizedName,
        email: normalizedEmail,
        answers,
      })) as { fullName: string; email: string };
      setSubmitted({
        fullName: result.fullName,
        email: result.email,
      });
      toast.push({ message: "Inscricao enviada.", severity: "success" });
    } catch (error) {
      toast.push({
        message: parseApiError(error).message ?? "Erro ao enviar formulario.",
        severity: "error",
      });
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#eef2f6",
        px: { xs: 2, md: 3 },
        py: { xs: 3, md: 5 },
      }}
    >
      <Box sx={{ maxWidth: 860, mx: "auto", display: "grid", gap: 2 }}>
        {formQuery.isLoading ? <LinearProgress /> : null}

        {formQuery.isError ? (
          <Alert severity="error">
            Formulario indisponivel ou ainda nao publicado.
          </Alert>
        ) : null}

        {form ? (
          <>
            <Card variant="outlined" sx={{ borderTop: "8px solid #1f6f8b" }}>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="h4" component="h1">
                    {form.formTitle || form.name}
                  </Typography>
                  {form.formDescription ? (
                    <Typography color="text.secondary">
                      {form.formDescription}
                    </Typography>
                  ) : null}
                  <Divider />
                  <Typography variant="body2" color="text.secondary">
                    {form.name} · {form.location} ·{" "}
                    {formatCertificateDate(form.eventDate)} as {form.eventTime}
                  </Typography>
                  {form.description ? (
                    <Typography variant="body2">{form.description}</Typography>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>

            {submitted ? (
              <Alert severity="success">
                Resposta registrada para {submitted.fullName}. O certificado sera
                enviado para {submitted.email} quando a organizacao disparar o
                envio.
              </Alert>
            ) : (
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2.5}>
                    <TextField
                      label="Nome completo"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      onBlur={() =>
                        setFullName(normalizeCertificateFullNameInput(fullName))
                      }
                      required
                      fullWidth
                    />
                    <TextField
                      label="E-mail"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      onBlur={() =>
                        setEmail(email.trim().toLocaleLowerCase("pt-BR"))
                      }
                      required
                      error={Boolean(email) && !isValidEmailInput(email)}
                      helperText={
                        Boolean(email) && !isValidEmailInput(email)
                          ? "Digite um e-mail valido."
                          : "Este e-mail sera usado para envio do certificado."
                      }
                      fullWidth
                    />

                    {questions.map((question) => (
                      <Box
                        key={question.id}
                        sx={{
                          borderTop: "1px solid",
                          borderColor: "divider",
                          pt: 2,
                        }}
                      >
                        <Stack spacing={1}>
                          <Typography variant="subtitle1">
                            {question.label}
                            {question.required ? " *" : ""}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {CERTIFICATE_QUESTION_TYPE_LABELS[question.type]}
                          </Typography>

                          {question.type === "TEXT" ? (
                            <TextField
                              value={renderAnswerValue(answers[question.id])}
                              onChange={(event) =>
                                setAnswer(question.id, event.target.value)
                              }
                              multiline
                              minRows={2}
                              fullWidth
                            />
                          ) : null}

                          {question.type === "MULTIPLE_CHOICE" ? (
                            <RadioGroup
                              value={renderAnswerValue(answers[question.id])}
                              onChange={(event) =>
                                setAnswer(question.id, event.target.value)
                              }
                            >
                              {(question.options ?? []).map((option) => (
                                <FormControlLabel
                                  key={option}
                                  value={option}
                                  control={<Radio />}
                                  label={option}
                                />
                              ))}
                            </RadioGroup>
                          ) : null}

                          {question.type === "CHECKBOXES" ? (
                            <Stack spacing={0.5}>
                              {(question.options ?? []).map((option) => {
                                const checked = normalizeCheckboxAnswer(
                                  answers[question.id],
                                ).includes(option);
                                return (
                                  <FormControlLabel
                                    key={option}
                                    control={
                                      <Checkbox
                                        checked={checked}
                                        onChange={() =>
                                          toggleCheckboxAnswer(question.id, option)
                                        }
                                      />
                                    }
                                    label={option}
                                  />
                                );
                              })}
                            </Stack>
                          ) : null}
                        </Stack>
                      </Box>
                    ))}

                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<SendRoundedIcon />}
                      onClick={handleSubmit}
                      disabled={submitForm.isPending}
                    >
                      Enviar resposta
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </Box>
    </Box>
  );
}
