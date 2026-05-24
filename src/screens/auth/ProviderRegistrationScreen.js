// src/screens/auth/ProviderRegistrationScreen.js
// 🎨 VERSION ULTRA-MINIMALISTE PREMIUM
// Style inspiré de Stripe, Linear, Revolut
// ✅ MODIFIÉ: Ajout de la catégorie Airbnb + FIX bouton disabled
// ✅ CORRIGÉ: services → serviceDetails + ajout description
// ✅ MODIFIÉ: Ajout champ bio
// ✅ AJOUT: Sélecteur de langue EN/HE avec RTL automatique
// ✅ FIX: SafeAreaView importé depuis react-native-safe-area-context (fix Android status bar)
// ✅ AJOUT: TermsModal intégré sur le lien Terms & Conditions

/*
CHANGEMENTS MAJEURS APPLIQUÉS :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TYPOGRAPHIE :
  - Titre principal : 18px (au lieu de 24px), weight 600, letterSpacing -0.3
  - Section titles : 16px (au lieu de 18px), weight 600
  - Labels : 13px (au lieu de 14px), weight 400, letterSpacing -0.2
  - Inputs : 14px (au lieu de 16px), weight 400
  - Service titles : 15px (au lieu de 16px), weight 600
  - Descriptions : 12px (au lieu de 14px), weight 400
  - Line heights serrés : 1.3-1.4 partout

✅ COULEURS & FONDS :
  - Fond principal : #F9FAFB (ultra-clair)
  - formSection : fond blanc pur #FFFFFF
  - Inputs : fond #FFFFFF (pas #F5F5F5), bordure #F3F4F6
  - Service items : fond #FAFAFA (ultra-léger)
  - Service selected : fond #EFF6FF (bleu 10%), bordure #4a90e2
  - Labels : #6B7280 (gris doux)
  - Placeholders : #9CA3AF

✅ CARDS/SECTIONS :
  - Border-radius : 12px (au lieu de 10px/8px)
  - Bordures ultra-subtiles : #F3F4F6
  - Ombres quasi-éliminées : shadowOpacity 0.03, elevation 1
  - Padding augmenté : 20px (au lieu de 15px)

✅ INPUTS :
  - Hauteur réduite : 40px (au lieu de variable)
  - Fond blanc pur
  - Bordures ultra-légères #F3F4F6
  - Border-radius : 8px

✅ SERVICE TYPE ITEMS :
  - Border-radius : 10px (au lieu de 8px)
  - Checkbox : 20px (au lieu de 24px)
  - Padding augmenté pour respiration
  - État selected avec fond bleu à 10% d'opacité

✅ BOUTONS :
  - Hauteur : 40px
  - Border-radius : 8px
  - Pas d'ombre
  - État disabled plus subtil (#93C5FD)

✅ SPACING :
  - Espacements doublés entre sections : 24px
  - Marges augmentées pour respiration
  - Structure par le vide

✅ ICONS :
  - Taille réduite : 18px pour checkbox (au lieu de 18px gardé car déjà bon)
  - Couleur grise douce : #9CA3AF

✅ FIX ANDROID :
  - lineHeight supprimé de input et rateInput (causait texte coupé/invisible sur Android)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*/

import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import CityMultiSelector from '../../components/CityMultiSelector';
import TermsModal from '../../components/TermsModal';

// ─── Traductions ───────────────────────────────────────────────────────────────
const translations = {
  he: {
    title:             'הרשמת ספק שירות',
    subtitle:          'הצטרף לרשת אנשי המקצוע שלנו',
    sectionPersonal:   'פרטים אישיים',
    firstName:         'שם פרטי',
    firstNamePh:       'הזן את שמך הפרטי',
    lastName:          'שם משפחה',
    lastNamePh:        'הזן את שם המשפחה שלך',
    email:             'אימייל',
    phone:             'טלפון',
    sectionServices:   'סוגי שירותים',
    servicesSubtitle:  'בחר את סוגי השירותים שאתה מציע והזן את התעריף השעתי עבור כל שירות',
    rateLabel:         'תעריף לשעה:',
    homeTitle:         'ניקיון בית',
    homeDesc:          'ניקיון דירות, בתים פרטיים ומגורים',
    buildingTitle:     'ניקיון בניינים',
    buildingDesc:      'ניקיון חדרי מדרגות, מבואות וחלקים משותפים',
    officeTitle:       'ניקיון משרדים',
    officeDesc:        'ניקיון משרדים ומקומות עבודה',
    airbnbTitle:       'ניקיון אירבנב',
    airbnbDesc:        'ניקיון דירות אירבנב בין check-out לcheck-in',
    sectionCities:     'ערים בהן אתה מספק שירות',
    citiesSubtitle:    'בחר את הערים שבהן אתה מעוניין לספק שירותים',
    sectionBio:        'קצת עליי',
    bioSubtitle:       'ספר ללקוחות על עצמך — ניסיון, לאום, שפות וכל מה שיעזור להם לבחור אותך.\nניתן לכתוב בעברית, באנגלית או בצרפתית.',
    bioPh:             'לדוגמה: אני מנקה מקצועי עם 5 שנות ניסיון, דובר עברית ורוסית...',
    sectionSecurity:   'אבטחה',
    password:          'סיסמה',
    passwordPh:        'הזן סיסמה (לפחות 6 תווים)',
    confirmPassword:   'אימות סיסמה',
    confirmPasswordPh: 'הזן את הסיסמה שוב',
    termsText:         'אני מסכים ל',
    termsAnd:          ' ו',
    termsLink1:        'תנאים והגבלות',
    termsLink2:        'מדיניות הפרטיות',
    submitBtn:         'הירשם כספק שירות',
    alreadyRegistered: 'כבר רשום?',
    loginLink:         'התחבר',
    errFirstName:      'שם פרטי הוא שדה חובה',
    errLastName:       'שם משפחה הוא שדה חובה',
    errEmail:          'נדרשת כתובת אימייל תקינה',
    errPhone:          'מספר טלפון הוא שדה חובה',
    errPassword:       'הסיסמה חייבת להכיל לפחות 6 תווים',
    errConfirmPw:      'הסיסמאות אינן תואמות',
    errServices:       'אנא בחר לפחות סוג שירות אחד',
    errRate:           'תעריף הוא שדה חובה',
    errRateInvalid:    'נדרש תעריף תקין',
    errCities:         'אנא בחר לפחות עיר אחת',
    errTerms:          'עליך לקבל את התנאים וההגבלות',
    alertSuccessTitle: 'הרשמה הצליחה!',
    alertSuccessMsg:   'החשבון שלך נוצר בהצלחה. אתה יכול להתחבר כעת.',
    alertSuccessBtn:   'אישור',
    alertErrorTitle:   'שגיאה',
    alertErrorMsg:     'ההרשמה נכשלה. אנא נסה שוב.',
    alertFormTitle:    'שגיאת טופס',
    alertFormMsg:      'אנא תקן את השגיאות בטופס לפני השליחה',
    alertFormBtn:      'אישור',
  },
  en: {
    title:             'Service Provider Registration',
    subtitle:          'Join our professional network',
    sectionPersonal:   'Personal Information',
    firstName:         'First name',
    firstNamePh:       'Enter your first name',
    lastName:          'Last name',
    lastNamePh:        'Enter your last name',
    email:             'Email',
    phone:             'Phone',
    sectionServices:   'Service Types',
    servicesSubtitle:  'Select the services you offer and enter your hourly rate for each',
    rateLabel:         'Hourly rate:',
    homeTitle:         'Home Cleaning',
    homeDesc:          'Apartments, private homes and residential spaces',
    buildingTitle:     'Building Cleaning',
    buildingDesc:      'Stairwells, lobbies and common areas',
    officeTitle:       'Office Cleaning',
    officeDesc:        'Offices and workplaces',
    airbnbTitle:       'Airbnb Cleaning',
    airbnbDesc:        'Airbnb apartments between check-out and check-in',
    sectionCities:     'Service Cities',
    citiesSubtitle:    'Select the cities where you are available to provide services',
    sectionBio:        'About Me',
    bioSubtitle:       'Tell clients about yourself — experience, languages, and anything that will help them choose you.\nYou can write in Hebrew, English or French.',
    bioPh:             'e.g. Professional cleaner with 5 years of experience, fluent in Hebrew and English...',
    sectionSecurity:   'Security',
    password:          'Password',
    passwordPh:        'Enter a password (at least 6 characters)',
    confirmPassword:   'Confirm password',
    confirmPasswordPh: 'Enter your password again',
    termsText:         'I agree to the ',
    termsAnd:          ' and ',
    termsLink1:        'Terms & Conditions',
    termsLink2:        'Privacy Policy',
    submitBtn:         'Register as Service Provider',
    alreadyRegistered: 'Already registered?',
    loginLink:         'Log in',
    errFirstName:      'First name is required',
    errLastName:       'Last name is required',
    errEmail:          'A valid email address is required',
    errPhone:          'Phone number is required',
    errPassword:       'Password must be at least 6 characters',
    errConfirmPw:      'Passwords do not match',
    errServices:       'Please select at least one service type',
    errRate:           'Rate is required',
    errRateInvalid:    'Please enter a valid rate',
    errCities:         'Please select at least one city',
    errTerms:          'You must accept the terms and conditions',
    alertSuccessTitle: 'Registration successful!',
    alertSuccessMsg:   'Your account has been created. You can now log in.',
    alertSuccessBtn:   'OK',
    alertErrorTitle:   'Error',
    alertErrorMsg:     'Registration failed. Please try again.',
    alertFormTitle:    'Form error',
    alertFormMsg:      'Please fix the errors before submitting',
    alertFormBtn:      'OK',
  },
};

// ─── ServiceTypeItem ───────────────────────────────────────────────────────────
const ServiceTypeItem = ({ 
  serviceKey, 
  service, 
  title, 
  description, 
  toggleService, 
  updateRate,
  error,
  rateLabel,
  isRTL
}) => {
  return (
    <View style={[
      styles.serviceTypeItem, 
      service.selected && styles.serviceTypeSelected
    ]}>
      <TouchableOpacity 
        style={[styles.serviceTypeHeader, isRTL && styles.serviceTypeHeaderRTL]}
        onPress={() => toggleService(serviceKey)}
      >
        <View style={[
          styles.serviceTypeCheckbox,
          service.selected && styles.serviceTypeCheckboxSelected
        ]}>
          {service.selected && (
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          )}
        </View>
        <View style={styles.serviceTypeContent}>
          <Text style={[styles.serviceTypeTitle, isRTL && styles.textRTL]}>{title}</Text>
          <Text style={[styles.serviceTypeDescription, isRTL && styles.textRTL]}>{description}</Text>
        </View>
      </TouchableOpacity>
      
      {service.selected && (
        <View style={styles.rateContainer}>
          <Text style={[styles.rateLabel, isRTL && styles.textRTL]}>
            {rateLabel}
          </Text>
          <View style={[styles.rateInputContainer, isRTL && styles.rateInputContainerRTL]}>
            <TextInput
              style={[
                styles.rateInput, 
                error ? styles.inputError : null
              ]}
              value={service.rate}
              onChangeText={(text) => updateRate(serviceKey, text)}
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
            <Text style={styles.rateCurrency}>₪/h</Text>
          </View>
          {error && (
            <Text style={[styles.errorText, isRTL && styles.textRTL]}>{error}</Text>
          )}
        </View>
      )}
    </View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────
const ProviderRegistrationScreen = ({ navigation }) => {
  const [lang, setLang] = useState('he');
  const isRTL = lang === 'he';
  const t = translations[lang];

  const { registerProvider } = useContext(AuthContext);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [bio, setBio] = useState('');
  const [termsVisible, setTermsVisible] = useState(false); // ✅ AJOUT: state modal CGU
  
  const [services, setServices] = useState({
    homeCleaning:     { selected: false, rate: '' },
    buildingCleaning: { selected: false, rate: '' },
    officeCleaning:   { selected: false, rate: '' },
    airbnb:           { selected: false, rate: '' }
  });
  
  const [serviceCities, setServiceCities] = useState([]);
  const isAnyServiceSelected = Object.values(services).some(service => service.selected);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  
  const areServiceRatesValid = () => {
    const selectedServices = Object.values(services).filter(service => service.selected);
    if (selectedServices.length === 0) return false;
    
    return selectedServices.every(service => 
      service.rate.trim() !== '' && 
      !isNaN(parseFloat(service.rate)) && 
      parseFloat(service.rate) > 0
    );
  };
  
  const toggleServiceType = (type) => {
    setServices(prevState => ({
      ...prevState,
      [type]: {
        ...prevState[type],
        selected: !prevState[type].selected
      }
    }));
    
    if (!services[type].selected) {
      setErrors(prev => ({ ...prev, services: null }));
    }
  };

  const updateServiceRate = (type, rate) => {
    setServices(prevState => ({
      ...prevState,
      [type]: {
        ...prevState[type],
        rate: rate.replace(/[^0-9.]/g, '')
      }
    }));
    
    if (rate) {
      setErrors(prev => {
        const newErrors = { ...prev };
        if (newErrors.serviceRates) {
          delete newErrors.serviceRates[type];
          if (Object.keys(newErrors.serviceRates).length === 0) {
            delete newErrors.serviceRates;
          }
        }
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    let tempErrors = {};
    let isValid = true;
    
    if (!firstName.trim()) {
      tempErrors.firstName = t.errFirstName;
      isValid = false;
    }
    
    if (!lastName.trim()) {
      tempErrors.lastName = t.errLastName;
      isValid = false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      tempErrors.email = t.errEmail;
      isValid = false;
    }
    
    if (!phone.trim()) {
      tempErrors.phone = t.errPhone;
      isValid = false;
    }
    
    if (password.length < 6) {
      tempErrors.password = t.errPassword;
      isValid = false;
    }
    
    if (password !== confirmPassword) {
      tempErrors.confirmPassword = t.errConfirmPw;
      isValid = false;
    }
    
    if (!isAnyServiceSelected) {
      tempErrors.services = t.errServices;
      isValid = false;
    } else {
      const serviceRatesErrors = {};
      
      Object.entries(services).forEach(([key, service]) => {
        if (service.selected) {
          if (!service.rate.trim()) {
            serviceRatesErrors[key] = t.errRate;
            isValid = false;
          } else if (isNaN(parseFloat(service.rate)) || parseFloat(service.rate) <= 0) {
            serviceRatesErrors[key] = t.errRateInvalid;
            isValid = false;
          }
        }
      });
      
      if (Object.keys(serviceRatesErrors).length > 0) {
        tempErrors.serviceRates = serviceRatesErrors;
      }
    }
    
    if (serviceCities.length === 0) {
      tempErrors.serviceCities = t.errCities;
      isValid = false;
    }
    
    if (!termsAccepted) {
      tempErrors.terms = t.errTerms;
      isValid = false;
    }
    
    setErrors(tempErrors);
    return isValid;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      const serviceTypeMapping = {
        homeCleaning:     'בית',
        buildingCleaning: 'בניין',
        officeCleaning:   'משרד',
        airbnb:           'אירבנב'
      };
      
      const selectedServices = Object.entries(services)
        .filter(([_, service]) => service.selected)
        .map(([key, service]) => ({
          type:        serviceTypeMapping[key],
          hourlyRate:  parseFloat(service.rate),
          description: ''
        }));
      
      const averageHourlyRate = selectedServices.reduce(
        (sum, service) => sum + service.hourlyRate, 
        0
      ) / selectedServices.length;
      
      const userData = {
        firstName,
        lastName,
        email,
        phone,
        password,
        userType:       'provider',
        hourlyRate:     averageHourlyRate,
        serviceTypes:   selectedServices.map(service => service.type),
        serviceCities,
        serviceAreas:   serviceCities,
        services:       selectedServices,
        serviceDetails: selectedServices,
        bio:            bio.trim(),
      };
      
      registerProvider(userData)
        .then(() => {
          Alert.alert(
            t.alertSuccessTitle,
            t.alertSuccessMsg,
            [{ 
              text: t.alertSuccessBtn, 
              onPress: () => navigation.navigate('Login') 
            }]
          );
        })
        .catch(error => {
          Alert.alert(
            t.alertErrorTitle, 
            error.message || t.alertErrorMsg
          );
        });
    } else {
      Alert.alert(
        t.alertFormTitle,
        t.alertFormMsg,
        [{ text: t.alertFormBtn }]
      );
    }
  };

  const isFormValid = () => {
    return isAnyServiceSelected && 
           termsAccepted && 
           serviceCities.length > 0 && 
           areServiceRatesValid();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>

          {/* ── Sélecteur de langue ── */}
          <View style={styles.langToggleContainer}>
            <TouchableOpacity
              style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
              onPress={() => setLang('en')}
            >
              <Text style={[styles.langBtnText, lang === 'en' && styles.langBtnTextActive]}>EN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langBtn, lang === 'he' && styles.langBtnActive]}
              onPress={() => setLang('he')}
            >
              <Text style={[styles.langBtnText, lang === 'he' && styles.langBtnTextActive]}>HE</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.header}>
            <Text style={[styles.title, isRTL && styles.textRTL]}>{t.title}</Text>
            <Text style={[styles.subtitle, isRTL && styles.textRTL]}>{t.subtitle}</Text>
          </View>
          
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>{t.sectionPersonal}</Text>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>{t.firstName}</Text>
              <TextInput
                style={[styles.input, errors.firstName ? styles.inputError : null, isRTL && styles.textRTL]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder={t.firstNamePh}
                placeholderTextColor="#9CA3AF"
              />
              {errors.firstName && (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>{errors.firstName}</Text>
              )}
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>{t.lastName}</Text>
              <TextInput
                style={[styles.input, errors.lastName ? styles.inputError : null, isRTL && styles.textRTL]}
                value={lastName}
                onChangeText={setLastName}
                placeholder={t.lastNamePh}
                placeholderTextColor="#9CA3AF"
              />
              {errors.lastName && (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>{errors.lastName}</Text>
              )}
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>{t.email}</Text>
              <TextInput
                style={[styles.input, errors.email ? styles.inputError : null]}
                value={email}
                onChangeText={setEmail}
                placeholder="example@email.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>{errors.email}</Text>
              )}
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>{t.phone}</Text>
              <TextInput
                style={[styles.input, errors.phone ? styles.inputError : null]}
                value={phone}
                onChangeText={setPhone}
                placeholder="05X-XXX-XXXX"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
              {errors.phone && (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>{errors.phone}</Text>
              )}
            </View>
          </View>
          
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>{t.sectionServices}</Text>
            <Text style={[styles.sectionSubtitle, isRTL && styles.textRTL]}>{t.servicesSubtitle}</Text>
            
            {errors.services && (
              <Text style={[styles.errorText, isRTL && styles.textRTL]}>{errors.services}</Text>
            )}
            
            <ServiceTypeItem
              serviceKey="homeCleaning"
              service={services.homeCleaning}
              title={t.homeTitle}
              description={t.homeDesc}
              toggleService={toggleServiceType}
              updateRate={updateServiceRate}
              error={errors.serviceRates?.homeCleaning}
              rateLabel={t.rateLabel}
              isRTL={isRTL}
            />
            <ServiceTypeItem
              serviceKey="buildingCleaning"
              service={services.buildingCleaning}
              title={t.buildingTitle}
              description={t.buildingDesc}
              toggleService={toggleServiceType}
              updateRate={updateServiceRate}
              error={errors.serviceRates?.buildingCleaning}
              rateLabel={t.rateLabel}
              isRTL={isRTL}
            />
            <ServiceTypeItem
              serviceKey="officeCleaning"
              service={services.officeCleaning}
              title={t.officeTitle}
              description={t.officeDesc}
              toggleService={toggleServiceType}
              updateRate={updateServiceRate}
              error={errors.serviceRates?.officeCleaning}
              rateLabel={t.rateLabel}
              isRTL={isRTL}
            />
            <ServiceTypeItem
              serviceKey="airbnb"
              service={services.airbnb}
              title={t.airbnbTitle}
              description={t.airbnbDesc}
              toggleService={toggleServiceType}
              updateRate={updateServiceRate}
              error={errors.serviceRates?.airbnb}
              rateLabel={t.rateLabel}
              isRTL={isRTL}
            />
          </View>
          
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>{t.sectionCities}</Text>
            <Text style={[styles.sectionSubtitle, isRTL && styles.textRTL]}>{t.citiesSubtitle}</Text>
            
            {errors.serviceCities && (
              <Text style={[styles.errorText, isRTL && styles.textRTL]}>{errors.serviceCities}</Text>
            )}
            
            <View style={[styles.citySelectorContainer, errors.serviceCities && styles.inputError]}>
              <CityMultiSelector
                selectedCities={serviceCities}
                onChange={setServiceCities}
                style={styles.citySelector}
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>{t.sectionBio}</Text>
            <Text style={[styles.sectionSubtitle, isRTL && styles.textRTL]}>{t.bioSubtitle}</Text>
            <TextInput
              style={[styles.input, styles.bioInput, isRTL && styles.textRTL]}
              value={bio}
              onChangeText={setBio}
              placeholder={t.bioPh}
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.bioCounter}>{bio.length}/500</Text>
          </View>
          
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>{t.sectionSecurity}</Text>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>{t.password}</Text>
              <TextInput
                style={[styles.input, errors.password ? styles.inputError : null, isRTL && styles.textRTL]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder={t.passwordPh}
                placeholderTextColor="#9CA3AF"
              />
              {errors.password && (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>{errors.password}</Text>
              )}
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>{t.confirmPassword}</Text>
              <TextInput
                style={[styles.input, errors.confirmPassword ? styles.inputError : null, isRTL && styles.textRTL]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder={t.confirmPasswordPh}
                placeholderTextColor="#9CA3AF"
              />
              {errors.confirmPassword && (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>{errors.confirmPassword}</Text>
              )}
            </View>
          </View>

          {/* ✅ MODIF: Switch accepte les CGU, lien ouvre le modal */}
          <View style={[styles.termsContainer, isRTL && styles.termsContainerRTL]}>
            <Switch
              value={termsAccepted}
              onValueChange={setTermsAccepted}
              trackColor={{ false: "#E5E7EB", true: "#4CD964" }}
            />
            <Text style={[styles.termsText, isRTL && styles.textRTL]}>
              {t.termsText}
              <Text style={styles.termsLink} onPress={() => setTermsVisible(true)}>
                {t.termsLink1}
              </Text>
              {t.termsAnd}
              <Text style={styles.termsLink} onPress={() => setTermsVisible(true)}>
                {t.termsLink2}
              </Text>
            </Text>
          </View>
          {errors.terms && (
            <Text style={[styles.errorText, isRTL && styles.textRTL]}>{errors.terms}</Text>
          )}
          
          <TouchableOpacity 
            style={[styles.submitButton, !isFormValid() && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!isFormValid()}
          >
            <Text style={styles.submitButtonText}>{t.submitBtn}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={[styles.loginLinkText, isRTL && styles.textRTL]}>
              {t.alreadyRegistered}{' '}
              <Text style={styles.loginLinkHighlight}>{t.loginLink}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ✅ AJOUT: Modal CGU — s'ouvre au clic sur les liens terms */}
      <TermsModal
        visible={termsVisible}
        onClose={() => setTermsVisible(false)}
        initialLang={lang}
      />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CONTAINERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardAvoidView: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SÉLECTEUR DE LANGUE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  langToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
    gap: 6,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  langBtnActive: {
    backgroundColor: '#4a90e2',
    borderColor: '#4a90e2',
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: -0.2,
  },
  langBtnTextActive: {
    color: '#FFFFFF',
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HEADER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 18 * 1.3,
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 14 * 1.4,
    color: '#6B7280',
    textAlign: 'center',
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FORM SECTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 16 * 1.3,
    color: '#111827',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 12 * 1.4,
    color: '#6B7280',
    marginBottom: 20,
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INPUTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 13 * 1.3,
    color: '#6B7280',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 0,
    height: 40,
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: -0.2,
    color: '#111827',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: -0.1,
    lineHeight: 11 * 1.3,
    marginTop: 4,
  },
  bioInput: {
    height: 100,
    paddingVertical: 10,
  },
  bioCounter: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'left',
    marginTop: 4,
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CITY SELECTOR
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  citySelectorContainer: {
    height: 400,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  citySelector: {
    flex: 1,
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SERVICE TYPE ITEMS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  serviceTypeItem: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  serviceTypeSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#4a90e2',
  },
  serviceTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceTypeHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  serviceTypeCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  serviceTypeCheckboxSelected: {
    borderColor: '#4a90e2',
    backgroundColor: '#4a90e2',
  },
  serviceTypeContent: {
    flex: 1,
  },
  serviceTypeTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 15 * 1.3,
    color: '#111827',
    marginBottom: 4,
  },
  serviceTypeDescription: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 12 * 1.4,
    color: '#6B7280',
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RATE CONTAINER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  rateContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  rateLabel: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 13 * 1.3,
    color: '#6B7280',
    marginBottom: 6,
  },
  rateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rateInputContainerRTL: {
    flexDirection: 'row-reverse',
  },
  rateInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 0,
    height: 40,
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: -0.2,
    width: 100,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    color: '#111827',
  },
  rateCurrency: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
    color: '#6B7280',
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TERMS & CONDITIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  termsContainerRTL: {
    flexDirection: 'row-reverse',
  },
  termsText: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 13 * 1.4,
    color: '#6B7280',
    marginLeft: 10,
    flex: 1,
  },
  termsLink: {
    color: '#4a90e2',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUBMIT BUTTON
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  submitButton: {
    backgroundColor: '#4a90e2',
    borderRadius: 8,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#93C5FD',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 14 * 1.3,
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LOGIN LINK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  loginLink: {
    alignItems: 'center',
    marginBottom: 30,
  },
  loginLinkText: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 13 * 1.3,
    color: '#6B7280',
  },
  loginLinkHighlight: {
    color: '#4a90e2',
    fontWeight: '600',
  },
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RTL
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default ProviderRegistrationScreen;