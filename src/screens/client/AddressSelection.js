// src/screens/client/AddressSelection.js
import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, Title, Button, RadioButton, Divider, TextInput, Appbar, useTheme, FAB } from 'react-native-paper';
import { useBooking } from '../../context/BookingContext';
import { AuthContext } from '../../context/AuthContext'; // ✅ AJOUT
import AsyncStorage from '@react-native-async-storage/async-storage'; // ✅ AJOUT

const AddressSelectionScreen = ({ navigation }) => {
  const theme = useTheme();
  const { currentBooking, updateBooking } = useBooking();
  const { userInfo } = useContext(AuthContext); // ✅ RÉCUPÉRATION INFO USER
  
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(
    currentBooking.address ? currentBooking.address.id : null
  );
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newAddress, setNewAddress] = useState({
    name: '',
    street: '',
    city: 'Tel Aviv',
    country: 'Israël',
    additionalInfo: ''
  });
  
  // Couleur associée au type de service
  const getServiceColor = () => {
    switch (currentBooking.serviceType) {
      case 'home':
        return theme.colors.homeService;
      case 'office':
        return theme.colors.officeService;
      case 'building':
        return theme.colors.buildingService;
      default:
        return theme.colors.primary;
    }
  };
  
  const serviceColor = getServiceColor();
  
  // ✅ CHARGER L'ADRESSE DE L'UTILISATEUR AU DÉMARRAGE
  useEffect(() => {
    loadUserAddresses();
  }, []);
  
  const loadUserAddresses = async () => {
    setIsLoading(true);
    try {
      
      // Récupérer les données utilisateur depuis AsyncStorage
      const userData = await AsyncStorage.getItem('userData');
      
      if (userData) {
        const user = JSON.parse(userData);
        
        // Créer l'adresse principale depuis l'inscription
        const mainAddress = {
          id: 'main-address',
          name: 'Mon adresse principale',
          fullAddress: user.address || 'Adresse non renseignée',
          coordinates: { latitude: 32.0853, longitude: 34.7818 }, // Coordonnées par défaut Tel Aviv
          isMain: true // Marqueur pour l'adresse principale
        };
        
        // Charger les adresses supplémentaires sauvegardées
        const savedAddressesJson = await AsyncStorage.getItem(`user_addresses_${user.id}`);
        const savedAddresses = savedAddressesJson ? JSON.parse(savedAddressesJson) : [];
        
        // Combiner l'adresse principale et les adresses supplémentaires
        const allAddresses = [mainAddress, ...savedAddresses];
        
        setAddresses(allAddresses);
        
        // ✅ PRÉ-SÉLECTIONNER L'ADRESSE PRINCIPALE SI AUCUNE N'EST SÉLECTIONNÉE
        if (!currentBooking.address) {
          setSelectedAddressId('main-address');
        }
        
      } else {
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger vos adresses');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Sélectionner l'adresse actuelle du booking si elle existe
  useEffect(() => {
    if (currentBooking.address) {
      setSelectedAddressId(currentBooking.address.id);
    }
  }, [currentBooking.address]);
  
  // Valider l'adresse sélectionnée
  const handleConfirmAddress = () => {
    const selectedAddress = addresses.find(addr => addr.id === selectedAddressId);
    
    if (selectedAddress) {
      updateBooking({ address: selectedAddress });
      navigation.goBack();
    }
  };
  
  // ✅ SAUVEGARDER LES ADRESSES SUPPLÉMENTAIRES
  const saveAdditionalAddresses = async (newAddresses) => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        // Sauvegarder uniquement les adresses supplémentaires (pas la principale)
        const additionalAddresses = newAddresses.filter(addr => !addr.isMain);
        await AsyncStorage.setItem(
          `user_addresses_${user.id}`,
          JSON.stringify(additionalAddresses)
        );
      }
    } catch (error) {
    }
  };
  
  // Ajouter une nouvelle adresse
  const handleAddAddress = async () => {
    if (!newAddress.name || !newAddress.street) {
      Alert.alert('Erreur', 'Veuillez remplir au moins le nom et la rue');
      return;
    }
    
    const fullAddress = `${newAddress.street}, ${newAddress.city}, ${newAddress.country}`;
    const additionalInfo = newAddress.additionalInfo ? ` (${newAddress.additionalInfo})` : '';
    
    const newAddressObj = {
      id: `new-${Date.now()}`,
      name: newAddress.name,
      fullAddress: fullAddress + additionalInfo,
      coordinates: { 
        latitude: 32.0853 + (Math.random() * 0.01), // Coordonnées simulées
        longitude: 34.7818 + (Math.random() * 0.01)
      },
      isMain: false
    };
    
    const updatedAddresses = [...addresses, newAddressObj];
    setAddresses(updatedAddresses);
    setSelectedAddressId(newAddressObj.id);
    setShowAddAddress(false);
    
    // ✅ SAUVEGARDER LA NOUVELLE ADRESSE
    await saveAdditionalAddresses(updatedAddresses);
    
    // Réinitialiser le formulaire
    setNewAddress({
      name: '',
      street: '',
      city: 'Tel Aviv',
      country: 'Israël',
      additionalInfo: ''
    });
    
    Alert.alert('Succès', 'Adresse ajoutée avec succès');
  };
  
  // ✅ MODIFIER L'ADRESSE PRINCIPALE
  const handleEditMainAddress = () => {
    Alert.alert(
      'Modifier l\'adresse principale',
      'Cette adresse provient de votre inscription. Souhaitez-vous la modifier dans votre profil ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Modifier dans le profil',
          onPress: () => {
            // Navigation vers l'écran de profil (à adapter selon votre navigation)
            navigation.navigate('Profile');
          }
        },
        {
          text: 'Ajouter une nouvelle adresse',
          onPress: () => setShowAddAddress(true)
        }
      ]
    );
  };
  
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Appbar.Header style={{ backgroundColor: serviceColor }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} color="white" />
          <Appbar.Content title="Choisir une adresse" color="white" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <Text>Chargement de vos adresses...</Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: serviceColor }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="white" />
        <Appbar.Content title="Choisir une adresse" color="white" />
      </Appbar.Header>
      
      <ScrollView style={styles.content}>
        {!showAddAddress ? (
          // Liste des adresses existantes
          <Card style={styles.addressesCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Mes adresses</Title>
              
              {addresses.length === 0 ? (
                <View style={styles.noAddressContainer}>
                  <Text style={styles.noAddressText}>Aucune adresse enregistrée</Text>
                  <Button 
                    mode="contained" 
                    onPress={() => setShowAddAddress(true)}
                    style={[styles.addFirstAddressButton, { backgroundColor: serviceColor }]}
                  >
                    Ajouter une adresse
                  </Button>
                </View>
              ) : (
                <>
                  <RadioButton.Group onValueChange={value => setSelectedAddressId(value)} value={selectedAddressId}>
                    {addresses.map((address) => (
                      <View key={address.id}>
                        <TouchableOpacity 
                          style={styles.addressItem}
                          onPress={() => setSelectedAddressId(address.id)}
                        >
                          <RadioButton 
                            value={address.id} 
                            color={serviceColor}
                          />
                          <View style={styles.addressDetails}>
                            <View style={styles.addressNameContainer}>
                              <Text style={styles.addressName}>{address.name}</Text>
                              {/* ✅ BADGE POUR L'ADRESSE PRINCIPALE */}
                              {address.isMain && (
                                <View style={[styles.mainBadge, { backgroundColor: serviceColor }]}>
                                  <Text style={styles.mainBadgeText}>Principale</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.addressText}>{address.fullAddress}</Text>
                          </View>
                          {/* ✅ BOUTON MODIFIER POUR L'ADRESSE PRINCIPALE */}
                          {address.isMain && (
                            <TouchableOpacity 
                              onPress={handleEditMainAddress}
                              style={styles.editButton}
                            >
                              <Text style={[styles.editButtonText, { color: serviceColor }]}>Modifier</Text>
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>
                        <Divider />
                      </View>
                    ))}
                  </RadioButton.Group>
                  
                  {/* Bouton Valider plus visible */}
                  <View style={styles.validateButtonContainer}>
                    <Button 
                      mode="contained" 
                      style={[styles.validateButton, { backgroundColor: serviceColor }]}
                      onPress={handleConfirmAddress}
                      disabled={!selectedAddressId}
                    >
                      Valider cette adresse
                    </Button>
                  </View>
                </>
              )}
            </Card.Content>
          </Card>
        ) : (
          // Formulaire d'ajout d'adresse
          <Card style={styles.addressFormCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Ajouter une adresse</Title>
              
              <TextInput
                label="Nom de l'adresse"
                value={newAddress.name}
                onChangeText={(text) => setNewAddress({...newAddress, name: text})}
                style={styles.input}
                theme={{ colors: { primary: serviceColor } }}
                placeholder="Ex: Bureau, Maison secondaire, etc."
              />
              
              <TextInput
                label="Rue et numéro"
                value={newAddress.street}
                onChangeText={(text) => setNewAddress({...newAddress, street: text})}
                style={styles.input}
                theme={{ colors: { primary: serviceColor } }}
              />
              
              <TextInput
                label="Ville"
                value={newAddress.city}
                onChangeText={(text) => setNewAddress({...newAddress, city: text})}
                style={styles.input}
                theme={{ colors: { primary: serviceColor } }}
              />
              
              <TextInput
                label="Pays"
                value={newAddress.country}
                onChangeText={(text) => setNewAddress({...newAddress, country: text})}
                style={styles.input}
                theme={{ colors: { primary: serviceColor } }}
              />
              
              <TextInput
                label="Informations complémentaires (optionnel)"
                value={newAddress.additionalInfo}
                onChangeText={(text) => setNewAddress({...newAddress, additionalInfo: text})}
                style={styles.input}
                theme={{ colors: { primary: serviceColor } }}
                placeholder="Code porte, étage, instructions..."
                multiline
              />
              
              <View style={styles.formButtonsContainer}>
                <Button 
                  mode="outlined" 
                  onPress={() => setShowAddAddress(false)}
                  style={styles.cancelButton}
                  color={serviceColor}
                >
                  Annuler
                </Button>
                
                <Button 
                  mode="contained" 
                  onPress={handleAddAddress}
                  style={[styles.saveButton, { backgroundColor: serviceColor }]}
                  disabled={!newAddress.name || !newAddress.street}
                >
                  Enregistrer
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
      
      {/* Bouton d'ajout d'adresse */}
      {!showAddAddress && addresses.length > 0 && (
        <FAB
          style={[styles.fab, { backgroundColor: serviceColor }]}
          icon="plus"
          onPress={() => setShowAddAddress(true)}
          label="Ajouter une adresse"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressesCard: {
    margin: 15,
    borderRadius: 8,
    elevation: 4,
  },
  addressFormCard: {
    margin: 15,
    borderRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 15,
  },
  noAddressContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noAddressText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  addFirstAddressButton: {
    paddingHorizontal: 20,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  addressDetails: {
    flex: 1,
    marginLeft: 10,
  },
  addressNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  // ✅ BADGE "PRINCIPALE"
  mainBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  mainBadgeText: {
    fontSize: 12,
    color: 'white',
    fontWeight: 'bold',
  },
  addressText: {
    fontSize: 14,
    color: '#666',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: 'transparent',
    marginBottom: 16,
  },
  formButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  cancelButton: {
    marginRight: 10,
  },
  saveButton: {
    minWidth: 100,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  validateButtonContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  validateButton: {
    width: '100%',
    paddingVertical: 8,
  }
});

export default AddressSelectionScreen;
