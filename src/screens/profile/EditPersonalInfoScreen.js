// src/screens/profile/EditPersonalInfoScreen.js
// ✅ VERSION CORRIGÉE: Navigation immédiate sans Alert
// ✅ FIX: Ajout des champs ville et adresse pour les clients
import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../../context/AuthContext';
import { providerService } from '../../services/api';
import { useNavigation, useRoute } from '@react-navigation/native';

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
            <Text style={styles.rateCurrency}>₪/שעה</Text>
          </View>
          {error && (
            <Text style={[styles.errorText, isRTL && styles.textRTL]}>{error}</Text>
          )}
        </View>
      )}
    </View>
  );
};

const EditPersonalInfoScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  
  const { profileData, provider } = route.params || {};
  const userData = profileData || provider || {};
  const isProvider = !!provider;
  
  const { updateUserInfo } = useContext(AuthContext);
  const isRTL = true;
  
  const [isLoading, setIsLoading] = useState(false);
  
  // ✅ FIX: Initialisation à partir de serviceDetails (pas services)
  const initializeServices = () => {
    const existingServices = {
      homeCleaning: { selected: false, rate: '' },
      buildingCleaning: { selected: false, rate: '' },
      officeCleaning: { selected: false, rate: '' },
      airbnb: { selected: false, rate: '' }
    };
    
    const hebrewToKey = {
      'בית': 'homeCleaning',
      'בניין': 'buildingCleaning',
      'משרד': 'officeCleaning',
      'אירבנב': 'airbnb'
    };
    
    // ✅ PRIORITÉ 1: Charger depuis serviceDetails (correct)
    if (userData.serviceDetails && Array.isArray(userData.serviceDetails)) {
      console.log('✅ Chargement depuis serviceDetails:', userData.serviceDetails);
      userData.serviceDetails.forEach(service => {
        const key = hebrewToKey[service.type];
        if (key) {
          existingServices[key] = {
            selected: true,
            rate: service.hourlyRate?.toString() || ''
          };
        }
      });
    }
    // ⚠️ FALLBACK: Ancien format avec services
    else if (userData.services && Array.isArray(userData.services)) {
      console.log('⚠️ Chargement depuis services (ancien format):', userData.services);
      userData.services.forEach(service => {
        const key = hebrewToKey[service.type];
        if (key) {
          existingServices[key] = {
            selected: true,
            rate: service.hourlyRate?.toString() || ''
          };
        }
      });
    }
    // ⚠️ FALLBACK: Très ancien format avec serviceTypes
    else if (userData.serviceTypes && Array.isArray(userData.serviceTypes)) {
      console.log('⚠️ Chargement depuis serviceTypes (très ancien format):', userData.serviceTypes);
      userData.serviceTypes.forEach(type => {
        const key = hebrewToKey[type];
        if (key) {
          existingServices[key] = {
            selected: true,
            rate: userData.hourlyRate?.toString() || ''
          };
        }
      });
    }
    
    return existingServices;
  };
  
  const [formData, setFormData] = useState({
    firstName: userData.firstName || '',
    lastName:  userData.lastName  || '',
    email:     userData.email     || '',
    phone:     userData.phone     || '',
    // ✅ FIX: Ajout ville et adresse (clients uniquement)
    city:      userData.city      || '',
    address:   userData.address   || '',
  });
  
  const [services, setServices] = useState(initializeServices());
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    let newErrors = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'שם פרטי נדרש';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'שם משפחה נדרש';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email)) {
      newErrors.email = 'אימייל לא תקין';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'טלפון נדרש';
    } else if (formData.phone.length < 9) {
      newErrors.phone = 'מספר טלפון לא תקין';
    }
    
    if (isProvider) {
      const isAnyServiceSelected = Object.values(services).some(service => service.selected);
      
      if (!isAnyServiceSelected) {
        newErrors.services = 'אנא בחר לפחות סוג שירות אחד';
      } else {
        const serviceRatesErrors = {};
        
        Object.entries(services).forEach(([key, service]) => {
          if (service.selected) {
            if (!service.rate.trim()) {
              serviceRatesErrors[key] = 'תעריף הוא שדה חובה';
            } else if (isNaN(parseFloat(service.rate)) || parseFloat(service.rate) <= 0) {
              serviceRatesErrors[key] = 'נדרש תעריף תקין';
            }
          }
        });
        
        if (Object.keys(serviceRatesErrors).length > 0) {
          newErrors.serviceRates = serviceRatesErrors;
        }
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value,
    });
    
    if (errors[field]) {
      setErrors({
        ...errors,
        [field]: null,
      });
    }
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

  const handleSubmit = async () => {
    if (validateForm()) {
      setIsLoading(true);
      
      try {
        const updatedData = {
          firstName: formData.firstName,
          lastName:  formData.lastName,
          email:     formData.email,
          phone:     formData.phone,
        };
        
        if (isProvider) {
          // ✅ FIX: Préparer serviceDetails pour l'API
          const serviceTypeMapping = {
            homeCleaning:     'בית',
            buildingCleaning: 'בניין',
            officeCleaning:   'משרד',
            airbnb:           'אירבנב'
          };
          
          const selectedServices = Object.entries(services)
            .filter(([_, service]) => service.selected)
            .map(([key, service]) => ({
              type: serviceTypeMapping[key],
              hourlyRate: parseFloat(service.rate)
            }));
          
          // ✅ Le backend calculera automatiquement hourlyRate
          updatedData.serviceTypes   = selectedServices.map(service => service.type);
          updatedData.serviceDetails = selectedServices;
          
          console.log('📤 ===== ENVOI DES DONNÉES AU BACKEND =====');
          console.log('   serviceDetails:', JSON.stringify(updatedData.serviceDetails, null, 2));
          console.log('   serviceTypes:', updatedData.serviceTypes);
          console.log('===========================================');
          
          await providerService.updateProfile(updatedData);
          console.log('✅ API appelée avec succès');
          
          setIsLoading(false);
          
          console.log('🎯🎯🎯 Navigation vers Dashboard Provider...');
          const parent = navigation.getParent();
          
          if (parent) {
            console.log('✅ Parent trouvé, navigation vers Dashboard...');
            parent.navigate('Dashboard');
            console.log('✅✅✅ NAVIGATION RÉUSSIE ✅✅✅');
          } else {
            console.log('⚠️ Pas de parent navigator, utilisation de goBack()');
            navigation.goBack();
          }
          
        } else {
          // ✅ FIX: Inclure ville et adresse pour les clients
          updatedData.city    = formData.city;
          updatedData.address = formData.address;

          console.log('📤 Mise à jour profil client:', updatedData);

          updateUserInfo({ ...userData, ...updatedData });
          setIsLoading(false);
          
          console.log('🔙 Client: goBack()');
          navigation.goBack();
        }
        
      } catch (error) {
        console.log('🔴🔴🔴 ERREUR CAPTURÉE 🔴🔴🔴');
        setIsLoading(false);
        console.error('❌ Error updating profile:', error);
        Alert.alert('שגיאה', error.message || 'לא ניתן לעדכן את הפרטים');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-forward" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, styles.textRTL]}>
              עריכת פרטים אישיים
            </Text>
            <View style={styles.placeholderButton} />
          </View>

          <View style={styles.formContainer}>
            {/* שם פרטי */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, styles.textRTL]}>שם פרטי</Text>
              <TextInput
                style={[styles.input, errors.firstName ? styles.inputError : null, styles.inputRTL]}
                value={formData.firstName}
                onChangeText={(text) => handleChange('firstName', text)}
                placeholder="הזן שם פרטי"
                autoCapitalize="words"
              />
              {errors.firstName ? (
                <Text style={[styles.errorText, styles.textRTL]}>{errors.firstName}</Text>
              ) : null}
            </View>

            {/* שם משפחה */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, styles.textRTL]}>שם משפחה</Text>
              <TextInput
                style={[styles.input, errors.lastName ? styles.inputError : null, styles.inputRTL]}
                value={formData.lastName}
                onChangeText={(text) => handleChange('lastName', text)}
                placeholder="הזן שם משפחה"
                autoCapitalize="words"
              />
              {errors.lastName ? (
                <Text style={[styles.errorText, styles.textRTL]}>{errors.lastName}</Text>
              ) : null}
            </View>

            {/* אימייל */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, styles.textRTL]}>אימייל</Text>
              <TextInput
                style={[styles.input, errors.email ? styles.inputError : null]}
                value={formData.email}
                onChangeText={(text) => handleChange('email', text)}
                placeholder="email@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email ? (
                <Text style={[styles.errorText, styles.textRTL]}>{errors.email}</Text>
              ) : null}
            </View>

            {/* טלפון */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, styles.textRTL]}>טלפון</Text>
              <TextInput
                style={[styles.input, errors.phone ? styles.inputError : null]}
                value={formData.phone}
                onChangeText={(text) => handleChange('phone', text)}
                placeholder="05X-XXXXXXX"
                keyboardType="phone-pad"
              />
              {errors.phone ? (
                <Text style={[styles.errorText, styles.textRTL]}>{errors.phone}</Text>
              ) : null}
            </View>

            {/* ✅ FIX: Champs ville + adresse (clients uniquement) */}
            {!isProvider && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, styles.textRTL]}>עיר</Text>
                  <TextInput
                    style={[styles.input, styles.inputRTL]}
                    value={formData.city}
                    onChangeText={(text) => handleChange('city', text)}
                    placeholder="הזן עיר"
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, styles.textRTL]}>כתובת</Text>
                  <TextInput
                    style={[styles.input, styles.inputRTL]}
                    value={formData.address}
                    onChangeText={(text) => handleChange('address', text)}
                    placeholder="רחוב ומספר בית"
                    autoCapitalize="words"
                  />
                </View>
              </>
            )}

            {/* ✅ SECTION SERVICES (seulement pour providers) */}
            {isProvider && (
              <View style={styles.servicesSection}>
                <Text style={[styles.sectionTitle, styles.textRTL]}>
                  סוגי שירותים
                </Text>
                <Text style={[styles.sectionSubtitle, styles.textRTL]}>
                  בחר את סוגי השירותים שאתה מציע והזן את התעריף השעתי
                </Text>
                
                {errors.services && (
                  <Text style={[styles.errorText, styles.textRTL]}>
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
            )}

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.saveButtonText, styles.textRTL]}>
                  שמור שינויים
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholderButton: {
    width: 40,
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    margin: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  textRTL: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  servicesSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  serviceTypeItem: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  serviceTypeSelected: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#3498db',
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
    borderColor: '#3498db',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  serviceTypeCheckboxSelected: {
    backgroundColor: '#3498db',
  },
  serviceTypeContent: {
    flex: 1,
  },
  serviceTypeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  serviceTypeDescription: {
    fontSize: 14,
    color: '#666',
  },
  rateContainer: {
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  rateLabel: {
    fontSize: 14,
    color: '#666',
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
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    width: 120,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  rateCurrency: {
    marginLeft: 10,
    fontSize: 16,
    color: '#666',
  },
});

export default EditPersonalInfoScreen;