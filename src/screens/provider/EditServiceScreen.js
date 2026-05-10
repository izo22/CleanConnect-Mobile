// screens/provider/EditServiceScreen.js
// ✅ Multi-services : 4 types avec checkbox + tarif individuel
// ✅ CityMultiSelector : toutes les villes d'Israël (même composant que l'inscription)
// ✅ Sauvegarde en un seul appel via updateProfile

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { providerService } from '../../services/api';
import CityMultiSelector from '../../components/CityMultiSelector';

// ─── Correspondance clé → valeur hébreu ────────────────────────────────────
const SERVICE_TYPE_MAP = {
  homeCleaning:     'בית',
  buildingCleaning: 'בניין',
  officeCleaning:   'משרד',
  airbnb:           'אירבנב',
};

const SERVICE_LABELS = {
  homeCleaning:     { title: 'ניקיון בית',     description: 'ניקיון דירות, בתים פרטיים ומגורים' },
  buildingCleaning: { title: 'ניקיון בניינים', description: 'ניקיון חדרי מדרגות, מבואות וחלקים משותפים' },
  officeCleaning:   { title: 'ניקיון משרדים',  description: 'ניקיון משרדים ומקומות עבודה' },
  airbnb:           { title: 'ניקיון אירבנב',  description: 'ניקיון דירות אירבנב בין check-out לcheck-in' },
};

// ─── Initialise l'état des services depuis serviceDetails existants ─────────
const initServices = (serviceDetails = []) => {
  const initial = {
    homeCleaning:     { selected: false, rate: '' },
    buildingCleaning: { selected: false, rate: '' },
    officeCleaning:   { selected: false, rate: '' },
    airbnb:           { selected: false, rate: '' },
  };

  serviceDetails.forEach(detail => {
    const key = Object.keys(SERVICE_TYPE_MAP).find(
      k => SERVICE_TYPE_MAP[k] === detail.type
    );
    if (key) {
      initial[key] = {
        selected: true,
        rate: detail.hourlyRate?.toString() || '',
      };
    }
  });

  return initial;
};

// ─── Composant ServiceTypeItem (identique à l'inscription) ─────────────────
const ServiceTypeItem = ({ serviceKey, service, toggleService, updateRate, error }) => {
  const { title, description } = SERVICE_LABELS[serviceKey];

  return (
    <View style={[styles.serviceTypeItem, service.selected && styles.serviceTypeSelected]}>
      <TouchableOpacity
        style={styles.serviceTypeHeader}
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
          <Text style={[styles.serviceTypeTitle, styles.textRTL]}>{title}</Text>
          <Text style={[styles.serviceTypeDescription, styles.textRTL]}>{description}</Text>
        </View>
      </TouchableOpacity>

      {service.selected && (
        <View style={styles.rateContainer}>
          <Text style={[styles.rateLabel, styles.textRTL]}>תעריף לשעה:</Text>
          <View style={styles.rateInputContainer}>
            <TextInput
              style={[styles.rateInput, error && styles.inputError]}
              value={service.rate}
              onChangeText={(text) => updateRate(serviceKey, text.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
            <Text style={styles.rateCurrency}>₪/h</Text>
          </View>
          {error && (
            <Text style={[styles.errorText, styles.textRTL]}>{error}</Text>
          )}
        </View>
      )}
    </View>
  );
};

// ─── Écran principal ────────────────────────────────────────────────────────
const EditServiceScreen = ({ route }) => {
  const navigation = useNavigation();
  const { serviceDetails: initialDetails, serviceAreas: initialAreas } = route.params || {};

  const [services, setServices] = useState(() => initServices(initialDetails));
  const [serviceCities, setServiceCities] = useState(initialAreas || []);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const toggleService = (key) => {
    setServices(prev => ({
      ...prev,
      [key]: { ...prev[key], selected: !prev[key].selected }
    }));
  };

  const updateRate = (key, rate) => {
    setServices(prev => ({
      ...prev,
      [key]: { ...prev[key], rate }
    }));
  };

  const validate = () => {
    const newErrors = {};
    let isValid = true;

    const anySelected = Object.values(services).some(s => s.selected);
    if (!anySelected) {
      newErrors.services = 'אנא בחר לפחות סוג שירות אחד';
      isValid = false;
    }

    const rateErrors = {};
    Object.entries(services).forEach(([key, s]) => {
      if (s.selected) {
        if (!s.rate.trim()) {
          rateErrors[key] = 'תעריף הוא שדה חובה';
          isValid = false;
        } else if (isNaN(parseFloat(s.rate)) || parseFloat(s.rate) <= 0) {
          rateErrors[key] = 'נדרש תעריף תקין';
          isValid = false;
        }
      }
    });
    if (Object.keys(rateErrors).length > 0) newErrors.serviceRates = rateErrors;

    if (serviceCities.length === 0) {
      newErrors.serviceCities = 'אנא בחר לפחות עיר אחת';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      // Construit serviceDetails depuis l'état
      const serviceDetails = Object.entries(services)
        .filter(([_, s]) => s.selected)
        .map(([key, s]) => ({
          type: SERVICE_TYPE_MAP[key],
          hourlyRate: parseFloat(s.rate),
          description: '',
        }));

      const serviceTypes = serviceDetails.map(s => s.type);

      const avgRate = serviceDetails.reduce((sum, s) => sum + s.hourlyRate, 0) / serviceDetails.length;

      // Un seul appel API — met tout à jour d'un coup
      await providerService.updateProfile({
        serviceDetails,
        serviceTypes,
        serviceAreas: serviceCities,
        hourlyRate: avgRate,
      });

      Alert.alert('הצלחה', 'הפרופיל עודכן בהצלחה', [
        {
          text: 'אישור',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('❌ Erreur EditService:', error.response?.data || error.message);
      Alert.alert(
        'שגיאה',
        error.response?.data?.message || error.message || 'לא ניתן לשמור את השינויים'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        {/* ── Section services ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.textRTL]}>סוגי שירותים</Text>
          <Text style={[styles.sectionSubtitle, styles.textRTL]}>
            בחר את השירותים שאתה מציע והזן את התעריף השעתי לכל אחד
          </Text>

          {errors.services && (
            <Text style={[styles.errorText, styles.textRTL]}>{errors.services}</Text>
          )}

          {Object.keys(SERVICE_LABELS).map(key => (
            <ServiceTypeItem
              key={key}
              serviceKey={key}
              service={services[key]}
              toggleService={toggleService}
              updateRate={updateRate}
              error={errors.serviceRates?.[key]}
            />
          ))}
        </View>

        {/* ── Section villes ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.textRTL]}>ערים בהן אתה מספק שירות</Text>
          <Text style={[styles.sectionSubtitle, styles.textRTL]}>
            בחר את הערים שבהן אתה מעוניין לספק שירותים
          </Text>

          {errors.serviceCities && (
            <Text style={[styles.errorText, styles.textRTL]}>{errors.serviceCities}</Text>
          )}

          <View style={[
            styles.citySelectorContainer,
            errors.serviceCities && styles.inputError
          ]}>
            <CityMultiSelector
              selectedCities={serviceCities}
              onChange={setServiceCities}
            />
          </View>
        </View>

        {/* ── Boutons ── */}
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>שמור שינויים</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>ביטול</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },

  // ── Sections ──
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: '#111827',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 17,
  },

  // ── Service items ──
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
    flexDirection: 'row-reverse',
    alignItems: 'center',
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
    marginLeft: 12,
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
    color: '#111827',
    marginBottom: 4,
  },
  serviceTypeDescription: {
    fontSize: 12,
    color: '#6B7280',
  },

  // ── Rate ──
  rateContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  rateLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  rateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rateInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 14,
    width: 100,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: '#111827',
  },
  rateCurrency: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },

  // ── City selector ──
  citySelectorContainer: {
    height: 400,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },

  // ── Erreurs ──
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  inputError: {
    borderColor: '#EF4444',
  },

  // ── Boutons ──
  primaryButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  secondaryButton: {
    backgroundColor: '#F9FAFB',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // ── RTL ──
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default EditServiceScreen;