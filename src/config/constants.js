// src/config/constants.js
// ✅ AJOUT DU SYSTÈME DE VILLES

// URL de l'API
export const API_URL = 'http://localhost:5000/api';

// ✅ FRAIS PLATEFORME - SYSTÈME MIXTE
export const PLATFORM_FEES = {
  BASE_FEE: 10,              // Frais de base fixe (₪)
  COMMISSION_RATE: 0.03,     // Commission 3%
  PROMO_BASE_FEE: 8,         // Frais promo lancement (₪)
  CURRENCY: '₪',
  MIN_TOTAL_FEE: 10,         // Frais minimum total (₪)
};

// Fonction pour calculer les frais plateforme
export const calculatePlatformFees = (servicePrice, isPromo = false) => {
  const baseFee = isPromo ? PLATFORM_FEES.PROMO_BASE_FEE : PLATFORM_FEES.BASE_FEE;
  const commission = servicePrice * PLATFORM_FEES.COMMISSION_RATE;
  const totalFee = baseFee + commission;
  
  // Appliquer le minimum
  const finalFee = Math.max(totalFee, PLATFORM_FEES.MIN_TOTAL_FEE);
  
  return {
    baseFee,
    commission,
    totalFee: finalFee,
    servicePrice,
    totalClientPays: servicePrice,
    platformFee: finalFee,
  };
};

// ✅ VILLES D'ISRAËL PAR ZONE (NOUVEAU)
export const ISRAEL_CITIES_BY_ZONE = [
  {
    zone: 'Tel Aviv et environs',
    cities: [
      'Tel Aviv',
      'Ramat Gan',
      'Givatayim',
      'Bnei Brak',
      'Holon',
      'Bat Yam',
      'Herzliya',
      'Petah Tikva',
      'Raanana',
      'Kfar Saba'
    ]
  },
  {
    zone: 'Jerusalem et environs',
    cities: [
      'Jerusalem',
      'Mevasseret Zion',
      'Beit Shemesh',
      'Ma\'ale Adumim',
      'Modi\'in-Maccabim-Re\'ut',
      'Efrat',
      'Beitar Illit'
    ]
  },
  {
    zone: 'Haifa et environs',
    cities: [
      'Haifa',
      'Krayot',
      'Nesher',
      'Tirat Carmel',
      'Acre (Akko)',
      'Nahariya'
    ]
  },
  {
    zone: 'Beer Sheva et Sud',
    cities: [
      'Beer Sheva',
      'Ashdod',
      'Ashkelon',
      'Dimona',
      'Arad',
      'Kiryat Gat',
      'Sderot',
      'Ofakim',
      'Netivot'
    ]
  },
  {
    zone: 'Centre (Sharon)',
    cities: [
      'Netanya',
      'Kfar Saba',
      'Hod HaSharon',
      'Raanana',
      'Herzliya',
      'Rehovot',
      'Rishon LeZion',
      'Lod',
      'Ramla',
      'Ness Ziona'
    ]
  },
  {
    zone: 'Nord (Galilée)',
    cities: [
      'Nazareth',
      'Tiberias',
      'Safed (Tzfat)',
      'Karmiel',
      'Nahariya',
      'Afula',
      'Migdal HaEmek'
    ]
  }
];

// Liste plate de toutes les villes (pour recherche et sélection simple)
export const ALL_CITIES = ISRAEL_CITIES_BY_ZONE
  .flatMap(zone => zone.cities)
  .sort((a, b) => a.localeCompare(b, 'he'));

// Types de services proposés
export const SERVICE_TYPES = {
  HOME: 'home',
  OFFICE: 'office',
  BUILDING: 'building',
};

// Traduction des types de services
export const SERVICE_TYPE_LABELS = {
  home: 'Nettoyage à domicile',
  office: 'Nettoyage de bureaux',
  building: 'Nettoyage d\'immeubles',
};

// Types de clients
export const CLIENT_TYPES = {
  INDIVIDUAL: 'individual',
  BUSINESS: 'business',
  BUILDING_MANAGER: 'building',
};

// Traduction des types de clients
export const CLIENT_TYPE_LABELS = {
  individual: 'Particulier',
  business: 'Entreprise',
  building: 'Gestionnaire d\'immeuble',
};

// Statuts de réservation
export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// Traduction des statuts de réservation
export const BOOKING_STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

// Options de fréquence de nettoyage
export const CLEANING_FREQUENCY = {
  ONE_TIME: 'one_time',
  WEEKLY: 'weekly',
  BI_WEEKLY: 'bi_weekly',
  MONTHLY: 'monthly',
};

// Traduction des fréquences de nettoyage
export const CLEANING_FREQUENCY_LABELS = {
  one_time: 'Une fois',
  weekly: 'Hebdomadaire',
  bi_weekly: 'Bi-hebdomadaire',
  monthly: 'Mensuel',
};

// Durées de nettoyage standard (en heures)
export const CLEANING_DURATIONS = [1, 2, 3, 4, 5, 6, 8];

// Formats de date et heure
export const DATE_FORMAT = 'DD/MM/YYYY';
export const TIME_FORMAT = 'HH:mm';
export const DATETIME_FORMAT = 'DD/MM/YYYY HH:mm';

// Clés de stockage local
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_INFO: 'user_info',
  LANGUAGE: 'language',
  USER_BOOKINGS: 'user_bookings',
};

// Langues disponibles
export const LANGUAGES = {
  HE: 'he',
  EN: 'en',
  AR: 'ar',
};

// Traduction des langues
export const LANGUAGE_LABELS = {
  he: 'עברית',
  en: 'English',
};

// Permissions
export const PERMISSIONS = {
  LOCATION: 'location',
  CAMERA: 'camera',
  NOTIFICATIONS: 'notifications',
};

// Pagination
export const ITEMS_PER_PAGE = 10;

// Temps d'expiration des tokens (en secondes)
export const TOKEN_EXPIRATION = 86400; // 24 heures
