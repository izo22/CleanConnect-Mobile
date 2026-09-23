import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

const ManageAddressesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { addresses: initialAddresses } = route.params;
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  
  const [addresses, setAddresses] = useState(initialAddresses);

  const handleEditAddress = (address) => {
    navigation.navigate('EditAddress', {
      address,
      onSave: (updatedAddress) => {
        const newAddresses = addresses.map((addr) =>
          addr.id === updatedAddress.id ? updatedAddress : addr
        );
        setAddresses(newAddresses);
      },
    });
  };

  const handleDeleteAddress = (addressId) => {
    Alert.alert(
      t('manageAddresses.deleteConfirm.title'),
      t('manageAddresses.deleteConfirm.message'),
      [
        {
          text: t('manageAddresses.deleteConfirm.cancel'),
          style: 'cancel',
        },
        {
          text: t('manageAddresses.deleteConfirm.delete'),
          onPress: () => {
            const newAddresses = addresses.filter((addr) => addr.id !== addressId);
            setAddresses(newAddresses);
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleAddAddress = () => {
    navigation.navigate('EditAddress', {
      onSave: (newAddress) => {
        const newAddressWithId = {
          ...newAddress,
          id: Date.now().toString(),
        };
        setAddresses([...addresses, newAddressWithId]);
      },
    });
  };

  const handleSetDefault = (addressId) => {
    const newAddresses = addresses.map((addr) => ({
      ...addr,
      isDefault: addr.id === addressId,
    }));
    setAddresses(newAddresses);
  };

  const renderAddressItem = ({ item }) => (
    <View style={styles.addressCard}>
      <View style={[styles.addressHeader, isRTL && styles.addressHeaderRTL]}>
        <View style={styles.nameContainer}>
          <Text style={[styles.addressName, isRTL && styles.textRTL]}>{item.name}</Text>
          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={[styles.defaultText, isRTL && styles.textRTL]}>
                {t('manageAddresses.defaultLabel')}
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.actionsContainer, isRTL && styles.actionsContainerRTL]}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditAddress(item)}
          >
            <Ionicons name="create-outline" size={20} color="#256FA8" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteAddress(item.id)}
          >
            <Ionicons name="trash-outline" size={20} color="#e74c3c" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.addressDetails}>
        <Text style={[styles.addressText, isRTL && styles.textRTL]}>{item.street}</Text>
        <Text style={[styles.addressText, isRTL && styles.textRTL]}>
          {item.city}, {item.postalCode}
        </Text>
      </View>

      {!item.isDefault && (
        <TouchableOpacity
          style={styles.setDefaultButton}
          onPress={() => handleSetDefault(item.id)}
        >
          <Text style={[styles.setDefaultText, isRTL && styles.textRTL]}>
            {t('manageAddresses.setDefault')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color="#1B2A36" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>
          {t('manageAddresses.title')}
        </Text>
        <View style={styles.placeholderButton} />
      </View>

      <FlatList
        data={addresses}
        renderItem={renderAddressItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={64} color="#DCE8F1" />
            <Text style={[styles.emptyText, isRTL && styles.textRTL]}>
              {t('manageAddresses.noAddressesMessage')}
            </Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.addButton} onPress={handleAddAddress}>
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={[styles.addButtonText, isRTL && styles.textRTL]}>
          {t('manageAddresses.addAddress')}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6FAFD' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#EEF3F7' },
  backButton: { padding: 8, borderRadius: 999 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  placeholderButton: { width: 40, borderRadius: 999 },
  listContainer: { padding: 16, paddingBottom: 100 },
  addressCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#1B4F7A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  addressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  addressHeaderRTL: { flexDirection: 'row-reverse' },
  nameContainer: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  addressName: { fontSize: 18, fontWeight: '600', color: '#1B2A36' },
  defaultBadge: { backgroundColor: '#256FA8', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  defaultText: { color: 'white', fontSize: 12, fontWeight: '500' },
  actionsContainer: { flexDirection: 'row', gap: 8 },
  actionsContainerRTL: { flexDirection: 'row-reverse' },
  actionButton: { padding: 8, borderRadius: 999 },
  addressDetails: { marginBottom: 12 },
  addressText: { fontSize: 14, color: '#5E6E7C', marginBottom: 4 },
  setDefaultButton: { borderTopWidth: 1, borderTopColor: '#EEF3F7', paddingTop: 12, borderRadius: 999 },
  setDefaultText: { fontSize: 14, color: '#256FA8', fontWeight: '500' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#8A99A6' },
  addButton: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: '#256FA8', borderRadius: 999, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#1B4F7A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 6 },
  addButtonText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  textRTL: { writingDirection: 'rtl', textAlign: 'right' },
});

export default ManageAddressesScreen;