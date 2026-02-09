// src/navigation/RootNavigation.js
// ✅ Service de navigation programmatique (pour notifications)

import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/**
 * Naviguer programmatiquement depuis n'importe où dans l'app
 * Utilisé notamment par le système de notifications
 */
export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  } else {
    console.warn('⚠️ Navigation non prête');
  }
}

/**
 * Revenir à l'écran précédent
 */
export function goBack() {
  if (navigationRef.isReady()) {
    navigationRef.goBack();
  }
}

/**
 * Réinitialiser la navigation
 */
export function reset(state) {
  if (navigationRef.isReady()) {
    navigationRef.reset(state);
  }
}