import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MilitaryTechRoundedIcon from '@mui/icons-material/MilitaryTechRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSocialCommunicationHighlights, useMe } from '../../api/hooks';
import {
  loadSocialCardSettings,
  persistSocialCardSettings,
  SOCIAL_CARD_DEFAULT_SETTINGS,
  SOCIAL_CARD_EDITOR_DEFAULT_COLORS,
  SOCIAL_CARD_SETTINGS_STORAGE_KEY,
  type SocialCardId,
  type SocialCardSetting,
} from '../../app/socialCardSettingsStorage';
import {
  buildInnerTheme,
  DEFAULT_INNER_BODY_COLOR,
  DEFAULT_INNER_TITLE_COLOR,
  hexToRgba,
  type InnerCardTheme,
  PICKER_DEFAULT_INNER_BG,
} from '../../app/socialHighlightsInnerTheme';
import { hasAnyRole, ROLE_TI } from '../../app/roleAccess';
import { useToast } from '../../app/toast';
import { EmptyState } from '../states/EmptyState';
import { ErrorState } from '../states/ErrorState';
import { SkeletonState } from '../states/SkeletonState';

type SocialCommunicationHighlight = {
  id: string;
  militaryName: string;
  highlightRole?: string | null;
  photoMimeType?: string | null;
  photoBase64?: string | null;
  impact: 'MULTIPLICADOR' | 'SIMBOLICO';
  locality: { id: string; code: string; name: string };
  text: string;
  createdAt: string;
  updatedAt: string;
};

function normalizeHighlightPhotoBase64(value: unknown) {
  return String(value ?? '').replace(/\s+/g, '').trim();
}

function buildHighlightPhotoDataUrl(
  photoBase64?: string | null,
  photoMimeType?: string | null,
) {
  const normalizedBase64 = normalizeHighlightPhotoBase64(photoBase64);
  if (!normalizedBase64) return '';
  const mimeType = String(photoMimeType ?? '').trim() || 'image/jpeg';
  return `data:${mimeType};base64,${normalizedBase64}`;
}

export function MilitaryHighlightsPanel() {
  const { data: me } = useMe();
  const toast = useToast();
  const isTiProfile = hasAnyRole(me, [ROLE_TI]);
  const highlightsQuery = useSocialCommunicationHighlights({});
  const [highlightReadingTarget, setHighlightReadingTarget] =
    useState<SocialCommunicationHighlight | null>(null);
  const [socialCardSettings, setSocialCardSettings] = useState<
    Record<SocialCardId, SocialCardSetting>
  >(() => loadSocialCardSettings());

  useEffect(() => {
    const sync = () => setSocialCardSettings(loadSocialCardSettings());
    window.addEventListener('social-card-settings-changed', sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SOCIAL_CARD_SETTINGS_STORAGE_KEY) return;
      sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('social-card-settings-changed', sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const highlightsCardSetting = useMemo(
    () =>
      socialCardSettings['social-highlights'] ??
      SOCIAL_CARD_DEFAULT_SETTINGS['social-highlights'],
    [socialCardSettings],
  );

  const cardBackground = useMemo(() => {
    const custom = highlightsCardSetting.customBackgroundColor;
    if (custom) return custom;
    return '#FFFFFF';
  }, [highlightsCardSetting.customBackgroundColor]);

  const innerHighlightTheme = useMemo(
    () => buildInnerTheme(highlightsCardSetting),
    [highlightsCardSetting],
  );

  const [cardEditorOpen, setCardEditorOpen] = useState(false);
  const [innerUseSolidBackground, setInnerUseSolidBackground] = useState(false);
  const [cardEditorDraft, setCardEditorDraft] = useState({
    title: '',
    backgroundColor: '#FFFFFF',
    impactMultiplicadorTitle: '',
    impactSimbolicoTitle: '',
    innerBackground: PICKER_DEFAULT_INNER_BG,
    innerTitleColor: DEFAULT_INNER_TITLE_COLOR,
    innerBodyColor: DEFAULT_INNER_BODY_COLOR,
  });

  const openCardEditor = useCallback(() => {
    const s =
      socialCardSettings['social-highlights'] ??
      SOCIAL_CARD_DEFAULT_SETTINGS['social-highlights'];
    const solid = Boolean(s.highlightsInnerBackground?.trim());
    setInnerUseSolidBackground(solid);
    setCardEditorDraft({
      title: s.title,
      backgroundColor:
        s.customBackgroundColor ||
        SOCIAL_CARD_EDITOR_DEFAULT_COLORS['social-highlights'],
      impactMultiplicadorTitle: s.impactMultiplicadorTitle,
      impactSimbolicoTitle: s.impactSimbolicoTitle,
      innerBackground: s.highlightsInnerBackground?.trim() || PICKER_DEFAULT_INNER_BG,
      innerTitleColor: s.highlightsInnerTitleColor?.trim() || DEFAULT_INNER_TITLE_COLOR,
      innerBodyColor: s.highlightsInnerBodyColor?.trim() || DEFAULT_INNER_BODY_COLOR,
    });
    setCardEditorOpen(true);
  }, [socialCardSettings]);

  const saveCardEditor = useCallback(() => {
    const defaults = SOCIAL_CARD_DEFAULT_SETTINGS['social-highlights'];
    const full = loadSocialCardSettings();
    const prev = full['social-highlights'];
    const next = {
      ...full,
      'social-highlights': {
        ...prev,
        title: cardEditorDraft.title.trim() || defaults.title,
        customBackgroundColor: cardEditorDraft.backgroundColor.trim()
          ? cardEditorDraft.backgroundColor
          : undefined,
        impactMultiplicadorTitle:
          cardEditorDraft.impactMultiplicadorTitle.trim() ||
          defaults.impactMultiplicadorTitle,
        impactSimbolicoTitle:
          cardEditorDraft.impactSimbolicoTitle.trim() ||
          defaults.impactSimbolicoTitle,
        highlightsInnerBackground:
          innerUseSolidBackground && cardEditorDraft.innerBackground.trim()
            ? cardEditorDraft.innerBackground.trim()
            : undefined,
        highlightsInnerTitleColor: cardEditorDraft.innerTitleColor.trim()
          ? cardEditorDraft.innerTitleColor.trim()
          : undefined,
        highlightsInnerBodyColor: cardEditorDraft.innerBodyColor.trim()
          ? cardEditorDraft.innerBodyColor.trim()
          : undefined,
      },
    };
    setSocialCardSettings(next);
    persistSocialCardSettings(next);
    setCardEditorOpen(false);
    toast.push({ message: 'Card atualizado', severity: 'success' });
  }, [cardEditorDraft, innerUseSolidBackground, toast]);

  const highlightItems = useMemo(
    () =>
      [...((highlightsQuery.data?.items ?? []) as SocialCommunicationHighlight[])].sort(
        (a, b) => {
          const left = Date.parse(a.updatedAt ?? a.createdAt);
          const right = Date.parse(b.updatedAt ?? b.createdAt);
          return (Number.isNaN(right) ? 0 : right) - (Number.isNaN(left) ? 0 : left);
        },
      ),
    [highlightsQuery.data?.items],
  );

  const renderHighlightCards = (
    cards: SocialCommunicationHighlight[],
    theme: InnerCardTheme,
  ) => {
    return (
      <Box
        sx={{
          display: 'grid',
          gap: 1.35,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        {cards.map((item) => {
          const photoDataUrl = buildHighlightPhotoDataUrl(
            item.photoBase64,
            item.photoMimeType,
          );
          const initials = item.militaryName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? '')
            .join('');

          return (
            <Card
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => setHighlightReadingTarget(item)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setHighlightReadingTarget(item);
                }
              }}
              sx={{
                borderRadius: 2.8,
                border: `1px solid ${theme.cardBorder}`,
                background: theme.cardBackground,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 150ms ease, box-shadow 180ms ease',
                boxShadow: `inset 0 1px 0 ${hexToRgba('#ffffff', 0.28)}, inset 0 -1px 0 ${hexToRgba('#000000', 0.12)}, 0 8px 16px ${hexToRgba(theme.titleColor, 0.2)}`,
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `${theme.hoverShadow}, inset 0 1px 0 rgba(255,255,255,0.34), inset 0 -1px 0 rgba(0,0,0,0.14)`,
                },
              }}
            >
              <CardContent sx={{ p: 1.2 }}>
                <Stack direction="row" spacing={1.2} alignItems="stretch">
                  <Box
                    sx={{
                      width: 112,
                      minWidth: 112,
                      height: 112,
                      borderRadius: 2,
                      bgcolor: theme.mediaBg,
                      border: `1px solid ${theme.mediaBorder}`,
                      overflow: 'hidden',
                      display: 'grid',
                      placeItems: 'center',
                      color: theme.titleColor,
                      fontSize: 24,
                      fontWeight: 800,
                    }}
                  >
                    {photoDataUrl ? (
                      <Box
                        component="img"
                        src={photoDataUrl}
                        alt={item.militaryName}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      initials || <PersonRoundedIcon />
                    )}
                  </Box>

                  <Stack sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={800} sx={{ color: theme.titleColor, mb: 0.55 }}>
                      {item.militaryName}
                    </Typography>
                    <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap" sx={{ mb: 0.7 }}>
                      <Chip
                        size="small"
                        icon={<BadgeRoundedIcon />}
                        label={item.locality?.code || item.locality?.name || 'OM'}
                        sx={{ bgcolor: theme.chipBg, color: theme.chipColor, border: `1px solid ${theme.chipBorder}` }}
                      />
                      <Chip
                        size="small"
                        icon={<MilitaryTechRoundedIcon />}
                        label={item.impact === 'MULTIPLICADOR' ? 'Multiplicador' : 'Simbólico'}
                        sx={{ bgcolor: theme.chipBg, color: theme.chipColor, border: `1px solid ${theme.chipBorder}` }}
                      />
                      {item.highlightRole ? (
                        <Chip
                          size="small"
                          icon={<PersonRoundedIcon />}
                          label={item.highlightRole}
                          sx={{ bgcolor: theme.chipBg, color: theme.chipColor, border: `1px solid ${theme.chipBorder}` }}
                        />
                      ) : null}
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{
                        color: theme.textColor,
                        opacity: 0.98,
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {item.text}
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    );
  };

  return (
    <>
      <Card
        sx={{
          borderRadius: 3,
          border: '1px solid rgb(58, 122, 154)',
          boxShadow: '0 12px 24px rgba(17,66,89,0.16)',
          background: cardBackground,
        }}
      >
        <CardContent sx={{ py: 2.2 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={1}
            sx={{ mb: 1.8 }}
          >
            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#1D3A4D' }}>
                {highlightsCardSetting.title}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(29, 58, 77, 0.86)' }}>
                Destaques institucionais de Impacto Multiplicador e Simbólico.
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.8} alignItems="center">
              <Chip
                size="small"
                label={`${highlightItems.length} destaque${highlightItems.length === 1 ? '' : 's'}`}
                sx={{
                  bgcolor: 'rgba(29, 58, 77, 0.1)',
                  color: '#1D3A4D',
                  fontWeight: 700,
                  border: '1px solid rgba(29, 58, 77, 0.24)',
                }}
              />
              {isTiProfile ? (
                <Tooltip title="Editar painel e estilo dos cards de destaque">
                  <IconButton
                    size="small"
                    sx={{
                      bgcolor: 'rgba(29, 58, 77, 0.12)',
                      color: '#1D3A4D',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openCardEditor();
                    }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
          </Stack>

          {highlightsQuery.isLoading ? (
            <SkeletonState />
          ) : highlightsQuery.isError ? (
            <ErrorState error={highlightsQuery.error} onRetry={() => highlightsQuery.refetch()} />
          ) : highlightItems.length === 0 ? (
            <EmptyState title="Sem destaques" description="Nenhum destaque cadastrado." />
          ) : (
            renderHighlightCards(highlightItems, innerHighlightTheme)
          )}
        </CardContent>
      </Card>

      <Dialog
        open={cardEditorOpen}
        onClose={() => setCardEditorOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Editar card de destaques</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField
              label="Nome do card"
              value={cardEditorDraft.title}
              onChange={(event) =>
                setCardEditorDraft((prev) => ({ ...prev, title: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Nome do bloco 1"
              value={cardEditorDraft.impactMultiplicadorTitle}
              onChange={(event) =>
                setCardEditorDraft((prev) => ({
                  ...prev,
                  impactMultiplicadorTitle: event.target.value,
                }))
              }
              helperText="Ex.: Impacto Multiplicador"
              fullWidth
            />
            <TextField
              label="Nome do bloco 2"
              value={cardEditorDraft.impactSimbolicoTitle}
              onChange={(event) =>
                setCardEditorDraft((prev) => ({
                  ...prev,
                  impactSimbolicoTitle: event.target.value,
                }))
              }
              helperText="Ex.: Impacto Simbólico"
              fullWidth
            />
            <TextField
              label="Fundo do painel (externo)"
              type="color"
              value={cardEditorDraft.backgroundColor}
              onChange={(event) =>
                setCardEditorDraft((prev) => ({
                  ...prev,
                  backgroundColor: event.target.value,
                }))
              }
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={innerUseSolidBackground}
                  onChange={(_, checked) => setInnerUseSolidBackground(checked)}
                  color="primary"
                />
              }
              label="Usar cor sólida nos cards dos militares (desligado = degradê dourado padrão)"
            />
            {innerUseSolidBackground ? (
              <TextField
                label="Fundo dos cards dos militares (sólido)"
                type="color"
                value={cardEditorDraft.innerBackground}
                onChange={(event) =>
                  setCardEditorDraft((prev) => ({
                    ...prev,
                    innerBackground: event.target.value,
                  }))
                }
                fullWidth
              />
            ) : null}
            <TextField
              label="Cor do nome (título)"
              type="color"
              value={cardEditorDraft.innerTitleColor}
              onChange={(event) =>
                setCardEditorDraft((prev) => ({
                  ...prev,
                  innerTitleColor: event.target.value,
                }))
              }
              fullWidth
            />
            <TextField
              label="Cor do texto (descrição)"
              type="color"
              value={cardEditorDraft.innerBodyColor}
              onChange={(event) =>
                setCardEditorDraft((prev) => ({
                  ...prev,
                  innerBodyColor: event.target.value,
                }))
              }
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCardEditorOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveCardEditor}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(highlightReadingTarget)} onClose={() => setHighlightReadingTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Detalhes do Destaque</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <Typography variant="h6" fontWeight={700}>{highlightReadingTarget?.militaryName ?? 'Militar'}</Typography>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
              {highlightReadingTarget?.locality?.code ? <Chip size="small" icon={<BadgeRoundedIcon />} label={highlightReadingTarget.locality.code} variant="outlined" /> : null}
              {highlightReadingTarget?.highlightRole ? <Chip size="small" icon={<PersonRoundedIcon />} label={highlightReadingTarget.highlightRole} variant="outlined" /> : null}
              {highlightReadingTarget?.impact ? <Chip size="small" icon={<MilitaryTechRoundedIcon />} label={highlightReadingTarget.impact === 'MULTIPLICADOR' ? 'Multiplicador' : 'Simbólico'} /> : null}
            </Stack>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {highlightReadingTarget?.text ?? ''}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHighlightReadingTarget(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
