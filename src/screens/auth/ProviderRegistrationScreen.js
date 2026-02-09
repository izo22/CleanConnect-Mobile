// src/screens/auth/ProviderRegistrationScreen.js
// גרסה מתורגמת לעברית ללא i18n
// ✅ MODIFIÉ: Ajout de la catégorie Airbnb + FIX bouton disabled
// ✅ CORRIGÉ: services → serviceDetails + ajout description

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
        <View style={styles.serviceTypeCheckbox}>
          {service.selected && (
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
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
        serviceDetails: selectedServices  // ✅ CHANGÉ: services → serviceDetails
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
              trackColor={{ false: "#D1D1D6", true: "#4CD964" }}
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
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  keyboardAvoidView: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 15,
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 5,
  },
  citySelectorContainer: {
    height: 400,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  citySelector: {
    flex: 1,
  },
  serviceTypeItem: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  serviceTypeSelected: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  serviceTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceTypeHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  serviceTypeCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  serviceTypeContent: {
    flex: 1,
  },
  serviceTypeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 5,
  },
  serviceTypeDescription: {
    fontSize: 14,
    color: '#666666',
  },
  rateContainer: {
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  rateLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 5,
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
    padding: 10,
    fontSize: 16,
    width: 120,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  rateCurrency: {
    marginLeft: 10,
    fontSize: 16,
    color: '#666666',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  termsContainerRTL: {
    flexDirection: 'row-reverse',
  },
  termsText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 10,
    flex: 1,
  },
  termsLink: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginLink: {
    alignItems: 'center',
    marginBottom: 30,
  },
  loginLinkText: {
    fontSize: 14,
    color: '#666666',
  },
  loginLinkHighlight: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default ProviderRegistrationScreen;