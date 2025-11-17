import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { TextInput, Button, Card, Title, HelperText, ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { providerService } from '../../services/api';
import DropDownPicker from 'react-native-dropdown-picker';

const EditServiceScreen = ({ route }) => {
  const navigation = useNavigation();
  const { service, serviceIndex } = route.params || {};
  const isEditMode = !!service;

  const [loading, setLoading] = useState(false);
  const [type, setType] = useState(service?.type || '');
  const [hourlyRate, setHourlyRate] = useState(service?.hourlyRate?.toString() || '');
  const [description, setDescription] = useState(service?.description || '');
  
  // État pour le dropdown
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([
    { label: 'Maison', value: 'maison' },
    { label: 'Immeuble', value: 'immeuble' },
    { label: 'Bureau', value: 'bureau' },
    { label: 'Autre', value: 'autre' }
  ]);

  // Validation des champs
  const [errors, setErrors] = useState({
    type: '',
    hourlyRate: ''
  });

  const validateForm = () => {
    let isValid = true;
    const newErrors = { type: '', hourlyRate: '' };

    if (!type) {
      newErrors.type = 'Veuillez sélectionner un type de service';
      isValid = false;
    }

    if (!hourlyRate) {
      newErrors.hourlyRate = 'Veuillez entrer un tarif horaire';
      isValid = false;
    } else if (isNaN(hourlyRate) || parseFloat(hourlyRate) <= 0) {
      newErrors.hourlyRate = 'Le tarif horaire doit être un nombre positif';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const serviceData = {
        type,
        hourlyRate: parseFloat(hourlyRate),
        description
      };

      let response;
      
      if (isEditMode && service._id) {
        // Mise à jour d'un service existant
        response = await providerService.updateService(service._id, serviceData);
        Alert.alert('Succès', 'Le service a été mis à jour avec succès');
      } else {
        // Ajout d'un nouveau service
        response = await providerService.addService(serviceData);
        Alert.alert('Succès', 'Le service a été ajouté avec succès');
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de la sauvegarde du service'
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
        <Card style={styles.card}>
          <Card.Content>
            <Title>{isEditMode ? 'Modifier le service' : 'Ajouter un service'}</Title>

            <View style={styles.inputContainer}>
              <View style={{ zIndex: 3000 }}>
                <DropDownPicker
                  open={open}
                  value={type}
                  items={items}
                  setOpen={setOpen}
                  setValue={setType}
                  setItems={setItems}
                  placeholder="Sélectionnez un type de service"
                  style={styles.dropdown}
                  dropDownContainerStyle={styles.dropdownContainer}
                />
                {errors.type ? <HelperText type="error">{errors.type}</HelperText> : null}
              </View>

              <View style={styles.inputWrapper}>
                <TextInput
                  label="Tarif horaire (€/h)"
                  value={hourlyRate}
                  onChangeText={setHourlyRate}
                  keyboardType="numeric"
                  style={styles.input}
                  error={!!errors.hourlyRate}
                />
                {errors.hourlyRate ? (
                  <HelperText type="error">{errors.hourlyRate}</HelperText>
                ) : null}
              </View>

              <TextInput
                label="Description (facultatif)"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                style={styles.textArea}
              />
            </View>

            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={loading}
                disabled={loading}
                style={styles.submitButton}
              >
                {isEditMode ? 'Mettre à jour' : 'Ajouter'}
              </Button>
              <Button
                mode="outlined"
                onPress={() => navigation.goBack()}
                disabled={loading}
                style={styles.cancelButton}
              >
                Annuler
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0066CC" />
        </View>
      )}
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
    marginBottom: 16,
  },
  inputContainer: {
    marginTop: 16,
  },
  inputWrapper: {
    marginTop: 16,
  },
  input: {
    marginBottom: 8,
    backgroundColor: 'white',
  },
  dropdown: {
    marginBottom: 8,
    backgroundColor: 'white',
  },
  dropdownContainer: {
    backgroundColor: 'white',
  },
  textArea: {
    marginTop: 16,
    backgroundColor: 'white',
    height: 120,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    marginTop: 24,
    gap: 12,
  },
  submitButton: {
    paddingVertical: 6,
  },
  cancelButton: {
    paddingVertical: 6,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});

export default EditServiceScreen;
