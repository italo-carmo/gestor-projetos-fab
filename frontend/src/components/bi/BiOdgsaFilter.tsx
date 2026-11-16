import {
  Alert,
  Autocomplete,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";
import { useBiOdgsaOptions } from "../../api/hooks";

export function BiOdgsaFilter({ activeTab }: { activeTab: string }) {
  const [params, setParams] = useSearchParams();
  const query = useBiOdgsaOptions();
  const id = params.get("odgsaId")?.trim() || "";
  const options = query.data ?? [];
  const selected =
    options.find((option) => option.id === id) ??
    (id ? { id, code: "ODGSA selecionado", name: "" } : null);

  return (
    <Stack spacing={1}>
      <Autocomplete
        disabled={activeTab === "recruits"}
        options={options}
        value={selected}
        loading={query.isLoading}
        loadingText="Carregando ODGSA..."
        clearText="Limpar ODGSA"
        openText="Abrir ODGSA"
        closeText="Fechar ODGSA"
        noOptionsText="Nenhum ODGSA encontrado"
        getOptionLabel={(option) =>
          option.name ? `${option.code} — ${option.name}` : option.code
        }
        isOptionEqualToValue={(option, value) => option.id === value.id}
        onChange={(_event, value) => {
          const next = new URLSearchParams(window.location.search);
          if (value) next.set("odgsaId", value.id);
          else next.delete("odgsaId");
          next.delete("responseId");
          setParams(next);
        }}
        renderInput={(input) => (
          <TextField
            {...input}
            size="small"
            label="ODGSA"
            placeholder="Todos os ODGSA"
          />
        )}
        sx={{ maxWidth: 680 }}
      />
      <Typography variant="caption" color="text.secondary">
        {activeTab === "recruits"
          ? "ODGSA não se aplica à pesquisa de Recrutas, pois as respostas não identificam a OM."
          : id
          ? "Exibindo somente respostas com OM identificada e vinculada ao ODGSA selecionado. O filtro acompanha as abas e exportações."
          : "Selecione um ODGSA para consultar as respostas das OMs vinculadas a ele."}
      </Typography>
      {query.isError ? (
        <Alert severity="error">
          Não foi possível carregar os ODGSA. Atualize a página para tentar
          novamente.
        </Alert>
      ) : null}
      {id && activeTab === "recruits" ? (
        <Alert severity="info">
          A pesquisa de Recrutas não identifica a OM das respostas. Nesta aba,
          o ODGSA selecionado não é aplicado. A seleção permanece nas demais abas.
        </Alert>
      ) : null}
    </Stack>
  );
}
