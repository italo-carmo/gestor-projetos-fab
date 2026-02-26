import { Box, Button, MenuItem, TextField } from "@mui/material";
import { TASK_STATUS_LABELS } from "../../constants/enums";

export type FiltersBarProps = {
  search?: string;
  onSearchChange?: (value: string) => void;
  localityId?: string;
  onLocalityChange?: (value: string) => void;
  phaseId?: string;
  onPhaseChange?: (value: string) => void;
  status?: string;
  onStatusChange?: (value: string) => void;
  assigneeId?: string;
  onAssigneeChange?: (value: string) => void;
  assigneeIds?: string[];
  onAssigneesChange?: (values: string[]) => void;
  dueFrom?: string;
  dueTo?: string;
  onDueFromChange?: (value: string) => void;
  onDueToChange?: (value: string) => void;
  eloRoleId?: string;
  onEloRoleChange?: (value: string) => void;
  localities?: { id: string; name: string }[];
  phases?: { id: string; name: string }[];
  eloRoles?: { id: string; code: string; name: string }[];
  assignees?: { id: string; name: string }[];
  desktopColumns?: number;
  onClear?: () => void;
};

export function FiltersBar(props: FiltersBarProps) {
  const {
    search,
    onSearchChange,
    localityId,
    onLocalityChange,
    phaseId,
    onPhaseChange,
    status,
    onStatusChange,
    assigneeId,
    onAssigneeChange,
    assigneeIds,
    onAssigneesChange,
    dueFrom,
    dueTo,
    onDueFromChange,
    onDueToChange,
    eloRoleId,
    onEloRoleChange,
    localities,
    phases,
    eloRoles,
    assignees,
    desktopColumns,
    onClear,
  } = props;
  const normalizedDesktopColumns = Math.max(
    3,
    Math.min(6, Number(desktopColumns ?? 4)),
  );

  const parseMultiSelectValue = (value: string | string[]) =>
    (Array.isArray(value) ? value : value.split(","))
      .map((entry) => entry.trim())
      .filter(Boolean);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          md: "repeat(3, minmax(0, 1fr))",
          lg: `repeat(${normalizedDesktopColumns}, minmax(0, 1fr))`,
        },
        gap: 2,
      }}
    >
      {onSearchChange && (
        <TextField
          size="small"
          label="Busca"
          value={search ?? ""}
          onChange={(e) => onSearchChange(e.target.value)}
          fullWidth
          inputProps={{ "data-testid": "filter-q" }}
        />
      )}
      {onLocalityChange && (
        <TextField
          select
          size="small"
          label="Localidade"
          value={localityId ?? ""}
          onChange={(e) => onLocalityChange(e.target.value)}
          fullWidth
          SelectProps={{ inputProps: { "data-testid": "filter-locality" } }}
        >
          <MenuItem value="">Todas</MenuItem>
          {(localities ?? []).map((loc) => (
            <MenuItem key={loc.id} value={loc.id}>
              {loc.name}
            </MenuItem>
          ))}
        </TextField>
      )}
      {onPhaseChange && (
        <TextField
          select
          size="small"
          label="Fase"
          value={phaseId ?? ""}
          onChange={(e) => onPhaseChange(e.target.value)}
          fullWidth
          SelectProps={{ inputProps: { "data-testid": "filter-phase" } }}
        >
          <MenuItem value="">Todas</MenuItem>
          {(phases ?? []).map((phase) => (
            <MenuItem key={phase.id} value={phase.id}>
              {phase.name}
            </MenuItem>
          ))}
        </TextField>
      )}
      {onStatusChange && (
        <TextField
          select
          size="small"
          label="Status"
          value={status ?? ""}
          onChange={(e) => onStatusChange(e.target.value)}
          fullWidth
          SelectProps={{ inputProps: { "data-testid": "filter-status" } }}
        >
          <MenuItem value="">Todos</MenuItem>
          {["NOT_STARTED", "STARTED", "IN_PROGRESS", "DONE"].map((s) => (
            <MenuItem key={s} value={s}>
              {TASK_STATUS_LABELS[s] ?? s}
            </MenuItem>
          ))}
        </TextField>
      )}
      {onEloRoleChange && (
        <TextField
          select
          size="small"
          label="Elo"
          value={eloRoleId ?? ""}
          onChange={(e) => onEloRoleChange(e.target.value)}
          fullWidth
        >
          <MenuItem value="">Todos</MenuItem>
          {(eloRoles ?? []).map((r) => (
            <MenuItem key={r.id} value={r.id}>
              {r.name}
            </MenuItem>
          ))}
        </TextField>
      )}
      {onAssigneesChange ? (
        <TextField
          select
          size="small"
          label="Responsáveis"
          value={assigneeIds ?? []}
          onChange={(e) =>
            onAssigneesChange(
              parseMultiSelectValue(e.target.value as string | string[]),
            )
          }
          fullWidth
          SelectProps={{
            multiple: true,
            renderValue: (selected) => {
              const ids = parseMultiSelectValue(selected as string | string[]);
              if (ids.length === 0) return "Todos";
              const names = (assignees ?? [])
                .filter((user) => ids.includes(user.id))
                .map((user) => user.name);
              return names.length > 0
                ? names.join(", ")
                : `${ids.length} selecionado(s)`;
            },
            inputProps: { "data-testid": "filter-assignee" },
          }}
        >
          {(assignees ?? []).map((user) => (
            <MenuItem key={user.id} value={user.id}>
              {user.name}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        onAssigneeChange && (
          <TextField
            select
            size="small"
            label="Responsável"
            value={assigneeId ?? ""}
            onChange={(e) => onAssigneeChange(e.target.value)}
            fullWidth
            SelectProps={{ inputProps: { "data-testid": "filter-assignee" } }}
          >
            <MenuItem value="">Todos</MenuItem>
            {(assignees ?? []).map((user) => (
              <MenuItem key={user.id} value={user.id}>
                {user.name}
              </MenuItem>
            ))}
          </TextField>
        )
      )}
      {onDueFromChange && (
        <TextField
          size="small"
          type="date"
          label="De"
          InputLabelProps={{ shrink: true }}
          value={dueFrom ?? ""}
          onChange={(e) => onDueFromChange(e.target.value)}
          fullWidth
          inputProps={{ "data-testid": "filter-due-from" }}
        />
      )}
      {onDueToChange && (
        <TextField
          size="small"
          type="date"
          label="Até"
          InputLabelProps={{ shrink: true }}
          value={dueTo ?? ""}
          onChange={(e) => onDueToChange(e.target.value)}
          fullWidth
          inputProps={{ "data-testid": "filter-due-to" }}
        />
      )}
      {onClear && (
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Button variant="text" onClick={onClear}>
            Limpar
          </Button>
        </Box>
      )}
    </Box>
  );
}
