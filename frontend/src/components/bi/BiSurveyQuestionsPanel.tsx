import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { BiSurveyQuestionItem } from "../../features/biSurveyQuestions";
import { BiCollapsibleSection } from "./BiCollapsibleSection";

type BiSurveyQuestionsPanelProps = {
  questions: BiSurveyQuestionItem[];
  accentColor?: string;
  title?: string;
  description?: string;
  defaultExpanded?: boolean;
  sx?: Record<string, unknown>;
};

export function BiSurveyQuestionsPanel({
  questions,
  accentColor = "#1E4F91",
  title = "Perguntas da pesquisa",
  description = "Lista compacta dos campos do formulário, útil para orientar a leitura dos indicadores.",
  defaultExpanded = false,
  sx,
}: BiSurveyQuestionsPanelProps) {
  const visibleQuestions = questions.filter((question) =>
    question.label.trim(),
  );
  const totalItems = visibleQuestions.length;

  return (
    <BiCollapsibleSection
      title={title}
      description={description}
      icon={<HelpOutlineRoundedIcon fontSize="small" />}
      accentColor={accentColor}
      defaultExpanded={defaultExpanded}
      summary={
        <Chip
          size="small"
          label={`${totalItems} ${totalItems === 1 ? "item" : "itens"} do formulário`}
          variant="outlined"
          sx={{
            borderColor: alpha(accentColor, 0.28),
            color: accentColor,
            bgcolor: alpha(accentColor, 0.04),
          }}
        />
      }
      sx={sx}
    >
      {totalItems === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", pt: 1.4 }}>
          As perguntas ainda não estão disponíveis para esta pesquisa.
        </Typography>
      ) : (
        <Box
          sx={{
            pt: 1.2,
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, minmax(0, 1fr))",
            },
            gap: 1,
            maxHeight: totalItems > 12 ? 380 : "none",
            overflowY: totalItems > 12 ? "auto" : "visible",
            pr: totalItems > 12 ? 0.5 : 0,
          }}
        >
          {visibleQuestions.map((question, index) => (
            <Box
              key={question.id}
              sx={{
                borderRadius: 2,
                border: "1px solid",
                borderColor: alpha(accentColor, 0.14),
                bgcolor: alpha(accentColor, 0.025),
                px: 1.25,
                py: 1,
                minHeight: 86,
              }}
            >
              <Stack
                direction="row"
                spacing={0.8}
                alignItems="center"
                flexWrap="wrap"
                sx={{ mb: 0.7 }}
              >
                <Chip
                  size="small"
                  label={question.group ?? `Item ${index + 1}`}
                  sx={{
                    height: 22,
                    borderRadius: 1.5,
                    color: accentColor,
                    bgcolor: alpha(accentColor, 0.1),
                    fontWeight: 700,
                    ".MuiChip-label": { px: 0.8 },
                  }}
                />
                {question.kind ? (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontWeight: 700,
                      lineHeight: 1.2,
                    }}
                  >
                    {question.kind}
                  </Typography>
                ) : null}
              </Stack>
              <Typography
                variant="body2"
                sx={{
                  color: "text.primary",
                  fontWeight: 650,
                  lineHeight: 1.35,
                }}
              >
                {question.label}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </BiCollapsibleSection>
  );
}
