import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import { api } from "../api/client";
import { parseApiError } from "../app/apiErrors";

function resolveManualAssetApiPath(src: string) {
  const rawSrc = String(src ?? "").trim();
  if (!rawSrc || rawSrc.startsWith("data:") || rawSrc.startsWith("blob:")) {
    return null;
  }

  const url = new URL(rawSrc, window.location.origin);
  if (url.origin !== window.location.origin) return null;

  if (url.pathname.startsWith("/api/manuals/cipavd/prints/")) {
    return url.pathname.replace(/^\/api/, "") + url.search;
  }
  if (url.pathname.startsWith("/manuals/cipavd/prints/")) {
    return url.pathname + url.search;
  }
  if (url.pathname.startsWith("/prints/")) {
    return `/manuals/cipavd${url.pathname}${url.search}`;
  }

  return null;
}

function revokeObjectUrls(urls: string[]) {
  urls.forEach((url) => URL.revokeObjectURL(url));
}

export function ManualCipavdPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const [manualHtml, setManualHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeOpen, setNoticeOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadManual() {
      setLoading(true);
      setErrorMessage("");
      revokeObjectUrls(objectUrlsRef.current);
      objectUrlsRef.current = [];

      try {
        const htmlResponse = await api.get<string>("/manuals/cipavd", {
          responseType: "text",
          transformResponse: [(data) => data],
        });
        const parser = new DOMParser();
        const doc = parser.parseFromString(
          String(htmlResponse.data ?? ""),
          "text/html",
        );
        const images = Array.from(doc.querySelectorAll("img"));
        const generatedObjectUrls: string[] = [];

        await Promise.all(
          images.map(async (image) => {
            const apiPath = resolveManualAssetApiPath(
              image.getAttribute("src") ?? "",
            );
            if (!apiPath) return;
            const imageResponse = await api.get<Blob>(apiPath, {
              responseType: "blob",
            });
            const objectUrl = URL.createObjectURL(imageResponse.data);
            generatedObjectUrls.push(objectUrl);
            image.setAttribute("src", objectUrl);
          }),
        );

        if (cancelled) {
          revokeObjectUrls(generatedObjectUrls);
          return;
        }

        objectUrlsRef.current = generatedObjectUrls;
        setManualHtml(`<!doctype html>${doc.documentElement.outerHTML}`);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            parseApiError(error).message ??
              "Não foi possível carregar o manual CIPAVD.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadManual();

    return () => {
      cancelled = true;
      revokeObjectUrls(objectUrlsRef.current);
      objectUrlsRef.current = [];
    };
  }, []);

  const handlePrint = () => {
    const contentWindow = iframeRef.current?.contentWindow;
    if (!contentWindow) return;
    contentWindow.focus();
    contentWindow.print();
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Dialog
        open={noticeOpen}
        disableEscapeKeyDown
        onClose={(_, reason) => {
          if (reason === "backdropClick") return;
          setNoticeOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            color: "#B91C1C",
            fontWeight: 800,
          }}
        >
          <LockOutlinedIcon />
          Documento Restrito
        </DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Este manual contém informações de caráter restrito. O acesso é
            pessoal, vinculado ao seu perfil autorizado, e é responsabilidade do
            usuário não compartilhar, reproduzir ou encaminhar o arquivo, seus
            prints ou seu conteúdo para pessoas não autorizadas.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.4 }}>
          <Button variant="contained" onClick={() => setNoticeOpen(false)}>
            Estou ciente
          </Button>
        </DialogActions>
      </Dialog>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.4}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="overline" sx={{ color: "#B91C1C" }}>
            Documento Restrito
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Manual do Usuário CIPAVD
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Consulta protegida para TI, COMGEP e Coordenação CIPAVD.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<PrintRoundedIcon />}
          onClick={handlePrint}
          disabled={!manualHtml || loading}
        >
          Imprimir / salvar PDF
        </Button>
      </Stack>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Paper
        variant="outlined"
        sx={{
          height: { xs: "calc(100vh - 270px)", md: "calc(100vh - 210px)" },
          minHeight: 520,
          overflow: "hidden",
          bgcolor: "background.paper",
        }}
      >
        {loading ? (
          <Box
            sx={{
              height: "100%",
              display: "grid",
              placeItems: "center",
              color: "text.secondary",
            }}
          >
            <Stack spacing={1.2} alignItems="center">
              <CircularProgress size={30} />
              <Typography variant="body2">Carregando manual...</Typography>
            </Stack>
          </Box>
        ) : manualHtml ? (
          <iframe
            ref={iframeRef}
            title="Manual do Usuário CIPAVD"
            srcDoc={manualHtml}
            style={{
              width: "100%",
              height: "100%",
              border: 0,
              display: "block",
              background: "#ffffff",
            }}
          />
        ) : (
          <Box
            sx={{
              height: "100%",
              display: "grid",
              placeItems: "center",
              color: "text.secondary",
              px: 2,
              textAlign: "center",
            }}
          >
            <Typography variant="body2">
              O manual não está disponível no momento.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
