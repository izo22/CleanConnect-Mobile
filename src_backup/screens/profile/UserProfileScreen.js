import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as RootNavigation from '../../navigation/RootNavigation'; // Importez la référence

// Composant pour les options du profil
const ProfileOption = ({ icon, title, onPress, value, rightComponent }) => {
  return (
    <TouchableOpacity style={styles.optionContainer} onPress={onPress}>
      <View style={styles.optionLeft}>
        <Ionicons name={icon} size={24} color="#3498db" />
        <Text style={styles.optionTitle}>{title}</Text>
      </View>
      <View style={styles.optionRight}>
        {value && <Text style={styles.optionValue}>{value}</Text>}
        {rightComponent}
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </View>
    </TouchableOpacity>
  );
};

// Composant pour les sections du profil
const ProfileSection = ({ title, children }) => {
  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
};

const UserProfileScreen = () => {
  const authContext = useContext(AuthContext);
  console.log("authContext:", authContext);
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  // Données du profil
  const [profileData, setProfileData] = useState({
    firstName: authContext?.userInfo?.firstName || authContext?.userInfo?.name || 'Utilisateur',
    lastName: authContext?.userInfo?.lastName || '',
    email: authContext?.userInfo?.email || 'utilisateur@exemple.com',
    phone: authContext?.userInfo?.phone || '+972 54 123 4567',
    language: authContext?.userInfo?.language || 'Hébreu',
    addresses: authContext?.userInfo?.addresses || [
      {
        id: '1',
        name: 'Domicile',
        street: '25 Rue Ben Yehuda',
        city: 'Tel Aviv',
        postalCode: '6380802',
        isDefault: true,
      },
      {
        id: '2',
        name: 'Bureau',
        street: '12 Rue Herzl',
        city: 'Tel Aviv',
        postalCode: '6684401',
        isDefault: false,
      },
    ],
  });

  // Gérer le changement de langue
  const handleLanguageChange = () => {
    navigation.navigate('LanguageSettings');
  };

  // Gérer l'édition des informations personnelles
  const handleEditPersonalInfo = () => {
    navigation.navigate('EditPersonalInfo', { profileData });
  };

  // Gérer la gestion des adresses
  const handleManageAddresses = () => {
    navigation.navigate('ManageAddresses', { addresses: profileData.addresses });
  };

  // Fonction de déconnexion améliorée
  const handleLogout = () => {
    console.log("Bouton déconnexion cliqué");
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel', onPress: () => console.log("Annulation de déconnexion") },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            console.log("Confirmation de déconnexion cliquée");
            try {
              setIsLoading(true);
              await authContext.logout();
              RootNavigation.reset({
                index: 0,
                routes: [{ name: 'Welcome' }],
              });
              console.log("Navigation réinitialisée");
            } catch (error) {
              console.error("Erreur lors de la déconnexion:", error);
              Alert.alert("Erreur", "Impossible de vous déconnecter. Veuillez fermer et relancer l'application.");
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };
  
  const handleLogoutDirect = async () => {
    console.log("Déconnexion directe déclenchée");
    try {
      setIsLoading(true);
      await authContext.logout();
      RootNavigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
      console.log("Navigation réinitialisée");
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  

  // Gérer la suppression du compte
  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          onPress: async () => {
            // Ajouter la logique de suppression de compte ici
            Alert.alert('Compte supprimé', 'Votre compte a été supprimé avec succès.');
            
            // Utiliser la même méthode de déconnexion fiable
            await AsyncStorage.clear();
            
            // Réinitialiser le contexte d'authentification
            if (authContext) {
              if (authContext.setUserToken) authContext.setUserToken(null);
              if (authContext.setUserInfo) authContext.setUserInfo(null);
              if (authContext.setUserRole) authContext.setUserRole(null);
            }
            
            // Utiliser RootNavigation pour rediriger
            RootNavigation.reset({
              index: 0,
              routes: [{ name: 'Welcome' }],
            });
          },
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {isLoading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#3498db" />
        </View>
      )}
      
      <ScrollView>
        {/* En-tête du profil */}
        <View style={styles.profileHeader}>
          <View style={styles.initialsContainer}>
            <Text style={styles.initialsText}>
              {profileData.firstName.charAt(0)}
              {profileData.lastName.charAt(0)}
            </Text>
          </View>
          <Text style={styles.userName}>
            {profileData.firstName} {profileData.lastName}
          </Text>
          <Text style={styles.userEmail}>{profileData.email}</Text>
        </View>

        {/* Informations personnelles */}
        <ProfileSection title="Informations personnelles">
          <ProfileOption
            icon="person-outline"
            title="Modifier mes informations"
            onPress={handleEditPersonalInfo}
          />
          <ProfileOption
            icon="call-outline"
            title="Téléphone"
            value={profileData.phone}
            onPress={() => navigation.navigate('EditPhone', { phone: profileData.phone })}
          />
        </ProfileSection>

        {/* Adresses */}
        <ProfileSection title="Mes adresses">
          <ProfileOption
            icon="location-outline"
            title="Gérer mes adresses"
            value={`${profileData.addresses.length} adresses`}
            onPress={handleManageAddresses}
          />
        </ProfileSection>

        {/* Préférences */}
        <ProfileSection title="Préférences">
          <ProfileOption
            icon="language-outline"
            title="Langue"
            value={profileData.language}
            onPress={handleLanguageChange}
          />
          <ProfileOption
            icon="notifications-outline"
            title="Notifications"
            rightComponent={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#ccc', true: '#a3d4ff' }}
                thumbColor={notificationsEnabled ? '#3498db' : '#f4f3f4'}
                ios_backgroundColor="#ccc"
              />
            }
            onPress={() => setNotificationsEnabled(!notificationsEnabled)}
          />
        </ProfileSection>

        {/* Compte */}
        <ProfileSection title="Compte">
          <ProfileOption
            icon="log-out-outline"
            title="Déconnexion"
            onPress={handleLogout}
          />
          <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
            <Text style={styles.deleteAccountText}>Supprimer mon compte</Text>
          </TouchableOpacity>
        </ProfileSection>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    zIndex: 1000,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  initialsContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  initialsText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
  },
  sectionContainer: {
    marginTop: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: '#333',
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 16,
    marginLeft: 12,
    color: '#333',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionValue: {
    fontSize: 16,
    color: '#999',
    marginRight: 10,
  },
  deleteAccountButton: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  deleteAccountText: {
    color: '#e74c3c',
    fontSize: 16,
  },
});

export default UserProfileScreen;