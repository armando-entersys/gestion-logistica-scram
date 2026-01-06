'use client';

import { createTheme, ThemeOptions } from '@mui/material/styles';

// SCRAM Brand Colors from design-tokens-colores-scram.csv
// Primary: #ff9900 (Orange) - CTAs, active links
// Secondary: #44ce6f (Green) - Accents, success states
// Text: #0e314c (Dark blue) - Headers, main text
// Typography: Cabin (Headers) + Asap (Body)

const scramTokens = {
  light: {
    primary: {
      main: '#ff9900',      // brand-primary
      light: '#ffb84d',
      dark: '#cc7a00',      // brand-primary-hover adjusted
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#44ce6f',      // brand-secondary
      light: '#76e097',
      dark: '#2ea855',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#eb6b3d',      // error-color
      light: '#ff9a6f',
      dark: '#c94d22',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#44ce6f',      // Same as secondary (brand-secondary)
      light: '#76e097',
      dark: '#2ea855',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#ff9900',      // warning-color (same as primary)
      light: '#ffb84d',
      dark: '#cc7a00',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#4a6f8a',      // neutral-navlink / info-color
      light: '#7a9db5',
      dark: '#2d4a5c',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#f7fafd',   // neutral-bg-light
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0e314c',   // neutral-black
      secondary: '#6084a4', // neutral-paragraph
    },
    divider: '#e0e0e0',     // neutral-border-light
  },
  dark: {
    primary: {
      main: '#ffb84d',
      light: '#ffd699',
      dark: '#ff9900',
      contrastText: '#1a1a1a',
    },
    secondary: {
      main: '#76e097',
      light: '#a8f0b8',
      dark: '#44ce6f',
      contrastText: '#1a1a1a',
    },
    error: {
      main: '#ff9a6f',
      light: '#ffbda3',
      dark: '#eb6b3d',
      contrastText: '#1a1a1a',
    },
    success: {
      main: '#76e097',
      light: '#a8f0b8',
      dark: '#44ce6f',
      contrastText: '#1a1a1a',
    },
    warning: {
      main: '#ffb84d',
      light: '#ffd699',
      dark: '#ff9900',
      contrastText: '#1a1a1a',
    },
    info: {
      main: '#7a9db5',
      light: '#a5c4d6',
      dark: '#4a6f8a',
      contrastText: '#1a1a1a',
    },
    background: {
      default: '#0e1f2f',
      paper: '#152636',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#b0c4d8',
    },
    divider: '#3a5068',
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
      '0 5px 15px rgba(0,0,0,0.08)',   // shadow-card
      '0 10px 25px rgba(0,0,0,0.12)',  // shadow-card-hover
      '0 13px 27px 0 rgba(68, 206, 111, 0.25)', // shadow-primary
      ...Array(21).fill('0 5px 15px rgba(0,0,0,0.08)'),
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
              boxShadow: '0 13px 27px 0 rgba(68, 206, 111, 0.25)',
              transform: 'translateY(-2px)',
            },
          },
          containedPrimary: {
            background: `linear-gradient(135deg, #23bdb8 0%, #43e794 100%)`,
            '&:hover': {
              background: `linear-gradient(135deg, #1fa8a3 0%, #38d480 100%)`,
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
            backgroundColor: mode === 'light' ? '#FFFFFF' : '#152636',
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
                ? 'rgba(255, 153, 0, 0.12)'
                : 'rgba(255, 184, 77, 0.2)',
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
