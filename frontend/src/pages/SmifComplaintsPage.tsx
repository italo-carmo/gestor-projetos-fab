import { Navigate, useLocation } from "react-router-dom";

export function SmifComplaintsPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("scope", "SMIF");

  return (
    <Navigate
      to={{
        pathname: "/cpca-cases",
        search: `?${params.toString()}`,
        hash: location.hash,
      }}
      replace
    />
  );
}
