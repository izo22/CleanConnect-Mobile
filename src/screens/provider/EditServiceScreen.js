// EditServiceScreen.js - ✅ VERSION COMPLÈTE CORRIGÉE
// ✅ Navigation vers Dashboard qui fonctionne
// ✅ Alert qui s'affiche correctement
// ✅ Logs de debug pour tracer le problème

import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  Text, 
  TextInput as NativeTextInput, 
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { Card } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { providerService } from '../../services/api';
import DropDownPicker from 'react-native-dropdown-picker';
import { useTranslation } from 'react-i18next';

const EditServiceScreen = ({ route }) => {
  console.log('🟣🟣🟣 EditServiceScreen OUVERT 🟣🟣🟣');
  console.log('🟣 Route params:', JSON.stringify(route.params, null, 2));
  
  const navigation = useNavigation();
  const { service } = route.params || {};
  const isEditMode = !!service;
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  console.log('🟣 Service reçu:', service);
  console.log('🟣 Service._id:', service?._id);
  console.log('🟣 IsEditMode:', isEditMode);

  const [loading, setLoading] = useState(false);
  const [type, setType] = useState(service?.type || '');
  const [hourlyRate, setHourlyRate] = useState(service?.hourlyRate?.toString() || '');
  const [description, setDescription] = useState(service?.description || '');
  const [open, setOpen] = useState(false);
  
  const [items, setItems] = useState([
    { label: 'בית פרטי', value: 'בית' },
    { label: 'בניין', value: 'בניין' },
    { label: 'משרד', value: 'משרד' },
    { label: 'Airbnb', value: 'אירבנב' }
  ]);
  
  const [errors, setErrors] = useState({ type: '', hourlyRate: '' });

  console.log('🟣 État initial - type:', type, 'hourlyRate:', hourlyRate);

  const validateForm = () => {
    let isValid = true;
    const newErrors = { type: '', hourlyRate: '' };
    
    if (!type) {
      newErrors.type = 'סוג שירות הוא שדה חובה';
      isValid = false;
    }
    
    if (!hourlyRate) {
      newErrors.hourlyRate = 'מחיר הוא שדה חובה';
      isValid = false;
    } else if (isNaN(hourlyRate) || parseFloat(hourlyRate) <= 0) {
      newErrors.hourlyRate = 'מחיר לא תקין';
      isValid = false;
    }
    
    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    console.log('🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣');
    console.log('🟣 HANDLESUBMIT APPELÉ');
    console.log('🟣 Service._id:', service?._id);
    console.log('🟣 Type:', type);
    console.log('🟣 HourlyRate:', hourlyRate);
    console.log('🟣 Description:', description);
    console.log('🟣 IsEditMode:', isEditMode);
    console.log('🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣');
    
    if (!validateForm()) {
      console.log('❌ Validation échouée');
      return;
    }
    
    setLoading(true);
    
    try {
      const serviceData = { 
        type, 
        hourlyRate: parseFloat(hourlyRate), 
        description 
      };
      
      console.log('🟣 Service data à envoyer:', JSON.stringify(serviceData, null, 2));
      
      if (isEditMode && service._id) {
        console.log('🟣 MODE ÉDITION - Appel providerService.updateService...');
        console.log('🟣 URL sera: /providers/services/' + service._id);
        
        const response = await providerService.updateService(service._id, serviceData);
        
        console.log('🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢');
        console.log('🟢 UPDATE SERVICE RÉUSSI !');
        console.log('🟢 Réponse complète:', JSON.stringify(response, null, 2));
        console.log('🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢');
      } else {
        console.log('🟣 MODE CRÉATION - Appel providerService.addService...');
        
        const response = await providerService.addService(serviceData);
        
        console.log('🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢');
        console.log('🟢 ADD SERVICE RÉUSSI !');
        console.log('🟢 Réponse complète:', JSON.stringify(response, null, 2));
        console.log('🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢');
      }
      
      // ✅ L'API a réussi, maintenant on affiche l'Alert
      console.log('🔔🔔🔔 AFFICHAGE DE L\'ALERT 🔔🔔🔔');
      
      Alert.alert(
        'הצלחה',
        'השירות עודכן בהצלחה',
        [
          {
            text: 'אישור',
            onPress: () => {
              console.log('🎯🎯🎯 BOUTON ALERT CLIQUÉ 🎯🎯🎯');
              console.log('🎯 Tentative de navigation vers Dashboard...');
              console.log('🎯 Navigation object:', navigation);
              console.log('🎯 Parent navigator:', navigation.getParent());
              
              try {
                // ✅ Navigation vers Dashboard via le parent
                const parent = navigation.getParent();
                
                if (parent) {
                  console.log('✅ Parent trouvé, navigation vers Dashboard...');
                  parent.navigate('Dashboard');
                  console.log('✅✅✅ NAVIGATION RÉUSSIE ✅✅✅');
                } else {
                  console.log('⚠️ Pas de parent, utilisation de goBack()');
                  navigation.goBack();
                }
              } catch (navError) {
                console.error('❌ Erreur navigation:', navError);
                console.error('❌ Message:', navError.message);
                // Fallback
                navigation.goBack();
              }
            }
          }
        ]
      );
      
      console.log('🔔 Alert.alert() appelé avec succès');
      
    } catch (error) {
      console.log('🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴');
      console.error('🔴 ERREUR LORS DE LA SAUVEGARDE');
      console.error('🔴 Error message:', error.message);
      console.error('🔴 Error response:', error.response);
      console.error('🔴 Response data:', error.response?.data);
      console.error('🔴 Response status:', error.response?.status);
      console.error('🔴 Error complet:', JSON.stringify(error, null, 2));
      console.log('🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴');
      
      Alert.alert(
        'שגיאה', 
        error.response?.data?.message || error.message || 'לא ניתן לשמור את השירות'
      );
    } finally {
      setLoading(false);
      console.log('🟣 handleSubmit terminé, loading=false');
    }
  };

  // ✅ Bouton Annuler
  const handleCancel = () => {
    console.log('🔙 Bouton Annuler cliqué - goBack()');
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={[styles.title, isRTL && styles.textRTL]}>
              {isEditMode ? 'ערוך שירות' : 'הוסף שירות חדש'}
            </Text>

            {/* Sélecteur de type de service */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                סוג שירות
              </Text>
              <DropDownPicker
                open={open}
                value={type}
                items={items}
                setOpen={setOpen}
                setValue={setType}
                setItems={setItems}
                placeholder="בחר סוג שירות"
                style={[styles.dropdown, errors.type ? styles.errorBorder : null]}
                dropDownContainerStyle={styles.dropdownContainer}
                textStyle={styles.dropdownText}
                zIndex={3000}
                zIndexInverse={1000}
              />
              {errors.type ? (
                <Text style={[styles.errorText, styles.textRTL]}>{errors.type}</Text>
              ) : null}
            </View>

            {/* Prix par heure */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                מחיר לשעה (₪)
              </Text>
              <NativeTextInput
                style={[
                  styles.input, 
                  errors.hourlyRate ? styles.errorBorder : null,
                  styles.textRTL
                ]}
                placeholder="הזן מחיר לשעה"
                value={hourlyRate}
                onChangeText={setHourlyRate}
                keyboardType="numeric"
              />
              {errors.hourlyRate ? (
                <Text style={[styles.errorText, styles.textRTL]}>{errors.hourlyRate}</Text>
              ) : null}
            </View>

            {/* Description */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                תיאור (אופציונלי)
              </Text>
              <NativeTextInput
                style={[styles.input, styles.textArea, styles.textRTL]}
                placeholder="תאר את השירות"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Boutons */}
            <View style={styles.buttonContainer}>
              {/* ✅ BOUTON SAUVEGARDER */}
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {isEditMode ? 'שמור שינויים' : 'הוסף שירות'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* ✅ BOUTON ANNULER */}
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleCancel}
                disabled={loading}
              >
                <Text style={styles.secondaryButtonText}>ביטול</Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 20,
    zIndex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  dropdown: {
    borderColor: '#ddd',
    borderRadius: 8,
  },
  dropdownContainer: {
    borderColor: '#ddd',
  },
  dropdownText: {
    fontSize: 16,
  },
  errorBorder: {
    borderColor: '#e74c3c',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 4,
  },
  buttonContainer: {
    marginTop: 20,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#2E86C1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#ecf0f1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default EditServiceScreen;