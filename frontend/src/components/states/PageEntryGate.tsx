import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState, type ReactNode } from "react";

function PageEntryLoader(props: { title: string; description?: string }) {
  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 220px)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <Card
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 4,
          border: "1px solid rgba(17, 66, 89, 0.12)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(245,249,252,0.98) 100%)",
        }}
      >
        <CardContent sx={{ px: { xs: 3, md: 4 }, py: { xs: 4, md: 4.5 } }}>
          <Stack spacing={1.5} alignItems="center" textAlign="center">
            <CircularProgress size={34} thickness={4.6} />
            <Typography variant="h6" fontWeight={800}>
              {props.title}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ maxWidth: 360 }}
            >
              {props.description ?? "Preparando o conteúdo desta tela."}
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export function PageEntryGate(props: {
  title: string;
  description?: string;
  delayMs?: number;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let timeoutId: number | null = null;
    const frameId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        setReady(true);
      }, props.delayMs ?? 180);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [props.delayMs]);

  if (!ready) {
    return (
      <PageEntryLoader title={props.title} description={props.description} />
    );
  }

  return <>{props.children}</>;
}
