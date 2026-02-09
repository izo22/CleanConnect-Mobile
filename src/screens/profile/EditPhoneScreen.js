import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';

const EditPhoneScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { phone: initialPhone } = route.params;
  const { userInfo, updateUserInfo } = useContext(AuthContext);
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  
  const [phone, setPhone] = useState(initialPhone || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Validation du numéro de téléphone
  const validatePhone = () => {
    const phoneRegex = /^(\+972|0)([56789])([0-9]{7,8})$/;
    const cleanedPhone = phone.replace(/[^0-9+]/g, '');
    
    if (!cleanedPhone) {
      setError(t('editPhone.errors.required'));
      return false;
    }
    
    if (!phoneRegex.test(cleanedPhone)) {
      setError(t('editPhone.errors.invalid'));
      return false;
    }
    
    setError(null);
    return true;
  };

  // Gérer le changement de numéro de téléphone
  const handlePhoneChange = (text) => {
    setPhone(text);
    if (error) {
      setError(null);
    }
  };

  // Soumettre le formulaire
  const handleSubmit = () => {
    if (validatePhone()) {
      setIsLoading(true);
      
      setTimeout(() => {
        updateUserInfo({
          ...userInfo,
          phone,
        });
        
        setIsLoading(false);
        Alert.alert(
          t('editPhone.successTitle'),
          t('editPhone.successMessage'),
          [{ text: t('editPhone.ok'), onPress: () => navigation.goBack() }]
        );
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
            disabled={isLoading}
          >
            <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color="#333" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>
            {t('editPhone.title')}
          </Text>
          <View style={styles.placeholderButton} />
        </View>

        <View style={styles.content}>
          <View style={styles.formContainer}>
            <Text style={[styles.label, isRTL && styles.textRTL]}>
              {t('editPhone.label')}
            </Text>
            <TextInput
              style={[
                styles.input,
                error ? styles.inputError : null,
                isRTL && styles.inputRTL
              ]}
              value={phone}
              onChangeText={handlePhoneChange}
              placeholder={t('editPhone.placeholder')}
              keyboardType="phone-pad"
              editable={!isLoading}
            />
            {error ? (
              <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                {error}
              </Text>
            ) : null}
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
                {t('editPhone.save')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
  content: {
    flex: 1,
    padding: 16,
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
});

export default EditPhoneScreen;