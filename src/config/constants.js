// src/config/constants.js
// ✅ מערכת ערים מתורגמת לעברית

// URL של API
export const API_URL = 'https://cleanconnect-backend-tulh.onrender.com/api';

// ✅ עמלות פלטפורמה - מערכת מעורבת
export const PLATFORM_FEES = {
  BASE_FEE: 10,              // עמלת בסיס קבועה (₪)
  COMMISSION_RATE_STANDARD: 0.03,     // עמלה 3% (appart-prive)
  COMMISSION_RATE_PREMIUM: 0.06,      // עמלה 6% (airbnb, immeuble, bureaux)
  PROMO_BASE_FEE: 8,         // עמלת השקה מבצע (₪)
  CURRENCY: '₪',
  MIN_TOTAL_FEE: 10,         // עמלה מינימלית כוללת (₪)
};

// ✅ Types de services premium (6% commission)
const PREMIUM_SERVICE_TYPES = ['airbnb', 'building', 'office', 'immeuble', 'bureaux', 'בניין', 'משרד', 'אירבנב'];

// ✅ Fonction pour déterminer le taux de commission
const getCommissionRate = (serviceType) => {
  if (!serviceType) return PLATFORM_FEES.COMMISSION_RATE_STANDARD;
  
  const normalizedType = serviceType.toLowerCase();
  const isPremium = PREMIUM_SERVICE_TYPES.some(type => 
    normalizedType.includes(type.toLowerCase())
  );
  
  return isPremium 
    ? PLATFORM_FEES.COMMISSION_RATE_PREMIUM 
    : PLATFORM_FEES.COMMISSION_RATE_STANDARD;
};

// ✅ פונקציה לחישוב עמלות פלטפורמה - MODIFIÉE pour prendre serviceType
export const calculatePlatformFees = (servicePrice, isPromo = false, serviceType = null) => {
  const baseFee = isPromo ? PLATFORM_FEES.PROMO_BASE_FEE : PLATFORM_FEES.BASE_FEE;
  const commissionRate = getCommissionRate(serviceType);
  const commission = servicePrice * commissionRate;
  const totalFee = baseFee + commission;
  
  // החלת מינימום
  const finalFee = Math.max(totalFee, PLATFORM_FEES.MIN_TOTAL_FEE);
  
  return {
    baseFee,
    commission,
    commissionRate, // ✅ Retourner le taux pour affichage
    percentage: commissionRate * 100, // ✅ Pourcentage pour affichage (3 ou 6)
    totalFee: finalFee,
    servicePrice,
    totalClientPays: servicePrice,
    platformFee: finalFee,
  };
};

// ✅ ערים בישראל לפי אזור (חדש)
export const ISRAEL_CITIES_BY_ZONE = [
  {
    zone: 'תל אביב והסביבה',
    cities: [
      'תל אביב',
      'רמת גן',
      'גבעתיים',
      'בני ברק',
      'חולון',
      'בת ים',
      'הרצליה',
      'פתח תקווה',
      'רעננה',
      'כפר סבא'
    ]
  },
  {
    zone: 'ירושלים והסביבה',
    cities: [
      'ירושלים',
      'מבשרת ציון',
      'בית שמש',
      'מעלה אדומים',
      'מודיעין-מכבים-רעות',
      'אפרת',
      'ביתר עילית'
    ]
  },
  {
    zone: 'חיפה והסביבה',
    cities: [
      'חיפה',
      'קריות',
      'נשר',
      'טירת כרמל',
      'עכו',
      'נהריה'
    ]
  },
  {
    zone: 'באר שבע והדרום',
    cities: [
      'באר שבע',
      'אשדוד',
      'אשקלון',
      'דימונה',
      'ערד',
      'קריית גת',
      'שדרות',
      'אופקים',
      'נתיבות'
    ]
  },
  {
    zone: 'מרכז (שרון)',
    cities: [
      'נתניה',
      'כפר סבא',
      'הוד השרון',
      'רעננה',
      'הרצליה',
      'רחובות',
      'ראשון לציון',
      'לוד',
      'רמלה',
      'נס ציונה'
    ]
  },
  {
    zone: 'צפון (גליל)',
    cities: [
      'נצרת',
      'טבריה',
      'צפת',
      'כרמיאל',
      'נהריה',
      'עפולה',
      'מגדל העמק'
    ]
  }
];

// רשימה שטוחה של כל הערים (לחיפוש ובחירה פשוטה)
export const ALL_CITIES = ISRAEL_CITIES_BY_ZONE
  .flatMap(zone => zone.cities)
  .sort((a, b) => a.localeCompare(b, 'he'));

// סוגי שירותים מוצעים
export const SERVICE_TYPES = {
  HOME: 'home',
  OFFICE: 'office',
  BUILDING: 'building',
  AIRBNB: 'airbnb',
};

// תרגום סוגי שירותים
export const SERVICE_TYPE_LABELS = {
  home: 'ניקיון בית',
  office: 'ניקיון משרד',
  building: 'ניקיון בניין',
  airbnb: 'ניקיון אירבנב',
};

// ✅ צבעים של סוגי שירותים - COULEURS PRINCIPALES
export const SERVICE_COLORS = {
  HOME: '#4A90E2',      // 🏠 בית - כחול (BLEU)
  OFFICE: '#E67E22',    // 🏢 משרד - כתום (ORANGE)
  BUILDING: '#27AE60',  // 🏗️ בניין - ירוק (VERT)
  AIRBNB: '#FF5A5F',    // 🏨 אירבנב - ורוד (ROSE)
};

// ✅ Fonds légers pour chaque type de service
export const SERVICE_BACKGROUND_COLORS = {
  HOME: '#E3F2FD',      // 🏠 Bleu 50 léger
  OFFICE: '#FFF3E0',    // 🏢 Orange 50 léger
  BUILDING: '#E8F5E9',  // 🏗️ Vert 50 léger
  AIRBNB: '#FCE4EC',    // 🏨 Rose 50 léger
};

// פונקציה לקבלת צבע לפי סוג שירות - Helper function
export const getServiceColor = (serviceType) => {
  switch (serviceType?.toLowerCase()) {
    case 'home':
    case 'בית':
    case 'maison':
      return SERVICE_COLORS.HOME;
    case 'office':
    case 'משרד':
    case 'bureau':
      return SERVICE_COLORS.OFFICE;
    case 'building':
    case 'בניין':
    case 'immeuble':
      return SERVICE_COLORS.BUILDING;
    case 'airbnb':
    case 'אירבנב':
      return SERVICE_COLORS.AIRBNB;
    default:
      return '#2196F3'; // צבע ברירת מחדל (bleu par défaut)
  }
};

// ✅ Fonction pour obtenir le fond léger
export const getServiceBackgroundColor = (serviceType) => {
  switch (serviceType?.toLowerCase()) {
    case 'home':
    case 'בית':
    case 'maison':
      return SERVICE_BACKGROUND_COLORS.HOME;
    case 'office':
    case 'משרד':
    case 'bureau':
      return SERVICE_BACKGROUND_COLORS.OFFICE;
    case 'building':
    case 'בניין':
    case 'immeuble':
      return SERVICE_BACKGROUND_COLORS.BUILDING;
    case 'airbnb':
    case 'אירבנב':
      return SERVICE_BACKGROUND_COLORS.AIRBNB;
    default:
      return '#F5F5F5'; // Gris clair par défaut
  }
};

// סוגי לקוחות
export const CLIENT_TYPES = {
  INDIVIDUAL: 'individual',
  BUSINESS: 'business',
  BUILDING_MANAGER: 'building',
};

// תרגום סוגי לקוחות
export const CLIENT_TYPE_LABELS = {
  individual: 'פרטי',
  business: 'עסק',
  building: 'מנהל בניין',
};

// סטטוסים של הזמנה
export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// תרגום סטטוסי הזמנה
export const BOOKING_STATUS_LABELS = {
  pending: 'ממתין',
  confirmed: 'מאושר',
  in_progress: 'בביצוע',
  completed: 'הושלם',
  cancelled: 'בוטל',
};

// אפשרויות תדירות ניקיון
export const CLEANING_FREQUENCY = {
  ONE_TIME: 'one_time',
  WEEKLY: 'weekly',
  BI_WEEKLY: 'bi_weekly',
  MONTHLY: 'monthly',
};

// תרגום תדירויות ניקיון
export const CLEANING_FREQUENCY_LABELS = {
  one_time: 'פעם אחת',
  weekly: 'שבועי',
  bi_weekly: 'דו-שבועי',
  monthly: 'חודשי',
};

// משכי ניקיון סטנדרטיים (בשעות)
export const CLEANING_DURATIONS = [1, 2, 3, 4, 5, 6, 8];

// פורמטים של תאריך ושעה
export const DATE_FORMAT = 'DD/MM/YYYY';
export const TIME_FORMAT = 'HH:mm';
export const DATETIME_FORMAT = 'DD/MM/YYYY HH:mm';

// מפתחות אחסון מקומי
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'token',        // utilisé partout dans le projet
  USER_ROLE: 'userRole',      // AuthContext.js lignes 57, 104, 220, 279
  USER_DATA: 'userData',      // AuthContext.js lignes 58, 105, 221, 280
  USER_BOOKINGS: 'user_bookings', // BookingContext.js — déjà correct
  LANGUAGE: 'language',       // LanguageContext.js
};
// שפות זמינות
export const LANGUAGES = {
  HE: 'he',
  EN: 'en',
  AR: 'ar',
};

// תרגום שפות
export const LANGUAGE_LABELS = {
  he: 'עברית',
  en: 'English',
};

// הרשאות
export const PERMISSIONS = {
  LOCATION: 'location',
  CAMERA: 'camera',
  NOTIFICATIONS: 'notifications',
};

// עימוד
export const ITEMS_PER_PAGE = 10;

// זמן תפוגה של טוקנים (בשניות)
export const TOKEN_EXPIRATION = 86400; // 24 שעות
