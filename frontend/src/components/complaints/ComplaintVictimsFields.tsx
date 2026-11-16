import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Radio,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import {
  createComplaintVictim,
  removeComplaintVictim,
  type ComplaintVictimForm,
} from "../../features/complaintVictims";

type Option = { value: string; label: string };
type Props = {
  victims: ComplaintVictimForm[];
  onChange: (victims: ComplaintVictimForm[]) => void;
  notifierIsVictim: boolean;
  rankOptions: Option[];
  genderOptions: Option[];
  ageOptions: Option[];
  frequencyOptions: Option[];
  relationOptions: Option[];
  occurrenceOptions: Option[];
};

export function ComplaintVictimsFields({
  victims,
  onChange,
  notifierIsVictim,
  rankOptions,
  genderOptions,
  ageOptions,
  frequencyOptions,
  relationOptions,
  occurrenceOptions,
}: Props) {
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const change = (id: string, patch: Partial<ComplaintVictimForm>) =>
    onChange(
      victims.map((victim) =>
        victim.id === id ? { ...victim, ...patch } : victim,
      ),
    );
  const select = (
    victim: ComplaintVictimForm,
    field: Exclude<
      keyof ComplaintVictimForm,
      "id" | "isNotifier" | "occurrenceForms"
    >,
    label: string,
    options: Option[],
    required = false,
  ) => {
    const value = victim[field];
    const available =
      value && !options.some((option) => option.value === value)
        ? [...options, { value, label: value }]
        : options;
    return (
      <TextField
        select
        fullWidth
        size="small"
        label={label}
        value={value}
        required={required}
        error={required && !value.trim()}
        helperText={
          required && !value.trim()
            ? "Informe o posto/graduação desta vítima."
            : undefined
        }
        autoFocus={field === "victimRank" && victim.id === lastAddedId}
        onChange={(event) => change(victim.id, { [field]: event.target.value })}
        slotProps={{
          select: { MenuProps: { PaperProps: { sx: { maxHeight: 320 } } } },
        }}
      >
        {!required && field !== "victimGender" && (
          <MenuItem value="">Selecionar</MenuItem>
        )}
        {available.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
    );
  };

  return (
    <Stack spacing={2} sx={{ gridColumn: "1 / -1", mt: 1.75 }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
      >
        <Typography variant="subtitle2" fontWeight={700}>
          Vítimas do reporte
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          label={`${victims.length} ${victims.length === 1 ? "vítima" : "vítimas"}`}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Registre o perfil e as características da ocorrência de cada vítima
        separadamente.
        {notifierIsVictim ? " Indique também qual delas é a noticiante." : ""}
      </Typography>
      {victims.map((victim, index) => (
        <Box
          key={victim.id}
          component="section"
          aria-label={`Vítima ${index + 1}`}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2.5,
            overflow: "hidden",
            bgcolor: "background.paper",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            sx={{ p: 1.5, bgcolor: "rgba(26,60,110,0.04)" }}
          >
            <Typography variant="subtitle2" fontWeight={800}>
              Vítima {index + 1}
            </Typography>
            {victims.length > 1 && (
              <Button
                size="small"
                color="error"
                startIcon={<DeleteOutlineRoundedIcon />}
                aria-label={`Remover vítima ${index + 1}`}
                onClick={() =>
                  onChange(removeComplaintVictim(victims, victim.id))
                }
              >
                Remover
              </Button>
            )}
          </Stack>
          <Stack spacing={1.5} sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Dados da vítima
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1.5,
              }}
            >
              {select(
                victim,
                "victimRank",
                "Posto/grad. vítima",
                rankOptions,
                true,
              )}
              {select(victim, "victimGender", "Sexo da vítima", genderOptions)}
              {select(
                victim,
                "victimAgeRange",
                "Faixa etária da vítima",
                ageOptions,
              )}
            </Box>
            {notifierIsVictim && (
              <FormControlLabel
                label="Esta vítima é a noticiante"
                control={
                  <Radio
                    name="notifierVictim"
                    checked={
                      victim.isNotifier ||
                      (!victims.some((row) => row.isNotifier) && index === 0)
                    }
                    onChange={() =>
                      onChange(
                        victims.map((row) => ({
                          ...row,
                          isNotifier: row.id === victim.id,
                        })),
                      )
                    }
                  />
                }
              />
            )}
            <Divider />
            <Typography variant="subtitle2" fontWeight={700}>
              Dados complementares da ocorrência
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1.5,
              }}
            >
              {select(
                victim,
                "incidentFrequency",
                "Frequência dos fatos",
                frequencyOptions,
              )}
              {select(
                victim,
                "hierarchicalFunctionalRelation",
                "Relação hierárquica/funcional",
                relationOptions,
              )}
              <TextField
                select
                fullWidth
                size="small"
                label="Forma de ocorrência"
                value={victim.occurrenceForms}
                slotProps={{
                  inputLabel: { shrink: true },
                  select: {
                    multiple: true,
                    displayEmpty: true,
                    MenuProps: { PaperProps: { sx: { maxHeight: 360 } } },
                    renderValue: (selected) =>
                      (selected as string[])
                        .map(
                          (value) =>
                            occurrenceOptions.find(
                              (option) => option.value === value,
                            )?.label ?? value,
                        )
                        .join(", ") || "Selecionar",
                  },
                }}
                onChange={(event) =>
                  change(victim.id, {
                    occurrenceForms: Array.isArray(event.target.value)
                      ? event.target.value.map(String)
                      : String(event.target.value).split(","),
                  })
                }
                sx={{ gridColumn: "1 / -1" }}
              >
                {occurrenceOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Checkbox
                      size="small"
                      checked={victim.occurrenceForms.includes(option.value)}
                      sx={{ p: 0, mr: 1 }}
                    />
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Stack>
        </Box>
      ))}
      <Button
        variant="outlined"
        startIcon={<AddRoundedIcon />}
        sx={{ alignSelf: "flex-start" }}
        onClick={() => {
          const victim = createComplaintVictim();
          setLastAddedId(victim.id);
          onChange([...victims, victim]);
        }}
      >
        Adicionar mais vítimas
      </Button>
    </Stack>
  );
}
