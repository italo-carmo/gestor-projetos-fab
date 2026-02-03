import { Box, Button, MenuItem, Stack, TextField } from '@mui/material';

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
  dueFrom?: string;
  dueTo?: string;
  onDueFromChange?: (value: string) => void;
  onDueToChange?: (value: string) => void;
  localities?: { id: string; name: string }[];
  phases?: { id: string; name: string }[];
  assignees?: { id: string; name: string }[];
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
    dueFrom,
    dueTo,
    onDueFromChange,
    onDueToChange,
    localities,
    phases,
    assignees,
    onClear,
  } = props;

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
      {onSearchChange && (
        <TextField
          size="small"
          label="Busca"
          value={search ?? ''}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{ minWidth: 200 }}
          inputProps={{ 'data-testid': 'filter-q' }}
        />
      )}
      {onLocalityChange && (
        <TextField
          select
          size="small"
          label="Localidade"
          value={localityId ?? ''}
          onChange={(e) => onLocalityChange(e.target.value)}
          sx={{ minWidth: 160 }}
          SelectProps={{ inputProps: { 'data-testid': 'filter-locality' } }}
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
          value={phaseId ?? ''}
          onChange={(e) => onPhaseChange(e.target.value)}
          sx={{ minWidth: 140 }}
          SelectProps={{ inputProps: { 'data-testid': 'filter-phase' } }}
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
          value={status ?? ''}
          onChange={(e) => onStatusChange(e.target.value)}
          sx={{ minWidth: 140 }}
          SelectProps={{ inputProps: { 'data-testid': 'filter-status' } }}
        >
          <MenuItem value="">Todos</MenuItem>
          {['NOT_STARTED', 'STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE'].map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
      )}
      {onAssigneeChange && (
        <TextField
          select
          size="small"
          label="Responsavel"
          value={assigneeId ?? ''}
          onChange={(e) => onAssigneeChange(e.target.value)}
          sx={{ minWidth: 160 }}
          SelectProps={{ inputProps: { 'data-testid': 'filter-assignee' } }}
        >
          <MenuItem value="">Todos</MenuItem>
          {(assignees ?? []).map((user) => (
            <MenuItem key={user.id} value={user.id}>
              {user.name}
            </MenuItem>
          ))}
        </TextField>
      )}
      {onDueFromChange && (
        <TextField
          size="small"
          type="date"
          label="De"
          InputLabelProps={{ shrink: true }}
          value={dueFrom ?? ''}
          onChange={(e) => onDueFromChange(e.target.value)}
          inputProps={{ 'data-testid': 'filter-due-from' }}
        />
      )}
      {onDueToChange && (
        <TextField
          size="small"
          type="date"
          label="Ate"
          InputLabelProps={{ shrink: true }}
          value={dueTo ?? ''}
          onChange={(e) => onDueToChange(e.target.value)}
          inputProps={{ 'data-testid': 'filter-due-to' }}
        />
      )}
      <Box flexGrow={1} />
      {onClear && (
        <Button variant="text" onClick={onClear}>
          Limpar
        </Button>
      )}
    </Stack>
  );
}
