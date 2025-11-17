// src/config/theme.js
import { DefaultTheme } from 'react-native-paper';

// Thème personnalisé pour l'application
const theme = {
  ...DefaultTheme,
  // Couleurs principales de l'application
  colors: {
    ...DefaultTheme.colors,
    primary: '#2E86C1',      // Bleu principal
    accent: '#F1C40F',       // Jaune accent
    background: '#F5F5F5',   // Fond gris clair
    surface: '#FFFFFF',      // Surface blanche
    text: '#2C3E50',         // Texte bleu foncé
    error: '#E74C3C',        // Rouge pour les erreurs
    success: '#2ECC71',      // Vert pour les succès
    warning: '#F39C12',      // Orange pour les avertissements
    placeholder: '#95A5A6',  // Gris pour les placeholders
    disabled: '#BDC3C7',     // Gris pour les éléments désactivés
    notification: '#3498DB', // Bleu pour les notifications
    
    // Couleurs spécifiques à l'application
    cardBackground: '#FFFFFF',
    headerBackground: '#2E86C1',
    tabBarActive: '#2E86C1',
    tabBarInactive: '#95A5A6',
    divider: '#EAECEE',
    homeService: '#5DADE2',  // Bleu clair pour services à domicile
    officeService: '#AF7AC5', // Violet pour services de bureau
    buildingService: '#52BE80', // Vert pour services d'immeuble
  },
  
  // Arrondi des composants
  roundness: 8,
  
  // Typographie
  fonts: {
    ...DefaultTheme.fonts,
    // Vous pourrez personnaliser les polices ici si nécessaire
  },
  
  // Espacement standard (pour les marges et paddings)
  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 48,
  },
  
  // Ombres pour les éléments en élévation
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 5,
      elevation: 4,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    },
  },
};

export default theme;
