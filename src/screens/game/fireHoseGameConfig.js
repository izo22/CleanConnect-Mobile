// src/screens/game/fireHoseGameConfig.js
// Configuration du mini-jeu "לכבות את האש" (Éteins le feu) — pompier au tuyau.
// Regroupe les thèmes visuels et les constantes de difficulté pour garder
// FireHoseGameScreen.js lisible.

export const THEMES = {
  forest: {
    id: 'forest',
    label: 'יער',
    subtitle: 'עצור את שריפת היער',
    backgroundColor: '#0B3D24',
    groundColor: '#0F5132',
    decorEmoji: '🌲',
    decorCount: 10,
    fireEmoji: '🔥',
    accentColor: '#34D399',
  },
  building: {
    id: 'building',
    label: 'בניין',
    subtitle: 'חלץ את הבניין מהאש',
    backgroundColor: '#1F2937',
    groundColor: '#374151',
    decorEmoji: '🏢',
    decorCount: 6,
    fireEmoji: '🔥',
    accentColor: '#F59E0B',
  },
};

export const GAME_STATUS = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  WON: 'won',
  LOST: 'lost',
};

// Boucle de jeu
export const TICK_MS = 100; // 10 ticks/seconde — fluide et léger pour mobile

// Durée à survivre pour gagner un niveau (secondes)
export const LEVEL_DURATION_S = 75;

// Nombre max de foyers de feu simultanés
export const MAX_FIRES = 9;

// Intervalle d'apparition d'un nouveau feu (secondes), diminue avec le temps
export const SPAWN_INTERVAL_START_S = 3.2;
export const SPAWN_INTERVAL_MIN_S = 0.9;

// Vitesse de croissance d'un foyer (points de santé/seconde), augmente avec le temps
export const FIRE_GROWTH_START = 6;
export const FIRE_GROWTH_MAX = 16;

// Probabilité par seconde qu'un feu à pleine santé se propage à un voisin
export const SPREAD_CHANCE_PER_S = 0.18;

// Dégâts infligés par seconde par le jet d'eau sur un feu touché
export const WATER_DAMAGE_PER_S = 130;

// Portée du jet d'eau (fraction de la hauteur de la zone de jeu)
export const HOSE_RANGE_RATIO = 0.72;

// Demi-angle du cône d'eau (degrés)
export const HOSE_CONE_HALF_ANGLE = 13;

// Angle max de rotation du tuyau depuis la verticale (degrés)
export const HOSE_MAX_ANGLE = 75;

// Jauge de danger : vitesse de montée / descente (points/seconde)
export const DANGER_RISE_FACTOR = 5.5; // par unité de (somme des santés/100)
export const DANGER_PASSIVE_DECAY = 3;

// Points gagnés par feu éteint (+ bonus par vague)
export const SCORE_PER_FIRE = 10;
export const SCORE_PER_WAVE_BONUS = 2;

// Une nouvelle "vague" toutes les X secondes (affichage difficulté)
export const WAVE_DURATION_S = 15;
