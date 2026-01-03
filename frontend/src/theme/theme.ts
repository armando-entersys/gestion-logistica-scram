'use client';

import { createTheme, ThemeOptions } from '@mui/material/styles';

// Material Design 3 Color Tokens for SCRAM Logistics
// Primary: Blue (logistics/tracking)
// Secondary: Teal (operations)
// Tertiary: Orange (alerts/priority)

const md3Tokens = {
  light: {
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
      light: '#9CF6B6',
      dark: '#00210E',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#7D5700',
      light: '#FFDEA3',
      dark: '#271900',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#FDFCFF',
      paper: '#FFFFFF',
    },
    surface: {
      main: '#FDFCFF',
      variant: '#E1E2EC',
    },
    outline: {
      main: '#74777F',
      variant: '#C4C6D0',
    },
  },
  dark: {
    primary: {
      main: '#9ECAFF',
      light: '#004A77',
      dark: '#D1E4FF',
      contrastText: '#003258',
    },
    secondary: {
      main: '#4FD8EB',
      light: '#004F58',
      dark: '#97F0FF',
      contrastText: '#00363D',
    },
    tertiary: {
      main: '#FFB871',
      light: '#6F4000',
      dark: '#FFDCC2',
      contrastText: '#4A2800',
    },
    error: {
      main: '#FFB4AB',
      light: '#93000A',
      dark: '#FFDAD6',
      contrastText: '#690005',
    },
    success: {
      main: '#81D99B',
      light: '#005226',
      dark: '#9CF6B6',
      contrastText: '#00391C',
    },
    warning: {
      main: '#F5BF48',
      light: '#5D4100',
      dark: '#FFDEA3',
      contrastText: '#422C00',
    },
    background: {
      default: '#1A1C1E',
      paper: '#1A1C1E',
    },
    surface: {
      main: '#1A1C1E',
      variant: '#43474E',
    },
    outline: {
      main: '#8E9099',
      variant: '#43474E',
    },
  },
};

const getDesignTokens = (mode: 'light' | 'dark'): ThemeOptions => {
  const tokens = md3Tokens[mode];

  return {
    palette: {
      mode,
      primary: tokens.primary,
      secondary: tokens.secondary,
      error: tokens.error,
      success: tokens.success,
      warning: tokens.warning,
      background: tokens.background,
      divider: tokens.outline.variant,
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      // MD3 Typography Scale
      displayLarge: {
        fontSize: '57px',
        fontWeight: 400,
        lineHeight: 1.12,
        letterSpacing: '-0.25px',
      },
      displayMedium: {
        fontSize: '45px',
        fontWeight: 400,
        lineHeight: 1.16,
      },
      displaySmall: {
        fontSize: '36px',
        fontWeight: 400,
        lineHeight: 1.22,
      },
      headlineLarge: {
        fontSize: '32px',
        fontWeight: 400,
        lineHeight: 1.25,
      },
      headlineMedium: {
        fontSize: '28px',
        fontWeight: 400,
        lineHeight: 1.29,
      },
      headlineSmall: {
        fontSize: '24px',
        fontWeight: 400,
        lineHeight: 1.33,
      },
      h1: {
        fontSize: '32px',
        fontWeight: 500,
        lineHeight: 1.25,
      },
      h2: {
        fontSize: '28px',
        fontWeight: 500,
        lineHeight: 1.29,
      },
      h3: {
        fontSize: '24px',
        fontWeight: 500,
        lineHeight: 1.33,
      },
      h4: {
        fontSize: '22px',
        fontWeight: 500,
        lineHeight: 1.27,
      },
      h5: {
        fontSize: '16px',
        fontWeight: 500,
        lineHeight: 1.5,
        letterSpacing: '0.15px',
      },
      h6: {
        fontSize: '14px',
        fontWeight: 500,
        lineHeight: 1.43,
        letterSpacing: '0.1px',
      },
      subtitle1: {
        fontSize: '16px',
        fontWeight: 500,
        lineHeight: 1.5,
        letterSpacing: '0.15px',
      },
      subtitle2: {
        fontSize: '14px',
        fontWeight: 500,
        lineHeight: 1.43,
        letterSpacing: '0.1px',
      },
      body1: {
        fontSize: '16px',
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: '0.5px',
      },
      body2: {
        fontSize: '14px',
        fontWeight: 400,
        lineHeight: 1.43,
        letterSpacing: '0.25px',
      },
      button: {
        fontSize: '14px',
        fontWeight: 500,
        lineHeight: 1.43,
        letterSpacing: '0.1px',
        textTransform: 'none',
      },
      caption: {
        fontSize: '12px',
        fontWeight: 400,
        lineHeight: 1.33,
        letterSpacing: '0.4px',
      },
      overline: {
        fontSize: '11px',
        fontWeight: 500,
        lineHeight: 1.45,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
      },
    },
    shape: {
      borderRadius: 16, // MD3 uses larger border radius
    },
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
              backgroundColor: tokens.outline.main,
              borderRadius: '4px',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: '20px', // MD3 pill-shaped buttons
            padding: '10px 24px',
            textTransform: 'none',
            fontWeight: 500,
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
            },
          },
          outlined: {
            borderWidth: '1px',
          },
        },
        defaultProps: {
          disableElevation: true,
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: '12px',
            boxShadow: mode === 'light'
              ? '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)'
              : '0px 1px 3px 1px rgba(0, 0, 0, 0.3)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          elevation1: {
            boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
        defaultProps: {
          elevation: 0,
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px',
            },
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            borderRadius: '16px', // MD3 FAB shape
            textTransform: 'none',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: '8px',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: '28px', // MD3 dialog radius
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRadius: '0 16px 16px 0',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: '28px',
            margin: '2px 12px',
            '&.Mui-selected': {
              backgroundColor: mode === 'light' ? tokens.primary.light : tokens.primary.dark,
            },
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          root: {
            width: 52,
            height: 32,
            padding: 0,
          },
          switchBase: {
            padding: 4,
            '&.Mui-checked': {
              transform: 'translateX(20px)',
              '& + .MuiSwitch-track': {
                opacity: 1,
              },
            },
          },
          thumb: {
            width: 24,
            height: 24,
          },
          track: {
            borderRadius: 16,
            opacity: 1,
            backgroundColor: tokens.surface.variant,
          },
        },
      },
    },
  };
};

export const lightTheme = createTheme(getDesignTokens('light'));
export const darkTheme = createTheme(getDesignTokens('dark'));

export default lightTheme;
