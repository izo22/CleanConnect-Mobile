// src/screens/client/AddressSelection.js
import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput as RNTextInput } from 'react-native';
import { Card, RadioButton, Divider, Appbar, useTheme, Text } from 'react-native-paper';
import { useBooking } from '../../context/BookingContext';
import { AuthContext } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const AddressSelectionScreen = ({ navigation }) => {
  const theme = useTheme();
  const { currentBooking, updateBooking } = useBooking();
  const { userInfo } = useContext(AuthContext);
  
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(
    currentBooking.address ? currentBooking.address.id : null
  );
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newAddress, setNewAddress] = useState({
    street: '',
    city: 'תל אביב',
    country: 'ישראל',
    additionalInfo: ''
  });
  
  const getServiceColor = () => {
    switch (currentBooking.serviceType) {
      case 'home': return theme.colors.homeService || '#007AFF';
      case 'office': return theme.colors.officeService || '#34C759';
      case 'building': return theme.colors.buildingService || '#FF9500';
      default: return theme.colors.primary;
    }
  };
  
  const serviceColor = getServiceColor();
  
  useEffect(() => {
    loadUserAddresses();
  }, []);
  
  const loadUserAddresses = async () => {
    setIsLoading(true);
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        
        console.log('📦 נתוני משתמש מ-AsyncStorage:', user);
        
        const mainAddress = {
          id: 'main-address',
          name: 'כתובת ראשית',
          fullAddress: user.address && user.city 
            ? `${user.address}, ${user.city}` 
            : user.city || user.address || 'אין כתובת',
          city: user.city || '',
          coordinates: { latitude: 32.0853, longitude: 34.7818 },
          isMain: true
        };
        
        console.log('🏠 כתובת ראשית שנוצרה:', mainAddress);
        console.log('📍 עיר בכתובת הראשית:', mainAddress.city);
        
        const savedAddressesJson = await AsyncStorage.getItem(`user_addresses_${user.id}`);
        const savedAddresses = savedAddressesJson ? JSON.parse(savedAddressesJson) : [];
        
        const allAddresses = [mainAddress, ...savedAddresses];
        setAddresses(allAddresses);
        
        if (!currentBooking.address) {
          setSelectedAddressId('main-address');
        }
      }
    } catch (error) {
      console.error('❌ שגיאה בטעינת כתובות:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את הכתובות.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAddress = () => {
    const selectedAddress = addresses.find(addr => addr.id === selectedAddressId);
    if (selectedAddress) {
      console.log('✅ כתובת נבחרה:', selectedAddress);
      console.log('📍 עיר בכתובת שנבחרה:', selectedAddress.city);
      updateBooking({ address: selectedAddress });
      navigation.goBack();
    }
  };

  const handleAddAddress = async () => {
    if (!newAddress.street) {
      Alert.alert('שגיאת אימות', 'אנא מלא את רחוב ומספר הבית');
      return;
    }
    
    const fullAddress = `${newAddress.street}, ${newAddress.city}, ${newAddress.country}`;
    const additionalInfo = newAddress.additionalInfo ? ` (${newAddress.additionalInfo})` : '';
    
    const newAddressObj = {
      id: `new-${Date.now()}`,
      name: newAddress.street, // Utiliser la rue comme nom
      fullAddress: fullAddress + additionalInfo,
      city: newAddress.city,
      coordinates: { 
        latitude: 32.0853 + (Math.random() * 0.01),
        longitude: 34.7818 + (Math.random() * 0.01)
      },
      isMain: false
    };
    
    console.log('➕ כתובת חדשה נוצרה:', newAddressObj);
    console.log('📍 עיר בכתובת חדשה:', newAddressObj.city);
    
    const updatedAddresses = [...addresses, newAddressObj];
    setAddresses(updatedAddresses);
    setSelectedAddressId(newAddressObj.id);
    setShowAddAddress(false);
    
    // Sauvegarde des adresses additionnelles
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        const additionalAddresses = updatedAddresses.filter(addr => !addr.isMain);
        await AsyncStorage.setItem(
          `user_addresses_${user.id}`,
          JSON.stringify(additionalAddresses)
        );
      }
    } catch (error) {
      console.error('Error saving addresses:', error);
    }
    
    // Réinitialisation du formulaire
    setNewAddress({
      street: '',
      city: 'תל אביב',
      country: 'ישראל',
      additionalInfo: ''
    });
    
    Alert.alert('הצלחה', 'הכתובת נוספה בהצלחה');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.rtlText}>טוען כתובות...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: serviceColor }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="white" />
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {showAddAddress ? "הוסף כתובת" : "בחירת כתובת"}
          </Text>
        </View>
      </Appbar.Header>
      
      <ScrollView style={styles.content}>
        {!showAddAddress ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={[styles.sectionTitle, styles.rtlText]}>הכתובות שלי</Text>
              
              {addresses.length === 0 ? (
                <View style={styles.noAddressContainer}>
                  <Text style={[styles.noAddressText, styles.rtlText]}>עדיין לא הוספת כתובות</Text>
                  <TouchableOpacity 
                    style={[styles.button, { backgroundColor: serviceColor }]}
                    onPress={() => setShowAddAddress(true)}
                  >
                    <Text style={styles.buttonText}>הוסף כתובת</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <RadioButton.Group onValueChange={v => setSelectedAddressId(v)} value={selectedAddressId}>
                    {addresses.map((address) => (
                      <View key={address.id}>
                        <TouchableOpacity 
                          style={styles.addressItem} 
                          onPress={() => setSelectedAddressId(address.id)}
                        >
                          <View style={styles.addressDetails}>
                            <View style={styles.row}>
                              <Text style={[styles.addressName, styles.rtlText]}>{address.name}</Text>
                              {address.isMain && (
                                <View style={[styles.badge, { backgroundColor: serviceColor }]}>
                                  <Text style={styles.badgeText}>ראשי</Text>
                                </View>
                              )}
                            </View>
                            <Text style={[styles.addressText, styles.rtlText]}>{address.fullAddress}</Text>
                          </View>
                          <RadioButton value={address.id} color={serviceColor} />
                        </TouchableOpacity>
                        <Divider />
                      </View>
                    ))}
                  </RadioButton.Group>
                  
                  <TouchableOpacity 
                    style={[
                      styles.button, 
                      { backgroundColor: serviceColor },
                      !selectedAddressId && styles.buttonDisabled
                    ]}
                    onPress={handleConfirmAddress}
                    disabled={!selectedAddressId}
                  >
                    <Text style={styles.buttonText}>אשר כתובת</Text>
                  </TouchableOpacity>
                </>
              )}
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={[styles.sectionTitle, styles.rtlText]}>הוסף כתובת</Text>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, styles.rtlText, { color: serviceColor }]}>רחוב ומספר בית</Text>
                <RNTextInput
                  value={newAddress.street}
                  onChangeText={t => setNewAddress({...newAddress, street: t})}
                  style={[styles.textInput, styles.rtlText, { borderColor: serviceColor }]}
                  placeholderTextColor="#999"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, styles.rtlText, { color: serviceColor }]}>עיר</Text>
                <RNTextInput
                  value={newAddress.city}
                  onChangeText={t => setNewAddress({...newAddress, city: t})}
                  style={[styles.textInput, styles.rtlText, { borderColor: serviceColor }]}
                  placeholderTextColor="#999"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, styles.rtlText, { color: serviceColor }]}>מדינה</Text>
                <RNTextInput
                  value={newAddress.country}
                  onChangeText={t => setNewAddress({...newAddress, country: t})}
                  style={[styles.textInput, styles.rtlText, { borderColor: serviceColor }]}
                  placeholderTextColor="#999"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, styles.rtlText, { color: serviceColor }]}>פרטים נוספים (אופציונלי)</Text>
                <RNTextInput
                  value={newAddress.additionalInfo}
                  onChangeText={t => setNewAddress({...newAddress, additionalInfo: t})}
                  style={[styles.textInput, styles.textInputMultiline, styles.rtlText, { borderColor: serviceColor }]}
                  placeholder="לדוגמה: קומה 3, דירה 12"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />
              </View>
              
              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.buttonOutlined, { borderColor: serviceColor }]}
                  onPress={() => setShowAddAddress(false)}
                >
                  <Text style={[styles.buttonOutlinedText, { color: serviceColor }]}>
                    ביטול
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.button, 
                    { backgroundColor: serviceColor },
                    !newAddress.street && styles.buttonDisabled
                  ]}
                  onPress={handleAddAddress}
                  disabled={!newAddress.street}
                >
                  <Text style={styles.buttonText}>שמור כתובת</Text>
                </TouchableOpacity>
              </View>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {!showAddAddress && addresses.length > 0 && (
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: serviceColor }]}
          onPress={() => setShowAddAddress(true)}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5' 
  },
  content: { 
    flex: 1 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  card: { 
    margin: 15, 
    borderRadius: 8, 
    elevation: 4 
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
  addressItem: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center',
    paddingVertical: 12,
  },
  addressDetails: { 
    flex: 1, 
    marginRight: 10 
  },
  addressName: { 
    fontWeight: 'bold', 
    fontSize: 16,
    marginLeft: 8,
  },
  addressText: { 
    color: '#666', 
    fontSize: 14, 
    marginTop: 4 
  },
  row: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center' 
  },
  badge: { 
    paddingHorizontal: 8, 
    paddingVertical: 2,
    borderRadius: 10 
  },
  badgeText: { 
    color: 'white', 
    fontSize: 10, 
    fontWeight: 'bold' 
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    textAlign: 'right',
  },
  textInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonOutlined: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginLeft: 10,
  },
  buttonOutlinedText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonRow: { 
    flexDirection: 'row-reverse', 
    justifyContent: 'space-between', 
    marginTop: 20,
  },
  fab: { 
    position: 'absolute', 
    margin: 16, 
    left: 0,
    bottom: 0,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  rtlText: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
});

export default AddressSelectionScreen;