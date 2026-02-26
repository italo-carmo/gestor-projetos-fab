import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useAddCpcaCaseComment,
  useCpcaCase,
  useCpcaCases,
  useCreateCpcaCase,
  useLocalities,
  useMe,
  usePostos,
  useUpdateCpcaCase,
} from '../api/hooks';
import { parseApiError } from '../app/apiErrors';
import { hasAnyRole, ROLE_COMANDANTE_COMGEP, ROLE_COORDENACAO_CIPAVD, ROLE_CPCA } from '../app/roleAccess';
import { useToast } from '../app/toast';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { SkeletonState } from '../components/states/SkeletonState';

const STATUS_OPTIONS = [
  { value: 'RECEIVED', label: 'Recebida' },
  { value: 'PROTECTION_MEASURES', label: 'Acolhimento e proteção' },
  { value: 'PRELIMINARY_ANALYSIS', label: 'Análise preliminar' },
  { value: 'PROCEDURE_DEFINED', label: 'Procedimento instaurado' },
  { value: 'INVESTIGATION', label: 'Em apuração' },
  { value: 'CONCLUDED', label: 'Concluída' },
  { value: 'ARCHIVED', label: 'Arquivada' },
];

const COMPLAINT_TYPE_OPTIONS = [
  { value: 'MORAL', label: 'Assédio moral' },
  { value: 'SEXUAL', label: 'Assédio sexual' },
];

const NOTIFIER_TYPE_OPTIONS = [
  { value: 'VITIMA', label: 'Vítima' },
  { value: 'TESTEMUNHA', label: 'Testemunha' },
  { value: 'TERCEIRO', label: 'Terceiro' },
];

const PROCEDURE_OPTIONS = [
  { value: 'NOT_DEFINED', label: 'Não definido' },
  { value: 'PATD', label: 'PATD' },
  { value: 'SINDICANCIA', label: 'Sindicância' },
  { value: 'PAD', label: 'PAD' },
  { value: 'IPM', label: 'IPM' },
];

const GENDER_OPTIONS = [
  { value: 'MASCULINO', label: 'Masculino' },
  { value: 'FEMININO', label: 'Feminino' },
  { value: 'NAO_INFORMADO', label: 'Não informado' },
];

const defaultForm = {
  localityId: '',
  complaintType: 'MORAL',
  notifierType: 'VITIMA',
  status: 'RECEIVED',
  procedureType: 'NOT_DEFINED',
  incidentDate: '',
  aggressorRank: '',
  aggressorGender: 'NAO_INFORMADO',
  victimRank: '',
  victimGender: 'NAO_INFORMADO',
  evidenceCount: 0,
  evidenceSummary: '',
  confidentialityTermSigned: false,
  confidentialityHandlingNotes: '',
  cpcaMembersExcludedFromInquiry: true,
  immediateProtectionMeasures: '',
  privateSupportActions: '',
  psychologicalSupportProvided: false,
  medicalSupportProvided: false,
  socialSupportProvided: false,
  legalSupportProvided: false,
  contactRestrictionApplied: false,
  preliminaryAnalysis: '',
  preliminaryReportGenerated: false,
  preliminaryReportDate: '',
  procedureReference: '',
  procedureNotes: '',
  womenLedHandlingPrioritized: false,
  victimAccusedSeparationEvaluated: false,
  victimAccusedSeparationApplied: false,
  accusedDefenseEnsured: false,
  outcomeSummary: '',
  notifierFeedbackSummary: '',
  victimFeedbackSummary: '',
  notifierFeedbackDate: '',
  victimFeedbackDate: '',
  retaliationRisk: false,
  retaliationNotes: '',
  outsourcedAccused: false,
  contractorReferralDate: '',
  contractorFollowUpNotes: '',
  statusChangeNote: '',
};

function toNullable(value: string) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

export function CpcaCasesPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data: me, isLoading: meLoading } = useMe();

  const canAccessByRole = hasAnyRole(me, [ROLE_CPCA, ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP]);

  const q = params.get('q') ?? '';
  const localityId = params.get('localityId') ?? '';
  const status = params.get('status') ?? '';
  const complaintType = params.get('complaintType') ?? '';
  const procedureType = params.get('procedureType') ?? '';

  const filters = useMemo(
    () => ({
      q: q || undefined,
      localityId: localityId || undefined,
      status: status || undefined,
      complaintType: complaintType || undefined,
      procedureType: procedureType || undefined,
    }),
    [q, localityId, status, complaintType, procedureType],
  );

  const casesQuery = useCpcaCases(filters, canAccessByRole);
  const localitiesQuery = useLocalities(canAccessByRole);
  const postosQuery = usePostos();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [newComment, setNewComment] = useState('');

  const selectedCaseQuery = useCpcaCase(selectedId, canAccessByRole && drawerOpen && Boolean(selectedId));
  const createCase = useCreateCpcaCase();
  const updateCase = useUpdateCpcaCase();
  const addComment = useAddCpcaCaseComment();

  const isNationalScope = hasAnyRole(me, [ROLE_COORDENACAO_CIPAVD, ROLE_COMANDANTE_COMGEP]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const clearFilters = () => setParams({}, { replace: true });

  const items = casesQuery.data?.items ?? [];
  const localities = localitiesQuery.data?.items ?? [];
  const rankOptions: string[] = (postosQuery.data?.items ?? []).map((item: any) => String(item.name));

  useEffect(() => {
    if (!isCreateMode || !drawerOpen) return;
    setForm((prev) => ({
      ...prev,
      localityId: isNationalScope ? prev.localityId : String(me?.localityId ?? ''),
    }));
  }, [drawerOpen, isCreateMode, isNationalScope, me?.localityId]);

  useEffect(() => {
    if (!selectedCaseQuery.data || isCreateMode) return;
    const item = selectedCaseQuery.data;
    setForm({
      localityId: item.localityId ?? '',
      complaintType: item.complaintType ?? 'MORAL',
      notifierType: item.notifierType ?? 'VITIMA',
      status: item.status ?? 'RECEIVED',
      procedureType: item.procedureType ?? 'NOT_DEFINED',
      incidentDate: item.incidentDate ? String(item.incidentDate).slice(0, 10) : '',
      aggressorRank: item.aggressorRank ?? '',
      aggressorGender: item.aggressorGender ?? 'NAO_INFORMADO',
      victimRank: item.victimRank ?? '',
      victimGender: item.victimGender ?? 'NAO_INFORMADO',
      evidenceCount: Number(item.evidenceCount ?? 0),
      evidenceSummary: item.evidenceSummary ?? '',
      confidentialityTermSigned: Boolean(item.confidentialityTermSigned),
      confidentialityHandlingNotes: item.confidentialityHandlingNotes ?? '',
      cpcaMembersExcludedFromInquiry: Boolean(item.cpcaMembersExcludedFromInquiry ?? true),
      immediateProtectionMeasures: item.immediateProtectionMeasures ?? '',
      privateSupportActions: item.privateSupportActions ?? '',
      psychologicalSupportProvided: Boolean(item.psychologicalSupportProvided),
      medicalSupportProvided: Boolean(item.medicalSupportProvided),
      socialSupportProvided: Boolean(item.socialSupportProvided),
      legalSupportProvided: Boolean(item.legalSupportProvided),
      contactRestrictionApplied: Boolean(item.contactRestrictionApplied),
      preliminaryAnalysis: item.preliminaryAnalysis ?? '',
      preliminaryReportGenerated: Boolean(item.preliminaryReportGenerated),
      preliminaryReportDate: item.preliminaryReportDate ? String(item.preliminaryReportDate).slice(0, 10) : '',
      procedureReference: item.procedureReference ?? '',
      procedureNotes: item.procedureNotes ?? '',
      womenLedHandlingPrioritized: Boolean(item.womenLedHandlingPrioritized),
      victimAccusedSeparationEvaluated: Boolean(item.victimAccusedSeparationEvaluated),
      victimAccusedSeparationApplied: Boolean(item.victimAccusedSeparationApplied),
      accusedDefenseEnsured: Boolean(item.accusedDefenseEnsured),
      outcomeSummary: item.outcomeSummary ?? '',
      notifierFeedbackSummary: item.notifierFeedbackSummary ?? '',
      victimFeedbackSummary: item.victimFeedbackSummary ?? '',
      notifierFeedbackDate: item.notifierFeedbackDate ? String(item.notifierFeedbackDate).slice(0, 10) : '',
      victimFeedbackDate: item.victimFeedbackDate ? String(item.victimFeedbackDate).slice(0, 10) : '',
      retaliationRisk: Boolean(item.retaliationRisk),
      retaliationNotes: item.retaliationNotes ?? '',
      outsourcedAccused: Boolean(item.outsourcedAccused),
      contractorReferralDate: item.contractorReferralDate ? String(item.contractorReferralDate).slice(0, 10) : '',
      contractorFollowUpNotes: item.contractorFollowUpNotes ?? '',
      statusChangeNote: '',
    });
  }, [isCreateMode, selectedCaseQuery.data]);

  if (meLoading) return <SkeletonState />;
  if (!canAccessByRole) {
    return <ErrorState error={{ message: 'Acesso negado ao fluxo CPCA.' }} />;
  }
  if (casesQuery.isLoading) return <SkeletonState />;
  if (casesQuery.isError) {
    return <ErrorState error={casesQuery.error} onRetry={() => casesQuery.refetch()} />;
  }

  const openCreate = () => {
    setIsCreateMode(true);
    setSelectedId('');
    setForm({
      ...defaultForm,
      localityId: isNationalScope ? '' : String(me?.localityId ?? ''),
    });
    setNewComment('');
    setDrawerOpen(true);
  };

  const openDetails = (id: string) => {
    setIsCreateMode(false);
    setSelectedId(id);
    setNewComment('');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedId('');
    setIsCreateMode(false);
    setForm(defaultForm);
    setNewComment('');
  };

  const saveCase = async () => {
    if (!form.aggressorRank || !form.victimRank) {
      toast.push({ message: 'Informe posto/graduação do assediador e assediado.', severity: 'warning' });
      return;
    }

    const payload: Record<string, any> = {
      localityId: form.localityId || undefined,
      complaintType: form.complaintType,
      notifierType: form.notifierType,
      status: form.status,
      procedureType: form.procedureType,
      incidentDate: toNullable(form.incidentDate),
      aggressorRank: form.aggressorRank,
      aggressorGender: form.aggressorGender,
      victimRank: form.victimRank,
      victimGender: form.victimGender,
      evidenceCount: Number(form.evidenceCount ?? 0),
      evidenceSummary: toNullable(form.evidenceSummary),
      confidentialityTermSigned: Boolean(form.confidentialityTermSigned),
      confidentialityHandlingNotes: toNullable(form.confidentialityHandlingNotes),
      cpcaMembersExcludedFromInquiry: Boolean(form.cpcaMembersExcludedFromInquiry),
      immediateProtectionMeasures: toNullable(form.immediateProtectionMeasures),
      privateSupportActions: toNullable(form.privateSupportActions),
      psychologicalSupportProvided: Boolean(form.psychologicalSupportProvided),
      medicalSupportProvided: Boolean(form.medicalSupportProvided),
      socialSupportProvided: Boolean(form.socialSupportProvided),
      legalSupportProvided: Boolean(form.legalSupportProvided),
      contactRestrictionApplied: Boolean(form.contactRestrictionApplied),
      preliminaryAnalysis: toNullable(form.preliminaryAnalysis),
      preliminaryReportGenerated: Boolean(form.preliminaryReportGenerated),
      preliminaryReportDate: toNullable(form.preliminaryReportDate),
      procedureReference: toNullable(form.procedureReference),
      procedureNotes: toNullable(form.procedureNotes),
      womenLedHandlingPrioritized: Boolean(form.womenLedHandlingPrioritized),
      victimAccusedSeparationEvaluated: Boolean(form.victimAccusedSeparationEvaluated),
      victimAccusedSeparationApplied: Boolean(form.victimAccusedSeparationApplied),
      accusedDefenseEnsured: Boolean(form.accusedDefenseEnsured),
      outcomeSummary: toNullable(form.outcomeSummary),
      notifierFeedbackSummary: toNullable(form.notifierFeedbackSummary),
      victimFeedbackSummary: toNullable(form.victimFeedbackSummary),
      notifierFeedbackDate: toNullable(form.notifierFeedbackDate),
      victimFeedbackDate: toNullable(form.victimFeedbackDate),
      retaliationRisk: Boolean(form.retaliationRisk),
      retaliationNotes: toNullable(form.retaliationNotes),
      outsourcedAccused: Boolean(form.outsourcedAccused),
      contractorReferralDate: toNullable(form.contractorReferralDate),
      contractorFollowUpNotes: toNullable(form.contractorFollowUpNotes),
      statusChangeNote: toNullable(form.statusChangeNote),
    };

    try {
      if (isCreateMode) {
        const created = await createCase.mutateAsync(payload);
        toast.push({ message: `Caso ${created.caseNumber} criado.`, severity: 'success' });
        setIsCreateMode(false);
        setSelectedId(created.id);
      } else if (selectedId) {
        await updateCase.mutateAsync({ id: selectedId, payload });
        toast.push({ message: 'Caso atualizado com sucesso.', severity: 'success' });
      }
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao salvar caso CPCA.', severity: 'error' });
    }
  };

  const saveComment = async () => {
    if (!selectedId || !newComment.trim()) return;
    try {
      await addComment.mutateAsync({ id: selectedId, text: newComment.trim() });
      setNewComment('');
      toast.push({ message: 'Comentário registrado.', severity: 'success' });
    } catch (error) {
      toast.push({ message: parseApiError(error).message ?? 'Erro ao registrar comentário.', severity: 'error' });
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} mb={2} gap={1.2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>CPCA - Denúncias</Typography>
          <Typography variant="body2" color="text.secondary">
            Fluxo sigiloso conforme ICA 30-13 (arts. 47 a 57), sem identificação nominal de assediador/assediado.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>Nova notificação</Button>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} flexWrap="wrap">
            <TextField size="small" label="Número do caso" value={q} onChange={(e) => updateParam('q', e.target.value)} sx={{ minWidth: 200 }} />
            {isNationalScope && (
              <TextField
                select
                size="small"
                label="Localidade"
                value={localityId}
                onChange={(e) => updateParam('localityId', e.target.value)}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">Todas</MenuItem>
                {localities.map((loc: any) => (
                  <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>
                ))}
              </TextField>
            )}
            <TextField select size="small" label="Tipo" value={complaintType} onChange={(e) => updateParam('complaintType', e.target.value)} sx={{ minWidth: 170 }}>
              <MenuItem value="">Todos</MenuItem>
              {COMPLAINT_TYPE_OPTIONS.map((item) => (
                <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
              ))}
            </TextField>
            <TextField select size="small" label="Status" value={status} onChange={(e) => updateParam('status', e.target.value)} sx={{ minWidth: 200 }}>
              <MenuItem value="">Todos</MenuItem>
              {STATUS_OPTIONS.map((item) => (
                <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
              ))}
            </TextField>
            <TextField select size="small" label="Procedimento" value={procedureType} onChange={(e) => updateParam('procedureType', e.target.value)} sx={{ minWidth: 180 }}>
              <MenuItem value="">Todos</MenuItem>
              {PROCEDURE_OPTIONS.map((item) => (
                <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
              ))}
            </TextField>
            <Button variant="text" onClick={clearFilters}>Limpar</Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState title="Nenhuma notificação" description="Registre a primeira ocorrência da CPCA para iniciar o acompanhamento." />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Caso</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>OM</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Tipo</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Procedimento</TableCell>
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Recebimento</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item: any) => (
                  <TableRow
                    key={item.id}
                    hover
                    role="button"
                    tabIndex={0}
                    onClick={() => openDetails(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openDetails(item.id);
                      }
                    }}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography fontWeight={700}>{item.caseNumber}</Typography>
                      {item.lastCommentAt && (
                        <Typography variant="caption" color="text.secondary">
                          Último comentário: {new Date(item.lastCommentAt).toLocaleString('pt-BR')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{item.locality?.name ?? '-'}</TableCell>
                    <TableCell>{COMPLAINT_TYPE_OPTIONS.find((entry) => entry.value === item.complaintType)?.label ?? item.complaintType}</TableCell>
                    <TableCell>
                      <Chip size="small" label={STATUS_OPTIONS.find((entry) => entry.value === item.status)?.label ?? item.status} />
                    </TableCell>
                    <TableCell>{PROCEDURE_OPTIONS.find((entry) => entry.value === item.procedureType)?.label ?? item.procedureType}</TableCell>
                    <TableCell>{item.reportedAt ? new Date(item.reportedAt).toLocaleDateString('pt-BR') : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Drawer anchor="right" open={drawerOpen} onClose={closeDrawer} PaperProps={{ sx: { width: { xs: '100%', md: 860 } } }}>
        <Box p={3} sx={{ height: '100%', overflowY: 'auto' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6" fontWeight={700}>
              {isCreateMode ? 'Nova notificação CPCA' : `Caso ${selectedCaseQuery.data?.caseNumber ?? ''}`}
            </Typography>
            <Button variant="text" onClick={closeDrawer}>Fechar</Button>
          </Stack>

          <Alert severity="warning" sx={{ mb: 2 }}>
            Registrar apenas dados genéricos (sem nomes). Acesso restrito a CPCA, Coordenação CIPAVD e COMGEP.
          </Alert>

          {!isCreateMode && selectedCaseQuery.isLoading && <SkeletonState />}
          {!isCreateMode && selectedCaseQuery.isError && (
            <ErrorState error={selectedCaseQuery.error} onRetry={() => selectedCaseQuery.refetch()} />
          )}

          {(isCreateMode || selectedCaseQuery.data) && (
            <Stack spacing={2}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} mb={1}>Notificação e identificação genérica</Typography>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <TextField
                      select
                      size="small"
                      label="Localidade"
                      value={form.localityId}
                      onChange={(e) => setForm((prev) => ({ ...prev, localityId: e.target.value }))}
                      sx={{ minWidth: 240 }}
                      disabled={!isNationalScope}
                    >
                      {isNationalScope && <MenuItem value="">Selecionar</MenuItem>}
                      {localities.map((loc: any) => (
                        <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>
                      ))}
                    </TextField>
                    <TextField select size="small" label="Tipo" value={form.complaintType} onChange={(e) => setForm((prev) => ({ ...prev, complaintType: e.target.value }))} sx={{ minWidth: 220 }}>
                      {COMPLAINT_TYPE_OPTIONS.map((item) => (
                        <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
                      ))}
                    </TextField>
                    <TextField select size="small" label="Noticiante" value={form.notifierType} onChange={(e) => setForm((prev) => ({ ...prev, notifierType: e.target.value }))} sx={{ minWidth: 200 }}>
                      {NOTIFIER_TYPE_OPTIONS.map((item) => (
                        <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
                      ))}
                    </TextField>
                    <TextField size="small" type="date" label="Data do fato" InputLabelProps={{ shrink: true }} value={form.incidentDate} onChange={(e) => setForm((prev) => ({ ...prev, incidentDate: e.target.value }))} sx={{ minWidth: 180 }} />
                  </Stack>

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} mt={1}>
                    <TextField select size="small" label="Posto/grad. assediador" value={form.aggressorRank} onChange={(e) => setForm((prev) => ({ ...prev, aggressorRank: e.target.value }))} sx={{ minWidth: 260 }}>
                      {rankOptions.map((rank: string) => (
                        <MenuItem key={rank} value={rank}>{rank}</MenuItem>
                      ))}
                    </TextField>
                    <TextField select size="small" label="Sexo assediador" value={form.aggressorGender} onChange={(e) => setForm((prev) => ({ ...prev, aggressorGender: e.target.value }))} sx={{ minWidth: 200 }}>
                      {GENDER_OPTIONS.map((item) => (
                        <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
                      ))}
                    </TextField>
                    <TextField select size="small" label="Posto/grad. assediado" value={form.victimRank} onChange={(e) => setForm((prev) => ({ ...prev, victimRank: e.target.value }))} sx={{ minWidth: 260 }}>
                      {rankOptions.map((rank: string) => (
                        <MenuItem key={rank} value={rank}>{rank}</MenuItem>
                      ))}
                    </TextField>
                    <TextField select size="small" label="Sexo assediado" value={form.victimGender} onChange={(e) => setForm((prev) => ({ ...prev, victimGender: e.target.value }))} sx={{ minWidth: 200 }}>
                      {GENDER_OPTIONS.map((item) => (
                        <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
                      ))}
                    </TextField>
                  </Stack>

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} mt={1}>
                    <TextField size="small" type="number" label="Qtd. evidências" value={form.evidenceCount} onChange={(e) => setForm((prev) => ({ ...prev, evidenceCount: Number(e.target.value) || 0 }))} sx={{ minWidth: 180 }} inputProps={{ min: 0 }} />
                    <TextField size="small" label="Resumo de evidências" value={form.evidenceSummary} onChange={(e) => setForm((prev) => ({ ...prev, evidenceSummary: e.target.value }))} fullWidth />
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} mb={1}>Acolhimento, suporte e medidas imediatas (Arts. 48-50)</Typography>
                  <TextField
                    size="small"
                    label="Medidas imediatas de proteção"
                    value={form.immediateProtectionMeasures}
                    onChange={(e) => setForm((prev) => ({ ...prev, immediateProtectionMeasures: e.target.value }))}
                    fullWidth
                    multiline
                    minRows={2}
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    size="small"
                    label="Ações de acolhimento (escuta, privacidade, evitar revitimização)"
                    value={form.privateSupportActions}
                    onChange={(e) => setForm((prev) => ({ ...prev, privateSupportActions: e.target.value }))}
                    fullWidth
                    multiline
                    minRows={2}
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    size="small"
                    label="Controle de sigilo e acesso mínimo (Art. 46 e 47 §4)"
                    value={form.confidentialityHandlingNotes}
                    onChange={(e) => setForm((prev) => ({ ...prev, confidentialityHandlingNotes: e.target.value }))}
                    fullWidth
                    multiline
                    minRows={2}
                    sx={{ mb: 1 }}
                  />
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <FormControlLabel control={<Switch checked={form.psychologicalSupportProvided} onChange={(e) => setForm((prev) => ({ ...prev, psychologicalSupportProvided: e.target.checked }))} />} label="Suporte psicológico" />
                    <FormControlLabel control={<Switch checked={form.medicalSupportProvided} onChange={(e) => setForm((prev) => ({ ...prev, medicalSupportProvided: e.target.checked }))} />} label="Suporte médico" />
                    <FormControlLabel control={<Switch checked={form.socialSupportProvided} onChange={(e) => setForm((prev) => ({ ...prev, socialSupportProvided: e.target.checked }))} />} label="Assistência social" />
                    <FormControlLabel control={<Switch checked={form.legalSupportProvided} onChange={(e) => setForm((prev) => ({ ...prev, legalSupportProvided: e.target.checked }))} />} label="Assistência jurídica" />
                    <FormControlLabel control={<Switch checked={form.contactRestrictionApplied} onChange={(e) => setForm((prev) => ({ ...prev, contactRestrictionApplied: e.target.checked }))} />} label="Restrição de contato" />
                    <FormControlLabel control={<Switch checked={form.confidentialityTermSigned} onChange={(e) => setForm((prev) => ({ ...prev, confidentialityTermSigned: e.target.checked }))} />} label="Termo de sigilo" />
                    <FormControlLabel control={<Switch checked={form.cpcaMembersExcludedFromInquiry} onChange={(e) => setForm((prev) => ({ ...prev, cpcaMembersExcludedFromInquiry: e.target.checked }))} />} label="CPCA fora da comissão apuratória" />
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} mb={1}>Triagem, apuração e retorno (Arts. 51-57)</Typography>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <TextField select size="small" label="Status" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} sx={{ minWidth: 240 }}>
                      {STATUS_OPTIONS.map((item) => (
                        <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
                      ))}
                    </TextField>
                    <TextField select size="small" label="Procedimento" value={form.procedureType} onChange={(e) => setForm((prev) => ({ ...prev, procedureType: e.target.value }))} sx={{ minWidth: 220 }}>
                      {PROCEDURE_OPTIONS.map((item) => (
                        <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
                      ))}
                    </TextField>
                    <TextField size="small" label="Referência do processo" value={form.procedureReference} onChange={(e) => setForm((prev) => ({ ...prev, procedureReference: e.target.value }))} fullWidth />
                  </Stack>

                  <TextField size="small" label="Análise preliminar" value={form.preliminaryAnalysis} onChange={(e) => setForm((prev) => ({ ...prev, preliminaryAnalysis: e.target.value }))} fullWidth multiline minRows={2} sx={{ mt: 1 }} />
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} mt={1}>
                    <FormControlLabel control={<Switch checked={form.preliminaryReportGenerated} onChange={(e) => setForm((prev) => ({ ...prev, preliminaryReportGenerated: e.target.checked }))} />} label="Relatório preliminar gerado (§1º Art. 51)" />
                    <TextField size="small" type="date" label="Data do relatório preliminar" InputLabelProps={{ shrink: true }} value={form.preliminaryReportDate} onChange={(e) => setForm((prev) => ({ ...prev, preliminaryReportDate: e.target.value }))} sx={{ minWidth: 240 }} />
                  </Stack>
                  <TextField size="small" label="Notas do procedimento" value={form.procedureNotes} onChange={(e) => setForm((prev) => ({ ...prev, procedureNotes: e.target.value }))} fullWidth multiline minRows={2} sx={{ mt: 1 }} />
                  <TextField size="small" label="Síntese do resultado" value={form.outcomeSummary} onChange={(e) => setForm((prev) => ({ ...prev, outcomeSummary: e.target.value }))} fullWidth multiline minRows={2} sx={{ mt: 1 }} />

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} mt={1}>
                    <TextField size="small" type="date" label="Retorno ao noticiante" InputLabelProps={{ shrink: true }} value={form.notifierFeedbackDate} onChange={(e) => setForm((prev) => ({ ...prev, notifierFeedbackDate: e.target.value }))} sx={{ minWidth: 220 }} />
                    <TextField size="small" type="date" label="Retorno à vítima" InputLabelProps={{ shrink: true }} value={form.victimFeedbackDate} onChange={(e) => setForm((prev) => ({ ...prev, victimFeedbackDate: e.target.value }))} sx={{ minWidth: 220 }} />
                    <FormControlLabel control={<Switch checked={form.accusedDefenseEnsured} onChange={(e) => setForm((prev) => ({ ...prev, accusedDefenseEnsured: e.target.checked }))} />} label="Ampla defesa/contraditório assegurados" />
                  </Stack>
                  <TextField size="small" label="Devolutiva ao noticiante (ações/prazos/solução)" value={form.notifierFeedbackSummary} onChange={(e) => setForm((prev) => ({ ...prev, notifierFeedbackSummary: e.target.value }))} fullWidth multiline minRows={2} sx={{ mt: 1 }} />
                  <TextField size="small" label="Comunicação à vítima sobre resultados e ações" value={form.victimFeedbackSummary} onChange={(e) => setForm((prev) => ({ ...prev, victimFeedbackSummary: e.target.value }))} fullWidth multiline minRows={2} sx={{ mt: 1 }} />

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} mt={1}>
                    <FormControlLabel control={<Switch checked={form.womenLedHandlingPrioritized} onChange={(e) => setForm((prev) => ({ ...prev, womenLedHandlingPrioritized: e.target.checked }))} />} label="Condução priorizada por mulher (quando cabível)" />
                    <FormControlLabel control={<Switch checked={form.victimAccusedSeparationEvaluated} onChange={(e) => setForm((prev) => ({ ...prev, victimAccusedSeparationEvaluated: e.target.checked }))} />} label="Separação vítima/acusado avaliada" />
                    <FormControlLabel control={<Switch checked={form.victimAccusedSeparationApplied} onChange={(e) => setForm((prev) => ({ ...prev, victimAccusedSeparationApplied: e.target.checked }))} />} label="Separação vítima/acusado aplicada" />
                  </Stack>

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} mt={1}>
                    <FormControlLabel control={<Switch checked={form.retaliationRisk} onChange={(e) => setForm((prev) => ({ ...prev, retaliationRisk: e.target.checked }))} />} label="Sinal de retaliação" />
                    <TextField size="small" label="Observações sobre retaliação" value={form.retaliationNotes} onChange={(e) => setForm((prev) => ({ ...prev, retaliationNotes: e.target.value }))} fullWidth />
                  </Stack>

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} mt={1}>
                    <FormControlLabel control={<Switch checked={form.outsourcedAccused} onChange={(e) => setForm((prev) => ({ ...prev, outsourcedAccused: e.target.checked }))} />} label="Acusado terceirizado (Art. 57)" />
                    <TextField size="small" type="date" label="Encaminhamento à contratante" InputLabelProps={{ shrink: true }} value={form.contractorReferralDate} onChange={(e) => setForm((prev) => ({ ...prev, contractorReferralDate: e.target.value }))} sx={{ minWidth: 220 }} />
                  </Stack>
                  <TextField size="small" label="Acompanhamento do trâmite com contratante" value={form.contractorFollowUpNotes} onChange={(e) => setForm((prev) => ({ ...prev, contractorFollowUpNotes: e.target.value }))} fullWidth multiline minRows={2} sx={{ mt: 1 }} />

                  {!isCreateMode && (
                    <TextField size="small" label="Justificativa da mudança de status/procedimento" value={form.statusChangeNote} onChange={(e) => setForm((prev) => ({ ...prev, statusChangeNote: e.target.value }))} fullWidth sx={{ mt: 1 }} />
                  )}
                </CardContent>
              </Card>

              <Box display="flex" justifyContent="flex-end">
                <Button variant="contained" onClick={saveCase} disabled={createCase.isPending || updateCase.isPending}>
                  {isCreateMode ? 'Criar notificação' : 'Salvar alterações'}
                </Button>
              </Box>

              {!isCreateMode && selectedCaseQuery.data && (
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} mb={1}>Histórico de status e procedimento</Typography>
                    {(selectedCaseQuery.data.statusHistory ?? []).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">Sem mudanças registradas.</Typography>
                    ) : (
                      <Stack spacing={1}>
                        {(selectedCaseQuery.data.statusHistory ?? []).map((entry: any) => (
                          <Box key={entry.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                            <Typography variant="body2">
                              {STATUS_OPTIONS.find((item) => item.value === entry.fromStatus)?.label ?? entry.fromStatus ?? 'Inicial'}
                              {' -> '}
                              {STATUS_OPTIONS.find((item) => item.value === entry.toStatus)?.label ?? entry.toStatus}
                              {' | '}
                              {PROCEDURE_OPTIONS.find((item) => item.value === entry.fromProcedure)?.label ?? entry.fromProcedure ?? 'Inicial'}
                              {' -> '}
                              {PROCEDURE_OPTIONS.find((item) => item.value === entry.toProcedure)?.label ?? entry.toProcedure}
                            </Typography>
                            {entry.note && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                                {entry.note}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              {entry.changedBy?.name ?? 'Usuário'} • {new Date(entry.changedAt).toLocaleString('pt-BR')}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              )}

              {!isCreateMode && selectedCaseQuery.data && (
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} mb={1}>Comentários do processo</Typography>
                    {(selectedCaseQuery.data.comments ?? []).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">Nenhum comentário registrado.</Typography>
                    ) : (
                      <Stack spacing={1} sx={{ mb: 1.5 }}>
                        {(selectedCaseQuery.data.comments ?? []).map((comment: any) => (
                          <Box key={comment.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{comment.text}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {comment.createdBy?.name ?? 'Usuário'} • {new Date(comment.createdAt).toLocaleString('pt-BR')}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    )}
                    <Divider sx={{ mb: 1 }} />
                    <TextField size="small" label="Novo comentário" value={newComment} onChange={(e) => setNewComment(e.target.value)} fullWidth multiline minRows={2} />
                    <Box display="flex" justifyContent="flex-end" mt={1}>
                      <Button variant="outlined" onClick={saveComment} disabled={!newComment.trim() || addComment.isPending}>Adicionar comentário</Button>
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Stack>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
