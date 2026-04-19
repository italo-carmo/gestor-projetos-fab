import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { alpha } from "@mui/material/styles";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";

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
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 3,
        borderRadius: 3,
        borderColor: alpha(accentColor, 0.22),
        background: `linear-gradient(135deg, ${alpha(accentColor, 0.08)} 0%, #FFFFFF 58%)`,
        boxShadow: `0 12px 32px ${alpha(accentColor, 0.08)}`,
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.5 }, "&:last-child": { pb: { xs: 2, md: 2.5 } } }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ md: "flex-start" }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Chip
                size="small"
                label="O que esta tela responde"
                sx={{
                  mb: 1,
                  bgcolor: alpha(accentColor, 0.12),
                  color: accentColor,
                  fontWeight: 700,
                }}
              />
              <Typography variant="h6" fontWeight={800} color={accentColor}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7, lineHeight: 1.7, maxWidth: 920 }}>
                {description}
              </Typography>
            </Box>
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: alpha(accentColor, 0.1),
                color: accentColor,
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
          </Stack>

          <Stack direction={{ xs: "column", xl: "row" }} spacing={1.25} useFlexGap flexWrap="wrap">
            {questions.map((question, index) => (
              <Box
                key={question}
                sx={{
                  flex: 1,
                  minWidth: { xs: "100%", md: 220 },
                  borderRadius: 2.5,
                  border: `1px solid ${alpha(accentColor, 0.16)}`,
                  bgcolor: "rgba(255,255,255,0.8)",
                  px: 1.5,
                  py: 1.25,
                  backdropFilter: "blur(8px)",
                }}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Chip
                    size="small"
                    label={index + 1}
                    sx={{
                      mt: 0.1,
                      minWidth: 28,
                      bgcolor: accentColor,
                      color: "#fff",
                      fontWeight: 800,
                    }}
                  />
                  <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.6 }}>
                    {question}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>

          {(usageHint || action) && (
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ md: "center" }}
            >
              {usageHint ? (
                <Button
                  size="small"
                  onClick={() => setExpanded((prev) => !prev)}
                  endIcon={
                    <ExpandMoreRoundedIcon
                      sx={{
                        transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                      }}
                    />
                  }
                  sx={{ alignSelf: "flex-start", color: accentColor, fontWeight: 700 }}
                >
                  Como usar esta tela
                </Button>
              ) : (
                <Box />
              )}
              {action}
            </Stack>
          )}

          {usageHint ? (
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box
                sx={{
                  borderRadius: 2,
                  border: `1px dashed ${alpha(accentColor, 0.22)}`,
                  bgcolor: "rgba(255,255,255,0.72)",
                  px: 1.5,
                  py: 1.2,
                }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
                  {usageHint}
                </Typography>
              </Box>
            </Collapse>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
