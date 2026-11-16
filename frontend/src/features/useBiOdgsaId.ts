import { useSearchParams } from "react-router-dom";

export function useBiOdgsaId() {
  const [params] = useSearchParams();
  return params.get("odgsaId")?.trim() || undefined;
}
