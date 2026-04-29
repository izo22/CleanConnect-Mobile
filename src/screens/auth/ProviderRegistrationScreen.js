// src/screens/auth/ProviderRegistrationScreen.js
// 🎨 VERSION ULTRA-MINIMALISTE PREMIUM
// Style inspiré de Stripe, Linear, Revolut
// גרסה מתורגמת לעברית ללא i18n
// ✅ MODIFIÉ: Ajout de la catégorie Airbnb + FIX bouton disabled
// ✅ CORRIGÉ: services → serviceDetails + ajout description
// ✅ MODIFIÉ: Ajout champ bio

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
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import CityMultiSelector from '../../components/CityMultiSelector';

const ServiceTypeItem = ({ 
  serviceKey, 
  service, 
  title, 
  description, 
  toggleService, 
  updateRate,
  error,
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
            תעריף לשעה:
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

const ProviderRegistrationScreen = ({ navigation }) => {
  const isRTL = true;
  const { registerProvider } = useContext(AuthContext);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // ✅ AJOUT: champ bio
  const [bio, setBio] = useState('');
  
  const [services, setServices] = useState({
    homeCleaning: { selected: false, rate: '' },
    buildingCleaning: { selected: false, rate: '' },
    officeCleaning: { selected: false, rate: '' },
    airbnb: { selected: false, rate: '' }
  });
  
  const [serviceCities, setServiceCities] = useState([]);
  const isAnyServiceSelected = Object.values(services).some(service => service.selected);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  
  // ✅ FIX: Fonction pour vérifier si tous les tarifs des services sélectionnés sont valides
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
      tempErrors.firstName = 'שם פרטי הוא שדה חובה';
      isValid = false;
    }
    
    if (!lastName.trim()) {
      tempErrors.lastName = 'שם משפחה הוא שדה חובה';
      isValid = false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      tempErrors.email = 'נדרשת כתובת אימייל תקינה';
      isValid = false;
    }
    
    if (!phone.trim()) {
      tempErrors.phone = 'מספר טלפון הוא שדה חובה';
      isValid = false;
    }
    
    if (password.length < 6) {
      tempErrors.password = 'הסיסמה חייבת להכיל לפחות 6 תווים';
      isValid = false;
    }
    
    if (password !== confirmPassword) {
      tempErrors.confirmPassword = 'הסיסמאות אינן תואמות';
      isValid = false;
    }
    
    if (!isAnyServiceSelected) {
      tempErrors.services = 'אנא בחר לפחות סוג שירות אחד';
      isValid = false;
    } else {
      const serviceRatesErrors = {};
      
      Object.entries(services).forEach(([key, service]) => {
        if (service.selected) {
          if (!service.rate.trim()) {
            serviceRatesErrors[key] = 'תעריף הוא שדה חובה';
            isValid = false;
          } else if (isNaN(parseFloat(service.rate)) || parseFloat(service.rate) <= 0) {
            serviceRatesErrors[key] = 'נדרש תעריף תקין';
            isValid = false;
          }
        }
      });
      
      if (Object.keys(serviceRatesErrors).length > 0) {
        tempErrors.serviceRates = serviceRatesErrors;
      }
    }
    
    if (serviceCities.length === 0) {
      tempErrors.serviceCities = 'אנא בחר לפחות עיר אחת';
      isValid = false;
    }
    
    if (!termsAccepted) {
      tempErrors.terms = 'עליך לקבל את התנאים וההגבלות';
      isValid = false;
    }
    
    setErrors(tempErrors);
    return isValid;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      // ✅ FIX: Mapping en hébreu pour correspondre au backend
      const serviceTypeMapping = {
        homeCleaning: 'בית',
        buildingCleaning: 'בניין',
        officeCleaning: 'משרד',
        airbnb: 'אירבנב'
      };
      
      // ✅ CORRECTION 1: Ajout du champ description
      const selectedServices = Object.entries(services)
        .filter(([_, service]) => service.selected)
        .map(([key, service]) => ({
          type: serviceTypeMapping[key],
          hourlyRate: parseFloat(service.rate),
          description: ''  // ✅ AJOUTÉ
        }));
      
      const averageHourlyRate = selectedServices.reduce(
        (sum, service) => sum + service.hourlyRate, 
        0
      ) / selectedServices.length;
      
      // ✅ CORRECTION 2: services → serviceDetails
      const userData = {
        firstName,
        lastName,
        email,
        phone,
        password,
        userType: 'provider',
        hourlyRate: averageHourlyRate,
        serviceTypes: selectedServices.map(service => service.type),
        serviceCities: serviceCities,
        serviceAreas: serviceCities,
        services: selectedServices,        // ← ce que le backend lit
        serviceDetails: selectedServices,  // ← gardé pour cohérence
        bio: bio.trim(),                   // ✅ AJOUT: bio envoyée au backend
      };
      
      registerProvider(userData)
        .then(() => {
          Alert.alert(
            'הרשמה הצליחה!',
            'החשבון שלך נוצר בהצלחה. אתה יכול להתחבר כעת.',
            [{ 
              text: 'אישור', 
              onPress: () => navigation.navigate('Login') 
            }]
          );
        })
        .catch(error => {
          Alert.alert(
            'שגיאה', 
            error.message || 'ההרשמה נכשלה. אנא נסה שוב.'
          );
        });
    } else {
      // ✅ FIX: Afficher une alerte pour indiquer les erreurs
      Alert.alert(
        'שגיאת טופס',
        'אנא תקן את השגיאות בטופס לפני השליחה',
        [{ text: 'אישור' }]
      );
    }
  };

  // ✅ FIX: Bouton disabled basé sur toutes les validations nécessaires
  const isFormValid = () => {
    return isAnyServiceSelected && 
           termsAccepted && 
           serviceCities.length > 0 && 
           areServiceRatesValid();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <Text style={[styles.title, isRTL && styles.textRTL]}>
              הרשמת ספק שירות
            </Text>
            <Text style={[styles.subtitle, isRTL && styles.textRTL]}>
              הצטרף לרשת אנשי המקצוע שלנו
            </Text>
          </View>
          
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              פרטים אישיים
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                שם פרטי
              </Text>
              <TextInput
                style={[
                  styles.input, 
                  errors.firstName ? styles.inputError : null,
                  isRTL && styles.textRTL
                ]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="הזן את שמך הפרטי"
                placeholderTextColor="#9CA3AF"
              />
              {errors.firstName && (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                  {errors.firstName}
                </Text>
              )}
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                שם משפחה
              </Text>
              <TextInput
                style={[
                  styles.input, 
                  errors.lastName ? styles.inputError : null,
                  isRTL && styles.textRTL
                ]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="הזן את שם המשפחה שלך"
                placeholderTextColor="#9CA3AF"
              />
              {errors.lastName && (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                  {errors.lastName}
                </Text>
              )}
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                אימייל
              </Text>
              <TextInput
                style={[
                  styles.input, 
                  errors.email ? styles.inputError : null
                ]}
                value={email}
                onChangeText={setEmail}
                placeholder="example@email.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                  {errors.email}
                </Text>
              )}
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                טלפון
              </Text>
              <TextInput
                style={[
                  styles.input, 
                  errors.phone ? styles.inputError : null
                ]}
                value={phone}
                onChangeText={setPhone}
                placeholder="05X-XXX-XXXX"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
              {errors.phone && (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                  {errors.phone}
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              סוגי שירותים
            </Text>
            <Text style={[styles.sectionSubtitle, isRTL && styles.textRTL]}>
              בחר את סוגי השירותים שאתה מציע והזן את התעריף השעתי עבור כל שירות
            </Text>
            
            {errors.services && (
              <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                {errors.services}
              </Text>
            )}
            
            <ServiceTypeItem
              serviceKey="homeCleaning"
              service={services.homeCleaning}
              title="ניקיון בית"
              description="ניקיון דירות, בתים פרטיים ומגורים"
              toggleService={toggleServiceType}
              updateRate={updateServiceRate}
              error={errors.serviceRates?.homeCleaning}
              isRTL={isRTL}
            />
            
            <ServiceTypeItem
              serviceKey="buildingCleaning"
              service={services.buildingCleaning}
              title="ניקיון בניינים"
              description="ניקיון חדרי מדרגות, מבואות וחלקים משותפים"
              toggleService={toggleServiceType}
              updateRate={updateServiceRate}
              error={errors.serviceRates?.buildingCleaning}
              isRTL={isRTL}
            />
            
            <ServiceTypeItem
              serviceKey="officeCleaning"
              service={services.officeCleaning}
              title="ניקיון משרדים"
              description="ניקיון משרדים ומקומות עבודה"
              toggleService={toggleServiceType}
              updateRate={updateServiceRate}
              error={errors.serviceRates?.officeCleaning}
              isRTL={isRTL}
            />
            
            <ServiceTypeItem
              serviceKey="airbnb"
              service={services.airbnb}
              title="ניקיון אירבנב"
              description="ניקיון דירות אירבנב בין check-out לcheck-in"
              toggleService={toggleServiceType}
              updateRate={updateServiceRate}
              error={errors.serviceRates?.airbnb}
              isRTL={isRTL}
            />
          </View>
          
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              ערים בהן אתה מספק שירות
            </Text>
            <Text style={[styles.sectionSubtitle, isRTL && styles.textRTL]}>
              בחר את הערים שבהן אתה מעוניין לספק שירותים
            </Text>
            
            {errors.serviceCities && (
              <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                {errors.serviceCities}
              </Text>
            )}
            
            <View style={[
              styles.citySelectorContainer,
              errors.serviceCities && styles.inputError
            ]}>
              <CityMultiSelector
                selectedCities={serviceCities}
                onChange={setServiceCities}
                style={styles.citySelector}
              />
            </View>
          </View>

          {/* ✅ AJOUT: Section bio */}
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              קצת עליי
            </Text>
            <Text style={[styles.sectionSubtitle, isRTL && styles.textRTL]}>
              ספר ללקוחות על עצמך — ניסיון, לאום, שפות וכל מה שיעזור להם לבחור אותך.{'\n'}
              ניתן לכתוב בעברית, באנגלית או בצרפתית.
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.bioInput,
                isRTL && styles.textRTL
              ]}
              value={bio}
              onChangeText={setBio}
              placeholder="לדוגמה: אני מנקה מקצועי עם 5 שנות ניסיון, דובר עברית ורוסית..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.bioCounter}>{bio.length}/500</Text>
          </View>
          
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              אבטחה
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                סיסמה
              </Text>
              <TextInput
                style={[
                  styles.input, 
                  errors.password ? styles.inputError : null,
                  isRTL && styles.textRTL
                ]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="הזן סיסמה (לפחות 6 תווים)"
                placeholderTextColor="#9CA3AF"
              />
              {errors.password && (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                  {errors.password}
                </Text>
              )}
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                אימות סיסמה
              </Text>
              <TextInput
                style={[
                  styles.input, 
                  errors.confirmPassword ? styles.inputError : null,
                  isRTL && styles.textRTL
                ]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="הזן את הסיסמה שוב"
                placeholderTextColor="#9CA3AF"
              />
              {errors.confirmPassword && (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                  {errors.confirmPassword}
                </Text>
              )}
            </View>
          </View>
          
          <View style={[styles.termsContainer, isRTL && styles.termsContainerRTL]}>
            <Switch
              value={termsAccepted}
              onValueChange={setTermsAccepted}
              trackColor={{ false: "#E5E7EB", true: "#4CD964" }}
            />
            <TouchableOpacity onPress={() => setTermsAccepted(!termsAccepted)}>
              <Text style={[styles.termsText, isRTL && styles.textRTL]}>
                אני מסכים ל
                <Text style={styles.termsLink}>תנאים והגבלות</Text>
                {' '}ו
                <Text style={styles.termsLink}>מדיניות הפרטיות</Text>
              </Text>
            </TouchableOpacity>
          </View>
          {errors.terms && (
            <Text style={[styles.errorText, isRTL && styles.textRTL]}>
              {errors.terms}
            </Text>
          )}
          
          <TouchableOpacity 
            style={[
              styles.submitButton, 
              !isFormValid() && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!isFormValid()}
          >
            <Text style={styles.submitButtonText}>
              הירשם כספק שירות
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={[styles.loginLinkText, isRTL && styles.textRTL]}>
              כבר רשום?{' '}
              <Text style={styles.loginLinkHighlight}>
                התחבר
              </Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CONTAINERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', // Fond ultra-clair
  },
  keyboardAvoidView: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
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
  // FORM SECTIONS (Cards ultra-minimalistes)
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
  // INPUTS (Minimalistes, fond blanc, bordures subtiles)
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
    // ✅ FIX ANDROID: lineHeight supprimé — causait texte coupé/invisible sur Android
    // quand combiné avec height fixe. Aucun impact visuel sur iOS.
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

  // ✅ AJOUT: styles bio
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
  // SERVICE TYPE ITEMS (Cards avec état sélectionné)
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
  // RATE CONTAINER (Inside service items)
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
    // ✅ FIX ANDROID: lineHeight supprimé — causait texte coupé/invisible sur Android
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
  // SUBMIT BUTTON (CTA principal)
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
  // LOGIN LINK (Footer)
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