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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

const EditAddressScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { address, onSave } = route.params || {};
  const isEditing = !!address;
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: address?.name || '',
    street: address?.street || '',
    city: address?.city || '',
    postalCode: address?.postalCode || '',
    isDefault: address?.isDefault || false,
  });
  
  const [errors, setErrors] = useState({});

  // Validation du formulaire
  const validateForm = () => {
    let newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }
    
    if (!formData.street.trim()) {
      newErrors.street = 'L\'adresse est requise';
    }
    
    if (!formData.city.trim()) {
      newErrors.city = 'La ville est requise';
    }
    
    if (!formData.postalCode.trim()) {
      newErrors.postalCode = 'Le code postal est requis';
    } else if (!/^\d{5,7}$/.test(formData.postalCode.replace(/\s/g, ''))) {
      newErrors.postalCode = 'Code postal invalide';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Gérer les changements de champs
  const handleChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value,
    });
    
    // Effacer l'erreur lorsque l'utilisateur commence à modifier
    if (errors[field]) {
      setErrors({
        ...errors,
        [field]: null,
      });
    }
  };

  // Soumettre le formulaire
  const handleSubmit = () => {
    if (validateForm()) {
      setIsLoading(true);
      
      // Simuler une requête API
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
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Modifier l\'adresse' : 'Ajouter une adresse'}
          </Text>
          <View style={styles.placeholderButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.formContainer}>
            {/* Nom de l'adresse */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nom de l'adresse</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.name ? styles.inputError : null,
                ]}
                value={formData.name}
                onChangeText={(text) => handleChange('name', text)}
                placeholder="Ex: Domicile, Bureau, etc."
              />
              {errors.name ? (
                <Text style={styles.errorText}>{errors.name}</Text>
              ) : null}
            </View>

            {/* Rue */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Adresse</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.street ? styles.inputError : null,
                ]}
                value={formData.street}
                onChangeText={(text) => handleChange('street', text)}
                placeholder="Numéro et nom de rue"
              />
              {errors.street ? (
                <Text style={styles.errorText}>{errors.street}</Text>
              ) : null}
            </View>

            {/* Ville */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ville</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.city ? styles.inputError : null,
                ]}
                value={formData.city}
                onChangeText={(text) => handleChange('city', text)}
                placeholder="Ville"
              />
              {errors.city ? (
                <Text style={styles.errorText}>{errors.city}</Text>
              ) : null}
            </View>

            {/* Code postal */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Code postal</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.postalCode ? styles.inputError : null,
                ]}
                value={formData.postalCode}
                onChangeText={(text) => handleChange('postalCode', text)}
                placeholder="Code postal"
                keyboardType="number-pad"
              />
              {errors.postalCode ? (
                <Text style={styles.errorText}>{errors.postalCode}</Text>
              ) : null}
            </View>

            {/* Option d'adresse par défaut */}
            <TouchableOpacity
              style={styles.defaultOption}
              onPress={() => handleChange('isDefault', !formData.isDefault)}
            >
              <View style={styles.checkboxContainer}>
                <View style={[
                  styles.checkbox,
                  formData.isDefault ? styles.checkboxChecked : {},
                ]}>
                  {formData.isDefault && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  Définir comme adresse par défaut
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Enregistrer</Text>
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
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
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
  inputError: {
    borderColor: '#e74c3c',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 4,
  },
  defaultOption: {
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3498db',
  },
  checkboxLabel: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
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
});

export default EditAddressScreen;
