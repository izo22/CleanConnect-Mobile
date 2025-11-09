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

const ManageAddressesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { addresses: initialAddresses } = route.params;
  
  const [addresses, setAddresses] = useState(initialAddresses);

  // Gérer l'édition d'une adresse
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

  // Gérer la suppression d'une adresse
  const handleDeleteAddress = (addressId) => {
    Alert.alert(
      'Supprimer l\'adresse',
      'Êtes-vous sûr de vouloir supprimer cette adresse ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          onPress: () => {
            const newAddresses = addresses.filter((addr) => addr.id !== addressId);
            setAddresses(newAddresses);
          },
          style: 'destructive',
        },
      ]
    );
  };

  // Gérer l'ajout d'une nouvelle adresse
  const handleAddAddress = () => {
    navigation.navigate('EditAddress', {
      onSave: (newAddress) => {
        // Générer un ID unique
        const newAddressWithId = {
          ...newAddress,
          id: Date.now().toString(),
        };
        setAddresses([...addresses, newAddressWithId]);
      },
    });
  };

  // Définir une adresse comme adresse par défaut
  const handleSetDefault = (addressId) => {
    const newAddresses = addresses.map((addr) => ({
      ...addr,
      isDefault: addr.id === addressId,
    }));
    setAddresses(newAddresses);
  };

  // Rendre un élément d'adresse
  const renderAddressItem = ({ item }) => (
    <View style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <View style={styles.nameContainer}>
          <Text style={styles.addressName}>{item.name}</Text>
          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultText}>Par défaut</Text>
            </View>
          )}
        </View>
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditAddress(item)}
          >
            <Ionicons name="create-outline" size={20} color="#3498db" />
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
        <Text style={styles.addressText}>{item.street}</Text>
        <Text style={styles.addressText}>
          {item.city}, {item.postalCode}
        </Text>
      </View>

      {!item.isDefault && (
        <TouchableOpacity
          style={styles.setDefaultButton}
          onPress={() => handleSetDefault(item.id)}
        >
          <Text style={styles.setDefaultText}>Définir comme adresse par défaut</Text>
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
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes adresses</Text>
        <View style={styles.placeholderButton} />
      </View>

      <FlatList
        data={addresses}
        renderItem={renderAddressItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Vous n'avez pas encore d'adresses</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddAddress}
      >
        <Ionicons name="add" size={24} color="white" />
        <Text style={styles.addButtonText}>Ajouter une adresse</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  listContainer: {
    padding: 16,
  },
  addressCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addressName: {
    fontSize: 18,
    fontWeight: '600',
  },
  defaultBadge: {
    backgroundColor: '#e1f5fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  defaultText: {
    color: '#0288d1',
    fontSize: 12,
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  addressDetails: {
    marginBottom: 12,
  },
  addressText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  setDefaultButton: {
    paddingVertical: 8,
  },
  setDefaultText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
    padding: 16,
    margin: 16,
    borderRadius: 10,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
  },
});
export default ManageAddressesScreen ;