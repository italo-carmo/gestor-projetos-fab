import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import { alpha } from "@mui/material/styles";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { buildStrategicTabGuideUiCopy } from "../../features/strategicTabGuide";

export function StrategicTabGuideCard({
  title,
  description,
  questions,
  accentColor,
  icon,
  usageHint,
  action,
}: {
  title: string;
  description: string;
  questions: string[];
  accentColor: string;
  icon: React.ReactNode;
  usageHint?: string;
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const copy = buildStrategicTabGuideUiCopy({
    title,
    description,
    questions,
    usageHint,
  });

  return (
    <>
      <Box
        sx={{
          mb: 2,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <Button
          size="small"
          variant="outlined"
          startIcon={<HelpOutlineRoundedIcon />}
          onClick={() => setOpen(true)}
          sx={{
            borderRadius: 999,
            px: 1.4,
            minHeight: 34,
            borderColor: alpha(accentColor, 0.22),
            color: accentColor,
            bgcolor: "#FFFFFF",
            fontWeight: 700,
            boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
            "&:hover": {
              borderColor: alpha(accentColor, 0.34),
              bgcolor: alpha(accentColor, 0.04),
            },
          }}
        >
          {copy.triggerLabel}
        </Button>
      </Box>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1.25 }}>
          <Stack direction="row" spacing={1.3} alignItems="flex-start">
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 1.75,
                display: "grid",
                placeItems: "center",
                bgcolor: alpha(accentColor, 0.08),
                color: accentColor,
                border: `1px solid ${alpha(accentColor, 0.14)}`,
                flexShrink: 0,
                "& svg": { fontSize: 20 },
              }}
            >
              {icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Chip
                size="small"
                label={copy.badgeLabel}
                sx={{
                  mb: 0.9,
                  height: 24,
                  bgcolor: "#F5F8FC",
                  color: accentColor,
                  fontWeight: 700,
                  fontSize: 11,
                  border: `1px solid ${alpha(accentColor, 0.18)}`,
                }}
              />
              <Typography variant="h6" fontWeight={800} color={accentColor}>
                {copy.title}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.55, lineHeight: 1.65 }}
              >
                {copy.description}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2}>
            <Box
              sx={{
                borderRadius: 2,
                border: "1px solid #E4EBF5",
                bgcolor: "#F8FAFD",
                px: 1.4,
                py: 1.3,
              }}
            >
              <Typography
                variant="subtitle2"
                fontWeight={800}
                color={accentColor}
                sx={{ mb: 1.2 }}
              >
                {copy.questionsTitle}
              </Typography>

              <Stack spacing={1}>
                {copy.questions.map((question, index) => (
                  <Stack
                    key={question}
                    direction="row"
                    spacing={1}
                    alignItems="flex-start"
                  >
                    <Chip
                      size="small"
                      label={index + 1}
                      sx={{
                        mt: 0.1,
                        minWidth: 24,
                        height: 24,
                        bgcolor: "#FFFFFF",
                        color: accentColor,
                        fontWeight: 800,
                        fontSize: 11,
                        border: `1px solid ${alpha(accentColor, 0.24)}`,
                        flexShrink: 0,
                      }}
                    />
                    <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
                      {question}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>

            {copy.hasUsageHint ? (
              <Box
                sx={{
                  borderRadius: 2,
                  border: `1px dashed ${alpha(accentColor, 0.24)}`,
                  bgcolor: "#FAFBFD",
                  px: 1.4,
                  py: 1.3,
                }}
              >
                <Typography
                  variant="subtitle2"
                  fontWeight={800}
                  color={accentColor}
                  sx={{ mb: 0.85 }}
                >
                  {copy.usageTitle}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ lineHeight: 1.7 }}
                >
                  {copy.usageHint}
                </Typography>
              </Box>
            ) : null}

            {action ? (
              <Stack
                direction="row"
                justifyContent="flex-end"
                sx={{ pt: 0.25 }}
              >
                {action}
              </Stack>
            ) : null}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
