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
        borderColor: "#DDE5F0",
        borderLeft: `4px solid ${accentColor}`,
        bgcolor: "#FFFFFF",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
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
                  bgcolor: "#F5F8FC",
                  color: accentColor,
                  fontWeight: 700,
                  border: `1px solid ${alpha(accentColor, 0.18)}`,
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
                bgcolor: "#F5F8FC",
                color: accentColor,
                flexShrink: 0,
                border: `1px solid ${alpha(accentColor, 0.14)}`,
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
                  border: "1px solid #E4EBF5",
                  bgcolor: "#F8FAFD",
                  px: 1.5,
                  py: 1.25,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Chip
                    size="small"
                    label={index + 1}
                    sx={{
                      mt: 0.1,
                      minWidth: 28,
                      bgcolor: "#FFFFFF",
                      color: accentColor,
                      fontWeight: 800,
                      border: `1px solid ${alpha(accentColor, 0.24)}`,
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
                  sx={{
                    alignSelf: "flex-start",
                    color: accentColor,
                    fontWeight: 700,
                    px: 0.25,
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
