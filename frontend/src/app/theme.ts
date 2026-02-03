import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0B4DA1',
      dark: '#083773',
      light: '#4F7BC2',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#2E7DFF',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F5F8FC',
      paper: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: ['"Montserrat"', '"Segoe UI"', 'sans-serif'].join(','),
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: '#0B4DA1',
        },
      },
    },
  },
});
