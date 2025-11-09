// src/screens/auth/ProviderRegistrationScreen.js
// ✅ MODIFIÉ - Intégration du sélecteur multi-villes

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
import CityMultiSelector from '../../components/CityMultiSelector'; // ✅ NOUVEAU

// Composant pour les éléments de service
const ServiceTypeItem = ({ 
  serviceKey, 
  service, 
  title, 
  description, 
  toggleService, 
  updateRate,
  error
}) => {
  return (
    <View style={[
      styles.serviceTypeItem, 
      service.selected && styles.serviceTypeSelected
    ]}>
      {/* Zone cliquable pour la sélection du service */}
      <TouchableOpacity 
        style={styles.serviceTypeHeader}
        onPress={() => toggleService(serviceKey)}
      >
        <View style={styles.serviceTypeCheckbox}>
          {service.selected && (
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          )}
        </View>
        <View style={styles.serviceTypeContent}>
          <Text style={styles.serviceTypeTitle}>{title}</Text>
          <Text style={styles.serviceTypeDescription}>{description}</Text>
        </View>
      </TouchableOpacity>
      
      {/* Zone séparée pour le taux horaire */}
      {service.selected && (
        <View style={styles.rateContainer}>
          <Text style={styles.rateLabel}>Taux horaire :</Text>
          <View style={styles.rateInputContainer}>
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
            <Text style={styles.errorText}>{error}</Text>
          )}
        </View>
      )}
    </View>
  );
};

const ProviderRegistrationScreen = ({ navigation }) => {
  // Contexte d'authentification
  const { registerProvider } = useContext(AuthContext);

  // États pour les champs du formulaire
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // États pour les services et leurs taux horaires
  const [services, setServices] = useState({
    homeCleaning: { selected: false, rate: '' },
    buildingCleaning: { selected: false, rate: '' },
    officeCleaning: { selected: false, rate: '' }
  });
  
  // ✅ NOUVEAU - État pour les villes de service
  const [serviceCities, setServiceCities] = useState([]);
  
  // Vérifier si au moins un type de service est sélectionné
  const isAnyServiceSelected = Object.values(services).some(service => service.selected);
  
  // État pour les conditions générales
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Erreurs de validation
  const [errors, setErrors] = useState({});
  
  // Fonction pour basculer un type de service
  const toggleServiceType = (type) => {
    setServices(prevState => ({
      ...prevState,
      [type]: {
        ...prevState[type],
        selected: !prevState[type].selected
      }
    }));
    
    // Effacer l'erreur si au moins un type de service est sélectionné
    if (!services[type].selected) {
      setErrors(prev => ({ ...prev, services: null }));
    }
  };

  // Fonction pour mettre à jour le taux horaire d'un service
  const updateServiceRate = (type, rate) => {
    setServices(prevState => ({
      ...prevState,
      [type]: {
        ...prevState[type],
        rate: rate.replace(/[^0-9.]/g, '') // Accepter uniquement des chiffres et le point
      }
    }));
    
    // Effacer l'erreur associée à ce taux si une valeur est fournie
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

  // Validation des champs du formulaire
  const validateForm = () => {
    let tempErrors = {};
    let isValid = true;
    
    // Valider le prénom
    if (!firstName.trim()) {
      tempErrors.firstName = 'Le prénom est requis';
      isValid = false;
    }
    
    // Valider le nom
    if (!lastName.trim()) {
      tempErrors.lastName = 'Le nom est requis';
      isValid = false;
    }
    
    // Valider l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      tempErrors.email = 'Email invalide';
      isValid = false;
    }
    
    // Valider le téléphone
    if (!phone.trim()) {
      tempErrors.phone = 'Le téléphone est requis';
      isValid = false;
    }
    
    // Valider le mot de passe
    if (password.length < 6) {
      tempErrors.password = 'Le mot de passe doit contenir au moins 6 caractères';
      isValid = false;
    }
    
    // Valider la confirmation du mot de passe
    if (password !== confirmPassword) {
      tempErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
      isValid = false;
    }
    
    // Valider les types de services et leurs taux
    if (!isAnyServiceSelected) {
      tempErrors.services = 'Veuillez sélectionner au moins un type de service';
      isValid = false;
    } else {
      // Vérifier que chaque service sélectionné a un taux horaire valide
      const serviceRatesErrors = {};
      
      Object.entries(services).forEach(([key, service]) => {
        if (service.selected) {
          if (!service.rate.trim()) {
            serviceRatesErrors[key] = 'Taux horaire requis';
            isValid = false;
          } else if (isNaN(parseFloat(service.rate)) || parseFloat(service.rate) <= 0) {
            serviceRatesErrors[key] = 'Taux horaire invalide';
            isValid = false;
          }
        }
      });
      
      if (Object.keys(serviceRatesErrors).length > 0) {
        tempErrors.serviceRates = serviceRatesErrors;
      }
    }
    
    // ✅ VALIDATION DES VILLES
    if (serviceCities.length === 0) {
      tempErrors.serviceCities = 'Veuillez sélectionner au moins une ville';
      isValid = false;
    }
    
    // Valider les conditions générales
    if (!termsAccepted) {
      tempErrors.terms = 'Vous devez accepter les conditions générales';
      isValid = false;
    }
    
    setErrors(tempErrors);
    return isValid;
  };

  // Fonction pour gérer la soumission du formulaire
  const handleSubmit = () => {
    if (validateForm()) {
      // Mapper les types de services locaux aux valeurs attendues par le modèle
      const serviceTypeMapping = {
        homeCleaning: 'maison',
        buildingCleaning: 'immeuble',
        officeCleaning: 'bureau'
      };
      
      // Créer un tableau des services sélectionnés avec leurs taux
      const selectedServices = Object.entries(services)
        .filter(([_, service]) => service.selected)
        .map(([key, service]) => ({
          type: serviceTypeMapping[key],
          hourlyRate: parseFloat(service.rate)
        }));
      
      // Calculer un taux horaire moyen
      const averageHourlyRate = selectedServices.reduce(
        (sum, service) => sum + service.hourlyRate, 
        0
      ) / selectedServices.length;
      
      const userData = {
        firstName,
        lastName,
        email,
        phone,
        password,
        userType: 'provider',
        hourlyRate: averageHourlyRate,
        serviceTypes: selectedServices.map(service => service.type),
        serviceCities: serviceCities, // ✅ AJOUT DES VILLES
        serviceAreas: serviceCities, // Pour compatibilité
        services: selectedServices
      };
      
      console.log('📝 Données d\'inscription prestataire:', userData);
      
      // Appeler la fonction d'inscription du contexte d'authentification
      registerProvider(userData)
        .then(() => {
          Alert.alert(
            'Inscription réussie',
            'Votre compte a été créé avec succès.',
            [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
          );
        })
        .catch(error => {
          Alert.alert('Erreur', error.message || 'Une erreur est survenue lors de l\'inscription');
        });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Inscription Prestataire</Text>
            <Text style={styles.subtitle}>Créez votre compte et proposez vos services</Text>
          </View>
          
          {/* Informations personnelles */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Informations personnelles</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Prénom</Text>
              <TextInput
                style={[styles.input, errors.firstName ? styles.inputError : null]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Votre prénom"
              />
              {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nom</Text>
              <TextInput
                style={[styles.input, errors.lastName ? styles.inputError : null]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Votre nom"
              />
              {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, errors.email ? styles.inputError : null]}
                value={email}
                onChangeText={setEmail}
                placeholder="votre@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Téléphone</Text>
              <TextInput
                style={[styles.input, errors.phone ? styles.inputError : null]}
                value={phone}
                onChangeText={setPhone}
                placeholder="05X-XXX-XXXX"
                keyboardType="phone-pad"
              />
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
            </View>
          </View>
          
          {/* Types de services */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Types de services proposés</Text>
            <Text style={styles.sectionSubtitle}>Sélectionnez un ou plusieurs types de services que vous proposez et indiquez votre taux horaire pour chacun</Text>
            
            {errors.services && <Text style={styles.errorText}>{errors.services}</Text>}
            
            <ServiceTypeItem
              serviceKey="homeCleaning"
              service={services.homeCleaning}
              title="Nettoyage de maison privée"
              description="Nettoyage complet ou partiel de maisons et appartements"
              toggleService={toggleServiceType}
              updateRate={updateServiceRate}
              error={errors.serviceRates?.homeCleaning}
            />
            
            <ServiceTypeItem
              serviceKey="buildingCleaning"
              service={services.buildingCleaning}
              title="Nettoyage d'immeuble"
              description="Entretien des parties communes et des halls d'immeubles"
              toggleService={toggleServiceType}
              updateRate={updateServiceRate}
              error={errors.serviceRates?.buildingCleaning}
            />
            
            <ServiceTypeItem
              serviceKey="officeCleaning"
              service={services.officeCleaning}
              title="Nettoyage de bureau"
              description="Entretien d'espaces de travail et locaux professionnels"
              toggleService={toggleServiceType}
              updateRate={updateServiceRate}
              error={errors.serviceRates?.officeCleaning}
            />
          </View>
          
          {/* ✅ NOUVELLE SECTION - VILLES DE SERVICE */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Villes où vous proposez vos services *</Text>
            <Text style={styles.sectionSubtitle}>
              Cochez toutes les villes où vous êtes prêt à intervenir. Vous pouvez choisir une seule ville, plusieurs villes, ou même des banlieues sans la ville principale.
            </Text>
            
            {errors.serviceCities && <Text style={styles.errorText}>{errors.serviceCities}</Text>}
            
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
          
          {/* Mot de passe */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Sécurité</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mot de passe</Text>
              <TextInput
                style={[styles.input, errors.password ? styles.inputError : null]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Minimum 6 caractères"
              />
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirmer le mot de passe</Text>
              <TextInput
                style={[styles.input, errors.confirmPassword ? styles.inputError : null]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Répétez votre mot de passe"
              />
              {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
            </View>
          </View>
          
          {/* Conditions générales */}
          <View style={styles.termsContainer}>
            <Switch
              value={termsAccepted}
              onValueChange={setTermsAccepted}
              trackColor={{ false: "#D1D1D6", true: "#4CD964" }}
            />
            <TouchableOpacity onPress={() => setTermsAccepted(!termsAccepted)}>
              <Text style={styles.termsText}>
                J'accepte les <Text style={styles.termsLink}>conditions générales</Text> et la <Text style={styles.termsLink}>politique de confidentialité</Text>
              </Text>
            </TouchableOpacity>
          </View>
          {errors.terms && <Text style={styles.errorText}>{errors.terms}</Text>}
          
          {/* Bouton d'inscription */}
          <TouchableOpacity 
            style={[
              styles.submitButton, 
              (!isAnyServiceSelected || !termsAccepted || serviceCities.length === 0) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!isAnyServiceSelected || !termsAccepted || serviceCities.length === 0}
          >
            <Text style={styles.submitButtonText}>S'inscrire</Text>
          </TouchableOpacity>
          
          {/* Lien vers la connexion */}
          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginLinkText}>
              Déjà inscrit ? <Text style={styles.loginLinkHighlight}>Se connecter</Text>
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
  // ✅ NOUVEAUX STYLES POUR LE SÉLECTEUR DE VILLES
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
});

export default ProviderRegistrationScreen;