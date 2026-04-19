import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export function AiCopilotCtaRow({
  title = 'Levar este recorte para a IA',
  subtitle,
  explainHref,
  briefingHref,
  actionHref,
  compact = false,
}: {
  title?: string;
  subtitle?: string;
  explainHref: string;
  briefingHref: string;
  actionHref?: string | null;
  compact?: boolean;
}) {
  return (
    <Box
      sx={{
        p: compact ? 1.2 : 1.5,
        borderRadius: compact ? 2 : 2.5,
        border: '1px solid rgba(26,60,110,0.12)',
        bgcolor: '#F8FAFC',
      }}
    >
      <Typography variant={compact ? 'body2' : 'subtitle2'} fontWeight={800} color="#1A3C6E">
        {title}
      </Typography>
      {subtitle ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.4, lineHeight: 1.6, fontSize: compact ? '0.8rem' : undefined }}
        >
          {subtitle}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: compact ? 1 : 1.25 }}>
        <Button
          component={RouterLink}
          to={explainHref}
          size="small"
          variant="outlined"
          startIcon={<AutoAwesomeRoundedIcon />}
        >
          Explicar na IA
        </Button>
        <Button
          component={RouterLink}
          to={briefingHref}
          size="small"
          variant="outlined"
          startIcon={<CampaignRoundedIcon />}
        >
          Gerar briefing
        </Button>
        {actionHref ? (
          <Button
            component={RouterLink}
            to={actionHref}
            size="small"
            variant="contained"
            startIcon={<RocketLaunchRoundedIcon />}
            sx={{ bgcolor: '#1A3C6E', '&:hover': { bgcolor: '#122B4E' } }}
          >
            Transformar em ação
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}
