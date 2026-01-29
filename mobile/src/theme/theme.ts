import { createTheme, alpha } from '@mui/material/styles';

// SCRAM Brand Colors - Mobile Optimized
// Primary: Dark Blue #0e314c - Profesional, confiable
// Secondary: Orange #ff9900 - Energético, acción
// Accent: Green #44ce6f - Éxito, confirmación
const scramColors = {
  primary: {
    main: '#0e314c',      // SCRAM Dark Blue
    light: '#1a4a6e',
    dark: '#091f30',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#ff9900',      // SCRAM Orange
    light: '#ffad33',
    dark: '#cc7a00',
    contrastText: '#FFFFFF',
  },
  tertiary: {
    main: '#6084a4',      // SCRAM Gray Blue
    light: '#8ba6c0',
    dark: '#4a6a86',
    contrastText: '#FFFFFF',
  },
  error: {
    main: '#dc2626',
    light: '#fecaca',
    dark: '#991b1b',
    contrastText: '#FFFFFF',
  },
  success: {
    main: '#44ce6f',      // SCRAM Green
    light: '#bbf7d0',
    dark: '#2da555',
    contrastText: '#FFFFFF',
  },
  warning: {
    main: '#f59e0b',
    light: '#fef3c7',
    dark: '#d97706',
    contrastText: '#FFFFFF',
  },
  surface: {
    main: '#FDFCFF',
    variant: '#E1E2EC',
    container: '#F3F4F9',
    containerHigh: '#EEF0F5',
    containerHighest: '#E9EAEF',
  },
  outline: {
    main: '#6084a4',
    variant: '#C3C7CF',
  },
};

// Create the mobile theme
export const mobileTheme = createTheme({
  palette: {
    mode: 'light',
    primary: scramColors.primary,
    secondary: scramColors.secondary,
    error: scramColors.error,
    success: scramColors.success,
    warning: scramColors.warning,
    background: {
      default: scramColors.surface.container,
      paper: scramColors.surface.main,
    },
    divider: scramColors.outline.variant,
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.5,
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 400,
      lineHeight: 1.4,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: scramColors.surface.container,
          WebkitTapHighlightColor: 'transparent',
        },
        // Safe area support for iOS
        ':root': {
          '--safe-area-inset-top': 'env(safe-area-inset-top)',
          '--safe-area-inset-bottom': 'env(safe-area-inset-bottom)',
          '--safe-area-inset-left': 'env(safe-area-inset-left)',
          '--safe-area-inset-right': 'env(safe-area-inset-right)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          padding: '12px 24px',
          minHeight: 48,
          fontSize: '0.9375rem',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
          '&:active': {
            boxShadow: 'none',
          },
        },
        outlined: {
          borderWidth: 1.5,
          '&:hover': {
            borderWidth: 1.5,
          },
        },
        containedSuccess: {
          backgroundColor: scramColors.success.main,
          '&:hover': {
            backgroundColor: alpha(scramColors.success.main, 0.9),
          },
        },
      },
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          padding: 10,
          borderRadius: 12,
          '&:active': {
            backgroundColor: alpha(scramColors.primary.main, 0.12),
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation0: {
          boxShadow: 'none',
        },
        elevation1: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        colorDefault: {
          backgroundColor: scramColors.surface.main,
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          paddingTop: 'var(--safe-area-inset-top)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
        standardError: {
          backgroundColor: scramColors.error.light,
          color: scramColors.error.dark,
        },
        standardSuccess: {
          backgroundColor: scramColors.success.light,
          color: scramColors.success.dark,
        },
        standardWarning: {
          backgroundColor: scramColors.warning.light,
          color: scramColors.warning.dark,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          height: 28,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 56,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: '3px 3px 0 0',
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          height: 80,
          paddingBottom: 'var(--safe-area-inset-bottom)',
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          '&:active': {
            backgroundColor: alpha(scramColors.primary.main, 0.08),
          },
        },
      },
    },
  },
});

export default mobileTheme;
