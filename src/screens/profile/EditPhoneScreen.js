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

const EditPhoneScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { phone: initialPhone } = route.params;
  const { userInfo, updateUserInfo } = useContext(AuthContext);
  
  const [phone, setPhone] = useState(initialPhone || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Validation du numéro de téléphone
  const validatePhone = () => {
    // Regex simple pour les numéros de téléphone israéliens
    // Format: +972 XX XXX XXXX or 05X-XXX-XXXX
    const phoneRegex = /^(\+972|0)([56789])([0-9]{7,8})$/;
    
    // Supprimer tous les caractères non-numériques sauf le +
    const cleanedPhone = phone.replace(/[^0-9+]/g, '');
    
    if (!cleanedPhone) {
      setError('Le numéro de téléphone est requis');
      return false;
    }
    
    if (!phoneRegex.test(cleanedPhone)) {
      setError('Format de numéro de téléphone invalide');
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
      
      // Simuler une requête API
      setTimeout(() => {
        updateUserInfo({
          ...userInfo,
          phone,
        });
        
        setIsLoading(false);
        Alert.alert(
          'Mise à jour réussie',
          'Votre numéro de téléphone a été mis à jour.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
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
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Modifier le téléphone</Text>
          <View style={styles.placeholderButton} />
        </View>

        <View style={styles.content}>
          <View style={styles.formContainer}>
            <Text style={styles.label}>Numéro de téléphone</Text>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              value={phone}
              onChangeText={handlePhoneChange}
              placeholder="+972 XX XXX XXXX ou 05X-XXX-XXXX"
              keyboardType="phone-pad"
              editable={!isLoading}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            
            <Text style={styles.helpText}>
              Entrez un numéro de téléphone israélien valide,
              par exemple +972 54 123 4567 ou 054-123-4567
            </Text>
          </View>

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
  inputError: {
    borderColor: '#e74c3c',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 4,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
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
});

export default EditPhoneScreen;
