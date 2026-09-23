// config/theme.js
// ✅ Design system "Light Blue" — palette bleu clair unifiée pour toute l'app

import { DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2E86C1',
    primaryDark: '#1B5E8C',
    primaryLight: '#5DADE2',
    accent: '#5DADE2',

    // Couleurs par type de service
    homeService: '#2E86C1',      // Bleu pour maison
    officeService: '#34C759',    // Vert pour bureau
    buildingService: '#FF9500',  // Orange pour immeuble
    airbnbService: '#FF5A5F',    // Rose/Rouge Airbnb

    // Couleurs d'état
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    info: '#5AC8FA',

    // Couleurs de texte
    text: '#13293D',
    textSecondary: '#5B7083',
    textLight: '#93A5B3',

    // Couleurs de fond — teinte bleu clair
    background: '#F3F8FC',
    backgroundGradientStart: '#EAF4FC',
    backgroundGradientEnd: '#F7FBFE',
    surface: '#FFFFFF',
    card: '#FFFFFF',

    // Couleurs de bordure
    border: '#E1EDF7',
    divider: '#E1EDF7',
  },

  // Typographie
  fonts: {
    regular: {
      fontFamily: 'Heebo',
      fontWeight: 'normal',
    },
    medium: {
      fontFamily: 'Heebo',
      fontWeight: '500',
    },
    bold: {
      fontFamily: 'Heebo',
      fontWeight: 'bold',
    },
  },

  // Espacements
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // Rayons de bordure
  roundness: {
    small: 8,
    medium: 12,
    large: 16,
    xlarge: 22,
  },

  // Ombres douces (cards style "premium")
  shadow: {
    shadowColor: '#1B5E8C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
};

export default theme;
