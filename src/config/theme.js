// config/theme.js
// ✅ Thème « CleanCasa » — teinte bleu clair (#5BA4D9)
// #5BA4D9 est trop clair pour du texte blanc : les boutons / éléments
// sélectionnés utilisent #256FA8, et #5BA4D9 sert aux accents.

import { DefaultTheme } from 'react-native-paper';

// ── Palette partagée par tous les écrans ─────────────────────────────────────
export const COLORS = {
  // Bleus
  primary:      '#256FA8',   // boutons, éléments sélectionnés, icônes actives
  primaryDark:  '#1B5A8A',
  navy:         '#1B4F7A',   // titres de marque, prix
  accent:       '#5BA4D9',   // interrupteurs, contours sélectionnés
  tint:         '#EAF4FB',   // pastilles, fonds d'icônes
  tintStrong:   '#DDEEFA',   // catégorie sélectionnée
  segment:      '#E4EFF7',   // fond du sélecteur d'onglets

  // Fonds
  canvas:       '#F6FAFD',   // fond d'écran (listes)
  surface:      '#FFFFFF',
  input:        '#F4F8FB',

  // Bordures
  border:       '#E1ECF4',
  borderSoft:   '#E8EFF5',
  divider:      '#EEF3F7',
  chipBorder:   '#DCE8F1',

  // Texte
  text:         '#1B2A36',
  textBody:     '#3A4A57',
  textMuted:    '#5E6E7C',
  textHint:     '#7A8A98',
  tabInactive:  '#8A99A6',
  white:        '#FFFFFF',

  // Divers
  star:         '#F2A93B',
  switchOff:    '#DCE3E9',
  radioOff:     '#B9C7D3',
  overlay:      'rgba(14,40,62,0.55)',
  error:        '#D64545',

  // Statuts de réservation
  statusConfirmedBg: '#E1F0FA', statusConfirmedFg: '#1B5A8A',
  statusPendingBg:   '#FFF3DC', statusPendingFg:   '#8A5A00',
  statusDoneBg:      '#EEF1F4', statusDoneFg:      '#4A5763',
  statusCancelledBg: '#FDECEC', statusCancelledFg: '#A33A3A',
};

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    accent: COLORS.accent,
    
    // Couleurs par type de service (unifiées en bleu)
    homeService: COLORS.primary,
    officeService: COLORS.primary,
    buildingService: COLORS.primary,
    airbnbService: COLORS.primary,
    
    // Couleurs d'état
    success: '#34C759',
    warning: '#FF9500',
    error: COLORS.error,
    info: COLORS.accent,
    
    // Couleurs de texte
    text: COLORS.text,
    textSecondary: COLORS.textMuted,
    textLight: COLORS.textHint,
    
    // Couleurs de fond
    background: COLORS.canvas,
    surface: COLORS.surface,
    card: COLORS.surface,
    
    // Couleurs de bordure
    border: COLORS.border,
    divider: COLORS.divider,
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