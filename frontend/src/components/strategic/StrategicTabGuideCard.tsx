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
        mb: 2,
        borderRadius: 2.5,
        borderColor: "#DDE5F0",
        borderLeft: `4px solid ${accentColor}`,
        bgcolor: "#FFFFFF",
        boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)",
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, md: 1.75 }, "&:last-child": { pb: { xs: 1.5, md: 1.75 } } }}>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.25}
            justifyContent="space-between"
            alignItems={{ md: "center" }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Chip
                size="small"
                label="O que esta tela responde"
                sx={{
                  mb: 0.75,
                  height: 24,
                  bgcolor: "#F5F8FC",
                  color: accentColor,
                  fontWeight: 700,
                  fontSize: 11,
                  border: `1px solid ${alpha(accentColor, 0.18)}`,
                }}
              />
              <Typography variant="subtitle1" fontWeight={800} color={accentColor}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.45, lineHeight: 1.6, maxWidth: 920 }}>
                {description}
              </Typography>
            </Box>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                display: "grid",
                placeItems: "center",
                bgcolor: "#F5F8FC",
                color: accentColor,
                flexShrink: 0,
                border: `1px solid ${alpha(accentColor, 0.14)}`,
                "& svg": { fontSize: 20 },
              }}
            >
              {icon}
            </Box>
          </Stack>

          <Stack direction={{ xs: "column", xl: "row" }} spacing={1} useFlexGap flexWrap="wrap">
            {questions.map((question, index) => (
              <Box
                key={question}
                sx={{
                  flex: 1,
                  minWidth: { xs: "100%", md: 220 },
                  borderRadius: 2,
                  border: "1px solid #E4EBF5",
                  bgcolor: "#F8FAFD",
                  px: 1.2,
                  py: 1,
                }}
              >
                <Stack direction="row" spacing={0.8} alignItems="flex-start">
                  <Chip
                    size="small"
                    label={index + 1}
                    sx={{
                      mt: 0.05,
                      minWidth: 24,
                      height: 24,
                      bgcolor: "#FFFFFF",
                      color: accentColor,
                      fontWeight: 800,
                      fontSize: 11,
                      border: `1px solid ${alpha(accentColor, 0.24)}`,
                    }}
                  />
                  <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.45 }}>
                    {question}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>

          {(usageHint || action) && (
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={0.75}
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
                  sx={{
                    alignSelf: "flex-start",
                    color: accentColor,
                    fontWeight: 700,
                    px: 0.25,
                    minHeight: 28,
                    "&:hover": {
                      bgcolor: "transparent",
                      color: accentColor,
                    },
                  }}
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
                  border: `1px dashed ${alpha(accentColor, 0.2)}`,
                  bgcolor: "#FAFBFD",
                  px: 1.2,
                  py: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
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
