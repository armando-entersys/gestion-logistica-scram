'use client';

import { createTheme, ThemeOptions } from '@mui/material/styles';

// SCRAM Brand Colors - Identidad Visual Corporativa
// Primary: Dark Blue #0e314c - Profesional, confiable
// Secondary: Orange #ff9900 - Energético, acción
// Accent: Green #44ce6f - Éxito, confirmación
// Typography: Cabin (Headers) + Asap (Body)

const scramTokens = {
  light: {
    primary: {
      main: '#0e314c',      // SCRAM Dark Blue - profesional
      light: '#1a4a6e',
      dark: '#091f30',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#ff9900',      // SCRAM Orange - energético
      light: '#ffad33',
      dark: '#cc7a00',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#dc2626',      // Clear red for errors
      light: '#f87171',
      dark: '#b91c1c',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#44ce6f',      // SCRAM Green
      light: '#6dd98d',
      dark: '#2da555',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#ea580c',      // Distinct warning orange
      light: '#fb923c',
      dark: '#c2410c',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#6084a4',      // SCRAM Gray Blue
      light: '#8ba6c0',
      dark: '#4a6a86',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#f8fafc',   // Very subtle cool gray
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0f172a',   // Near black - high contrast
      secondary: '#64748b', // Balanced gray
    },
    divider: '#e2e8f0',     // Soft border
  },
  dark: {
    primary: {
      main: '#1a4a6e',      // SCRAM Dark Blue lighter for dark mode
      light: '#2d6a94',
      dark: '#0e314c',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#ffad33',      // SCRAM Orange lighter for dark mode
      light: '#ffc266',
      dark: '#ff9900',
      contrastText: '#0e314c',
    },
    error: {
      main: '#f87171',
      light: '#fca5a5',
      dark: '#dc2626',
      contrastText: '#0f172a',
    },
    success: {
      main: '#6dd98d',      // SCRAM Green lighter
      light: '#96e5ab',
      dark: '#44ce6f',
      contrastText: '#0f172a',
    },
    warning: {
      main: '#fb923c',
      light: '#fdba74',
      dark: '#ea580c',
      contrastText: '#0f172a',
    },
    info: {
      main: '#8ba6c0',      // SCRAM Gray Blue lighter
      light: '#a8bfd3',
      dark: '#6084a4',
      contrastText: '#0f172a',
    },
    background: {
      default: '#091f30',   // Very dark SCRAM blue
      paper: '#0e314c',     // SCRAM Dark Blue
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
    },
    divider: '#1a4a6e',
  },
};

const getDesignTokens = (mode: 'light' | 'dark'): ThemeOptions => {
  const tokens = scramTokens[mode];

  return {
    palette: {
      mode,
      primary: tokens.primary,
      secondary: tokens.secondary,
      error: tokens.error,
      success: tokens.success,
      warning: tokens.warning,
      info: tokens.info,
      background: tokens.background,
      text: tokens.text,
      divider: tokens.divider,
    },
    typography: {
      // Cabin for headers, Asap for body (SCRAM brand fonts)
      fontFamily: '"Asap", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontFamily: '"Cabin", "Roboto", "Helvetica", "Arial", sans-serif',
        fontSize: '42px',       // font-size-5xl
        fontWeight: 700,        // font-weight-bold
        lineHeight: 1.2,        // line-height-tight
        color: tokens.text.primary,
      },
      h2: {
        fontFamily: '"Cabin", "Roboto", "Helvetica", "Arial", sans-serif',
        fontSize: '32px',       // font-size-4xl
        fontWeight: 700,
        lineHeight: 1.2,
        color: tokens.text.primary,
      },
      h3: {
        fontFamily: '"Cabin", "Roboto", "Helvetica", "Arial", sans-serif',
        fontSize: '28px',       // font-size-3xl
        fontWeight: 500,        // font-weight-medium
        lineHeight: 1.2,
        color: tokens.text.primary,
      },
      h4: {
        fontFamily: '"Cabin", "Roboto", "Helvetica", "Arial", sans-serif',
        fontSize: '24px',       // font-size-2xl
        fontWeight: 500,
        lineHeight: 1.33,
        color: tokens.text.primary,
      },
      h5: {
        fontFamily: '"Cabin", "Roboto", "Helvetica", "Arial", sans-serif',
        fontSize: '20px',       // font-size-lg
        fontWeight: 500,
        lineHeight: 1.5,
        color: tokens.text.primary,
      },
      h6: {
        fontFamily: '"Cabin", "Roboto", "Helvetica", "Arial", sans-serif',
        fontSize: '18px',       // font-size-md
        fontWeight: 500,
        lineHeight: 1.43,
        color: tokens.text.primary,
      },
      subtitle1: {
        fontSize: '16px',       // font-size-base
        fontWeight: 500,
        lineHeight: 1.5,
        color: tokens.text.primary,
      },
      subtitle2: {
        fontSize: '14px',       // font-size-sm
        fontWeight: 500,
        lineHeight: 1.43,
        color: tokens.text.secondary,
      },
      body1: {
        fontSize: '16px',       // font-size-base
        fontWeight: 400,        // font-weight-normal
        lineHeight: 1.8,        // line-height-relaxed
        color: tokens.text.secondary,
      },
      body2: {
        fontSize: '14px',       // font-size-sm
        fontWeight: 400,
        lineHeight: 1.5,
        color: tokens.text.secondary,
      },
      button: {
        fontSize: '14px',
        fontWeight: 500,
        lineHeight: 1.43,
        textTransform: 'none',
      },
      caption: {
        fontSize: '12px',       // font-size-xs
        fontWeight: 400,
        lineHeight: 1.33,
        color: tokens.text.secondary,
      },
      overline: {
        fontSize: '11px',
        fontWeight: 500,
        lineHeight: 1.45,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      },
    },
    shape: {
      borderRadius: 10,         // border-radius-md
    },
    shadows: [
      'none',
      '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',   // subtle
      '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',   // card
      '0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.05)', // elevated
      ...Array(21).fill('0 4px 6px rgba(0,0,0,0.07)'),
    ] as any,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: mode === 'light' ? '#c4c6d0' : '#43474e',
              borderRadius: '4px',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: '5px',    // border-radius-sm
            padding: '10px 24px',
            textTransform: 'none',
            fontWeight: 500,
            transition: 'all 0.3s', // transition-standard
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 8px 20px rgba(14, 49, 76, 0.3)',
              transform: 'translateY(-1px)',
            },
          },
          containedPrimary: {
            background: tokens.primary.main,
            '&:hover': {
              background: tokens.primary.dark,
            },
          },
          outlined: {
            borderWidth: '1px',
            '&:hover': {
              borderWidth: '1px',
            },
          },
        },
        defaultProps: {
          disableElevation: true,
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: '10px',   // border-radius-md
            boxShadow: '0 5px 15px rgba(0,0,0,0.08)',
            transition: 'all 0.3s',
            '&:hover': {
              boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          elevation1: {
            boxShadow: '0 5px 15px rgba(0,0,0,0.08)',
          },
          elevation2: {
            boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: mode === 'light' ? '#FFFFFF' : '#0e314c',
          },
        },
        defaultProps: {
          elevation: 1,
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: '5px',  // border-radius-sm
            },
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            borderRadius: '15px',   // border-radius-lg
            textTransform: 'none',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: '5px',    // border-radius-sm
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: '15px',   // border-radius-lg
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRadius: '0 15px 15px 0',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: '10px',
            margin: '2px 12px',
            '&.Mui-selected': {
              backgroundColor: mode === 'light'
                ? 'rgba(255, 153, 0, 0.15)'
                : 'rgba(255, 153, 0, 0.25)',
              '&:hover': {
                backgroundColor: mode === 'light'
                  ? 'rgba(255, 153, 0, 0.2)'
                  : 'rgba(255, 153, 0, 0.35)',
              },
            },
          },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            backgroundColor: tokens.primary.main,
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: '5px',
            backgroundColor: mode === 'light' ? '#e0e0e0' : '#3a5068',
          },
        },
      },
    },
  };
};

export const lightTheme = createTheme(getDesignTokens('light'));
export const darkTheme = createTheme(getDesignTokens('dark'));

export default lightTheme;
