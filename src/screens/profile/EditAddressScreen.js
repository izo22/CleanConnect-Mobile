import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

const EditAddressScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { address, onSave } = route.params || {};
  const isEditing = !!address;
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: address?.name || '',
    street: address?.street || '',
    city: address?.city || '',
    postalCode: address?.postalCode || '',
    isDefault: address?.isDefault || false,
  });
  
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    let newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = t('editAddress.errors.nameRequired');
    }
    
    if (!formData.street.trim()) {
      newErrors.street = t('editAddress.errors.streetRequired');
    }
    
    if (!formData.city.trim()) {
      newErrors.city = t('editAddress.errors.cityRequired');
    }
    
    if (!formData.postalCode.trim()) {
      newErrors.postalCode = t('editAddress.errors.postalCodeRequired');
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

  const handleSubmit = () => {
    if (validateForm()) {
      setIsLoading(true);
      
      setTimeout(() => {
        const updatedAddress = {
          ...(address || {}),
          ...formData,
        };
        
        onSave(updatedAddress);
        setIsLoading(false);
        navigation.goBack();
      }, 1000);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color="#1B2A36" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>
            {isEditing ? t('editAddress.titleEdit') : t('editAddress.titleAdd')}
          </Text>
          <View style={styles.placeholderButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.formContainer}>
            {/* Nom */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                {t('editAddress.labels.name')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  errors.name ? styles.inputError : null,
                  isRTL && styles.inputRTL
                ]}
                value={formData.name}
                onChangeText={(text) => handleChange('name', text)}
                placeholder={t('editAddress.placeholders.name')}
              />
              {errors.name ? (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                  {errors.name}
                </Text>
              ) : null}
            </View>

            {/* Rue */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                {t('editAddress.labels.street')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  errors.street ? styles.inputError : null,
                  isRTL && styles.inputRTL
                ]}
                value={formData.street}
                onChangeText={(text) => handleChange('street', text)}
                placeholder={t('editAddress.placeholders.street')}
              />
              {errors.street ? (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                  {errors.street}
                </Text>
              ) : null}
            </View>

            {/* Ville */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                {t('editAddress.labels.city')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  errors.city ? styles.inputError : null,
                  isRTL && styles.inputRTL
                ]}
                value={formData.city}
                onChangeText={(text) => handleChange('city', text)}
                placeholder={t('editAddress.placeholders.city')}
              />
              {errors.city ? (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                  {errors.city}
                </Text>
              ) : null}
            </View>

            {/* Code postal */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                {t('editAddress.labels.postalCode')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  errors.postalCode ? styles.inputError : null,
                  isRTL && styles.inputRTL
                ]}
                value={formData.postalCode}
                onChangeText={(text) => handleChange('postalCode', text)}
                placeholder={t('editAddress.placeholders.postalCode')}
                keyboardType="number-pad"
              />
              {errors.postalCode ? (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                  {errors.postalCode}
                </Text>
              ) : null}
            </View>

            {/* Par défaut */}
            <View style={[styles.switchContainer, isRTL && styles.switchContainerRTL]}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                {t('editAddress.labels.isDefault')}
              </Text>
              <Switch
                value={formData.isDefault}
                onValueChange={(value) => handleChange('isDefault', value)}
                trackColor={{ false: '#DCE8F1', true: '#5BA4D9' }}
                thumbColor={formData.isDefault ? '#256FA8' : '#f4f3f4'}
              />
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.saveButtonText, isRTL && styles.textRTL]}>
                  {t('editAddress.save')}
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
  container: { flex: 1, backgroundColor: '#F6FAFD' },
  keyboardAvoidingView: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#EEF3F7' },
  backButton: { padding: 8, borderRadius: 999 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  placeholderButton: { width: 40, borderRadius: 999 },
  scrollContainer: { flexGrow: 1, padding: 16 },
  formContainer: { backgroundColor: 'white', borderRadius: 16, padding: 16, shadowColor: '#1B4F7A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  inputGroup: { marginBottom: 20, backgroundColor: '#F4F8FB', borderColor: '#E1ECF4', borderWidth: 1, borderRadius: 16 },
  label: { fontSize: 16, marginBottom: 8, fontWeight: '500', color: '#1B2A36' },
  input: { borderWidth: 1, borderColor: '#E1ECF4', borderRadius: 16, padding: 12, fontSize: 16, backgroundColor: '#F4F8FB' },
  inputRTL: { textAlign: 'right', writingDirection: 'rtl', backgroundColor: '#F4F8FB', borderColor: '#E1ECF4', borderWidth: 1, borderRadius: 16 },
  inputError: { borderColor: '#e74c3c' },
  errorText: { color: '#e74c3c', fontSize: 12, marginTop: 4 },
  switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  switchContainerRTL: { flexDirection: 'row-reverse' },
  saveButton: { backgroundColor: '#256FA8', borderRadius: 999, padding: 15, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  textRTL: { writingDirection: 'rtl', textAlign: 'right' },
});

export default EditAddressScreen;