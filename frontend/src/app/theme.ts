import { alpha, createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0C657E',
      light: '#3C91A8',
      dark: '#08495B',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#C56A2B',
      light: '#D98A56',
      dark: '#9F4F1C',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F2F6F8',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#132C38',
      secondary: '#466474',
    },
    divider: alpha('#114259', 0.14),
  },
  typography: {
    fontFamily: ['"Sora"', '"Manrope"', '"Segoe UI"', 'sans-serif'].join(','),
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontWeight: 700, letterSpacing: '-0.015em' },
    h4: { fontWeight: 700, letterSpacing: '-0.01em' },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  },
  shape: {
    borderRadius: 14,
  },
  shadows: [
    'none',
    '0 8px 24px rgba(15, 39, 58, 0.06)',
    '0 10px 28px rgba(15, 39, 58, 0.08)',
    '0 12px 32px rgba(15, 39, 58, 0.1)',
    '0 14px 36px rgba(15, 39, 58, 0.12)',
    '0 16px 40px rgba(15, 39, 58, 0.14)',
    '0 18px 44px rgba(15, 39, 58, 0.16)',
    '0 20px 48px rgba(15, 39, 58, 0.18)',
    '0 22px 52px rgba(15, 39, 58, 0.2)',
    '0 24px 56px rgba(15, 39, 58, 0.22)',
    '0 26px 60px rgba(15, 39, 58, 0.24)',
    '0 28px 64px rgba(15, 39, 58, 0.26)',
    '0 30px 68px rgba(15, 39, 58, 0.28)',
    '0 32px 72px rgba(15, 39, 58, 0.3)',
    '0 34px 76px rgba(15, 39, 58, 0.32)',
    '0 36px 80px rgba(15, 39, 58, 0.34)',
    '0 38px 84px rgba(15, 39, 58, 0.36)',
    '0 40px 88px rgba(15, 39, 58, 0.38)',
    '0 42px 92px rgba(15, 39, 58, 0.4)',
    '0 44px 96px rgba(15, 39, 58, 0.42)',
    '0 46px 100px rgba(15, 39, 58, 0.44)',
    '0 48px 104px rgba(15, 39, 58, 0.46)',
    '0 50px 108px rgba(15, 39, 58, 0.48)',
    '0 52px 112px rgba(15, 39, 58, 0.5)',
    '0 54px 116px rgba(15, 39, 58, 0.52)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          colorScheme: 'light',
        },
        '::selection': {
          backgroundColor: alpha('#0C657E', 0.18),
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: alpha('#FFFFFF', 0.84),
          backdropFilter: 'blur(14px)',
          borderBottom: `1px solid ${alpha('#114259', 0.14)}`,
          boxShadow: 'none',
          color: '#132C38',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: `1px solid ${alpha('#114259', 0.14)}`,
          background:
            'linear-gradient(170deg, rgba(255,255,255,0.98) 0%, rgba(238,246,250,0.95) 55%, rgba(231,241,246,0.95) 100%)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: `1px solid ${alpha('#114259', 0.1)}`,
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${alpha('#114259', 0.1)}`,
          backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))',
          boxShadow: '0 12px 30px rgba(8, 37, 55, 0.08)',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
          paddingInline: 16,
          minHeight: 38,
        },
        contained: {
          color: '#FFFFFF',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #0C657E 0%, #0A5471 100%)',
          color: '#FFFFFF',
          boxShadow: '0 10px 24px rgba(8, 77, 99, 0.24)',
          ':hover': {
            background: 'linear-gradient(135deg, #0A5A72 0%, #08475F 100%)',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: alpha('#FFFFFF', 0.75),
          ':hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#0C657E', 0.45),
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: 1.5,
          },
        },
        notchedOutline: {
          borderColor: alpha('#114259', 0.22),
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          marginInline: 8,
          marginBlock: 2,
          ':hover': {
            backgroundColor: alpha('#0C657E', 0.08),
          },
          '&.Mui-selected': {
            background: `linear-gradient(135deg, ${alpha('#0C657E', 0.17)}, ${alpha('#3C91A8', 0.15)})`,
            border: `1px solid ${alpha('#0C657E', 0.24)}`,
          },
          '&.Mui-selected:hover': {
            background: `linear-gradient(135deg, ${alpha('#0C657E', 0.2)}, ${alpha('#3C91A8', 0.18)})`,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 600,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 999,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            fontWeight: 700,
            color: alpha('#FFFFFF', 0.96),
            backgroundColor: '#17394B',
            borderBottomColor: alpha('#FFFFFF', 0.14),
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 10,
          backgroundColor: alpha('#133341', 0.95),
        },
      },
    },
  },
});
