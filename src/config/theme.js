// config/theme.js
// ✅ Thème avec couleur Airbnb

import { DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#007AFF',
    accent: '#FF9500',
    
    // Couleurs par type de service
    homeService: '#007AFF',      // Bleu pour maison
    officeService: '#34C759',    // Vert pour bureau
    buildingService: '#FF9500',  // Orange pour immeuble
    airbnbService: '#FF5A5F',    // ✅ Rose/Rouge Airbnb
    
    // Couleurs d'état
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    info: '#5AC8FA',
    
    // Couleurs de texte
    text: '#000000',
    textSecondary: '#666666',
    textLight: '#999999',
    
    // Couleurs de fond
    background: '#F5F5F5',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    
    // Couleurs de bordure
    border: '#E0E0E0',
    divider: '#E0E0E0',
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
    small: 4,
    medium: 8,
    large: 12,
    xlarge: 16,
  },
};

export default theme;