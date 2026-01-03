import { createTheme, alpha } from '@mui/material/styles';

// Material Design 3 Color Tokens - Mobile Optimized
const md3Colors = {
  primary: {
    main: '#0061A4',
    light: '#D1E4FF',
    dark: '#001D36',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#006874',
    light: '#97F0FF',
    dark: '#001F24',
    contrastText: '#FFFFFF',
  },
  tertiary: {
    main: '#BA5D07',
    light: '#FFDCC2',
    dark: '#2E1500',
    contrastText: '#FFFFFF',
  },
  error: {
    main: '#BA1A1A',
    light: '#FFDAD6',
    dark: '#410002',
    contrastText: '#FFFFFF',
  },
  success: {
    main: '#006D3B',
    light: '#9CF6B4',
    dark: '#00210F',
    contrastText: '#FFFFFF',
  },
  warning: {
    main: '#7D5800',
    light: '#FFDEA4',
    dark: '#271900',
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
    main: '#73777F',
    variant: '#C3C7CF',
  },
};

// Create the mobile theme
export const mobileTheme = createTheme({
  palette: {
    mode: 'light',
    primary: md3Colors.primary,
    secondary: md3Colors.secondary,
    error: md3Colors.error,
    success: md3Colors.success,
    warning: md3Colors.warning,
    background: {
      default: md3Colors.surface.container,
      paper: md3Colors.surface.main,
    },
    divider: md3Colors.outline.variant,
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
          backgroundColor: md3Colors.surface.container,
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
          backgroundColor: md3Colors.success.main,
          '&:hover': {
            backgroundColor: alpha(md3Colors.success.main, 0.9),
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
            backgroundColor: alpha(md3Colors.primary.main, 0.12),
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
          backgroundColor: md3Colors.surface.main,
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
          backgroundColor: md3Colors.error.light,
          color: md3Colors.error.dark,
        },
        standardSuccess: {
          backgroundColor: md3Colors.success.light,
          color: md3Colors.success.dark,
        },
        standardWarning: {
          backgroundColor: md3Colors.warning.light,
          color: md3Colors.warning.dark,
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
            backgroundColor: alpha(md3Colors.primary.main, 0.08),
          },
        },
      },
    },
  },
});

export default mobileTheme;
