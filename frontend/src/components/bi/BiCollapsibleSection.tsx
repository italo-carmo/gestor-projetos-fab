import { useState, type ReactNode } from "react";
import {
  Box,
  Card,
  Chip,
  Collapse,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { alpha } from "@mui/material/styles";

type BiCollapsibleSectionProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  summary?: ReactNode;
  headerActions?: ReactNode;
  accentColor?: string;
  defaultExpanded?: boolean;
  sx?: Record<string, unknown>;
  children: ReactNode;
};

export function BiCollapsibleSection({
  title,
  description,
  icon,
  summary,
  headerActions,
  accentColor = "#1E4F91",
  defaultExpanded = false,
  sx,
  children,
}: BiCollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card
      sx={{
        borderRadius: 3.5,
        border: "1px solid",
        borderColor: alpha(accentColor, 0.16),
        boxShadow: "0 18px 42px rgba(15, 23, 42, 0.08)",
        ...sx,
      }}
    >
      <Box
        onClick={() => setExpanded((current) => !current)}
        sx={{
          px: 2,
          py: 1.8,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          alignItems={{ xs: "flex-start", lg: "center" }}
          justifyContent="space-between"
          gap={1.4}
        >
          <Stack direction="row" spacing={1.2} alignItems="flex-start">
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2.5,
                display: "grid",
                placeItems: "center",
                color: accentColor,
                bgcolor: alpha(accentColor, 0.1),
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>
                {title}
              </Typography>
              {description ? (
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mt: 0.25 }}
                >
                  {description}
                </Typography>
              ) : null}
            </Box>
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ width: { xs: "100%", lg: "auto" } }}
          >
            {summary ? (
              <Box sx={{ ml: { xs: 0, lg: "auto" } }}>{summary}</Box>
            ) : (
              <Chip
                size="small"
                variant="outlined"
                label={expanded ? "Expandido" : "Recolhido"}
                sx={{
                  borderColor: alpha(accentColor, 0.25),
                  color: accentColor,
                  bgcolor: alpha(accentColor, 0.04),
                }}
              />
            )}
            {headerActions ? (
              <Box onClick={(event) => event.stopPropagation()}>
                {headerActions}
              </Box>
            ) : null}
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((current) => !current);
              }}
              sx={{
                color: accentColor,
                border: "1px solid",
                borderColor: alpha(accentColor, 0.2),
                bgcolor: alpha(accentColor, 0.04),
              }}
            >
              <ExpandMoreRoundedIcon
                sx={{
                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 180ms ease",
                }}
              />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      <Collapse in={expanded} timeout="auto">
        <Box
          sx={{
            px: 2,
            pb: 2,
            pt: 0,
            borderTop: "1px solid",
            borderColor: alpha(accentColor, 0.12),
          }}
        >
          {children}
        </Box>
      </Collapse>
    </Card>
  );
}
