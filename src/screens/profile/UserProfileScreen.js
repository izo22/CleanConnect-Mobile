// src/screens/profile/UserProfileScreen.js
// ✅ תורגם לעברית ישירות ללא i18n
// ✅ תוקן: הצגת עיר אמיתית מהפרופיל
// ✅ נוסף: גישה לוידאו של הנכס
// ✅ תוקן: עריכת כתובת ועיר דרך EditPersonalInfo

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
import * as RootNavigation from '../../navigation/RootNavigation';

// Composant pour les options du profil
const ProfileOption = ({ icon, title, onPress, value, rightComponent, isRTL }) => {
  return (
    <TouchableOpacity style={styles.optionContainer} onPress={onPress}>
      <View style={[styles.optionLeft, isRTL && styles.optionLeftRTL]}>
        <Ionicons name={icon} size={24} color="#3498db" />
        <Text style={[styles.optionTitle, isRTL && styles.textRTL]}>{title}</Text>
      </View>
      <View style={[styles.optionRight, isRTL && styles.optionRightRTL]}>
        {value && <Text style={[styles.optionValue, isRTL && styles.textRTL]}>{value}</Text>}
        {rightComponent}
        <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color="#999" />
      </View>
    </TouchableOpacity>
  );
};

// Composant pour les sections du profil
const ProfileSection = ({ title, children, isRTL }) => {
  return (
    <View style={styles.sectionContainer}>
      <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>{title}</Text>
      {children}
    </View>
  );
};

const UserProfileScreen = () => {
  const authContext = useContext(AuthContext);
  const navigation = useNavigation();
  const isRTL = true; // ✅ תמיד RTL לעברית
  
  const [isLoading, setIsLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  // ✅ CORRECTION : Données du profil depuis authContext.userInfo
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    city: '', // ✅ Ajout du champ ville
    address: '',
    language: 'עברית',
  });

  // ✅ Charger les vraies données du profil depuis authContext
  useEffect(() => {
    if (authContext?.userInfo) {
      setProfileData({
        firstName: authContext.userInfo.firstName || authContext.userInfo.name || 'משתמש',
        lastName: authContext.userInfo.lastName || '',
        email: authContext.userInfo.email || 'email@example.com',
        phone: authContext.userInfo.phone || 'לא צוין',
        city: authContext.userInfo.city || 'לא צוין', // ✅ Ville depuis userInfo
        address: authContext.userInfo.address || 'לא צוינה',
        language: authContext.userInfo.language || 'עברית',
      });
      
      console.log('📋 נתוני פרופיל:', {
        city: authContext.userInfo.city,
        address: authContext.userInfo.address
      });
    }
  }, [authContext?.userInfo]);

  // Gérer le changement de langue
  const handleLanguageChange = () => {
    navigation.navigate('LanguageSettings');
  };

  // Gérer l'édition des informations personnelles
  const handleEditPersonalInfo = () => {
    navigation.navigate('EditPersonalInfo', { profileData });
  };

  // ✅ CORRECTION : Naviguer vers EditPersonalInfo pour éditer ville/adresse
  const handleEditAddress = () => {
    navigation.navigate('EditPersonalInfo', { profileData });
  };

  // ✅ NOUVEAU : Gérer l'accès à la vidéo de propriété
  const handlePropertyVideo = () => {
    navigation.navigate('PropertyVideo');
  };

  // Fonction de déconnexion - VERSION WEB (sans Alert)
  const handleLogout = async () => {
    console.log('🔴🔴🔴 DÉBUT DÉCONNEXION !!! 🔴🔴🔴');
    
    try {
      setIsLoading(true);
      
      console.log('🔴 Début de la déconnexion...');
      
      // ✅ Vider toutes les données AsyncStorage
      await AsyncStorage.clear();
      console.log('✅ AsyncStorage vidé');
      
      // ✅ Réinitialiser le contexte d'authentification
      if (authContext) {
        if (authContext.setUserToken) {
          authContext.setUserToken(null);
          console.log('✅ Token réinitialisé');
        }
        if (authContext.setUserInfo) {
          authContext.setUserInfo(null);
          console.log('✅ UserInfo réinitialisé');
        }
        if (authContext.setUserRole) {
          authContext.setUserRole(null);
          console.log('✅ UserRole réinitialisé');
        }
        
        // Appeler logout si la fonction existe
        if (authContext.logout && typeof authContext.logout === 'function') {
          await authContext.logout();
          console.log('✅ Fonction logout appelée');
        }
      }
      
      console.log('🔄 Tentative de redirection...');
      
      // ✅ Essayer plusieurs méthodes de navigation
      
      // Méthode 1 : Navigation avec reset
      try {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Welcome' }],
        });
        console.log('✅ Méthode 1 réussie - navigation.reset vers Welcome');
        return;
      } catch (e) {
        console.log('❌ Méthode 1 échouée:', e.message);
      }
      
      // Méthode 2 : RootNavigation
      try {
        RootNavigation.reset({
          index: 0,
          routes: [{ name: 'Welcome' }],
        });
        console.log('✅ Méthode 2 réussie - RootNavigation.reset');
        return;
      } catch (e) {
        console.log('❌ Méthode 2 échouée:', e.message);
      }
      
      // Méthode 3 : Essayer Auth
      try {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Auth' }],
        });
        console.log('✅ Méthode 3 réussie - navigation vers Auth');
        return;
      } catch (e) {
        console.log('❌ Méthode 3 échouée:', e.message);
      }
      
      // Méthode 4 : Navigate simple vers Login
      try {
        navigation.navigate('Login');
        console.log('✅ Méthode 4 réussie - navigate vers Login');
        return;
      } catch (e) {
        console.log('❌ Méthode 4 échouée:', e.message);
      }
      
      // Méthode 5 : Navigate simple vers Welcome
      try {
        navigation.navigate('Welcome');
        console.log('✅ Méthode 5 réussie - navigate vers Welcome');
        return;
      } catch (e) {
        console.log('❌ Méthode 5 échouée:', e.message);
      }
      
      // Méthode 6 : Forcer le rechargement
      console.log('⚠️ Toutes les méthodes ont échoué, tentative de rechargement...');
      if (Platform.OS === 'web') {
        window.location.href = '/';
        console.log('✅ Redirection web forcée');
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de la déconnexion:', error);
    } finally {
      setIsLoading(false);
      console.log('🏁 Fin du processus de déconnexion');
    }
  };

  // Gérer la suppression du compte
  const handleDeleteAccount = () => {
    Alert.alert(
      'מחיקת חשבון',
      'האם אתה בטוח שברצונך למחוק את החשבון? פעולה זו אינה הפיכה.',
      [
        {
          text: 'ביטול',
          style: 'cancel',
        },
        {
          text: 'מחק',
          onPress: async () => {
            Alert.alert(
              'החשבון נמחק',
              'החשבון שלך נמחק בהצלחה'
            );
            
            await AsyncStorage.clear();
            
            if (authContext) {
              if (authContext.setUserToken) authContext.setUserToken(null);
              if (authContext.setUserInfo) authContext.setUserInfo(null);
              if (authContext.setUserRole) authContext.setUserRole(null);
            }
            
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
          <Text style={[styles.userName, styles.textRTL]}>
            {profileData.firstName} {profileData.lastName}
          </Text>
          <Text style={[styles.userEmail, styles.textRTL]}>{profileData.email}</Text>
        </View>

        {/* Informations personnelles */}
        <ProfileSection title="פרטים אישיים" isRTL={isRTL}>
          <ProfileOption
            icon="person-outline"
            title="ערוך פרטים"
            onPress={handleEditPersonalInfo}
            isRTL={isRTL}
          />
          <ProfileOption
            icon="call-outline"
            title="טלפון"
            value={profileData.phone}
            onPress={handleEditPersonalInfo}
            isRTL={isRTL}
          />
        </ProfileSection>

        {/* ✅ Adresse, ville et VIDÉO */}
        <ProfileSection title="הנכס שלי" isRTL={isRTL}>
          <ProfileOption
            icon="location-outline"
            title="עיר"
            value={profileData.city}
            onPress={handleEditAddress}
            isRTL={isRTL}
          />
          <ProfileOption
            icon="home-outline"
            title="כתובת"
            value={profileData.address}
            onPress={handleEditAddress}
            isRTL={isRTL}
          />
          {/* ✅ NOUVEAU : Option vidéo de propriété */}
          <ProfileOption
            icon="videocam-outline"
            title="וידאו של הנכס"
            value="📹"
            onPress={handlePropertyVideo}
            isRTL={isRTL}
          />
        </ProfileSection>

        {/* Préférences */}
        <ProfileSection title="העדפות" isRTL={isRTL}>
          <ProfileOption
            icon="language-outline"
            title="שפה"
            value={profileData.language}
            onPress={handleLanguageChange}
            isRTL={isRTL}
          />
          <ProfileOption
            icon="notifications-outline"
            title="התראות"
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
            isRTL={isRTL}
          />
        </ProfileSection>

        {/* Compte */}
        <ProfileSection title="חשבון" isRTL={isRTL}>
          {/* Bouton de déconnexion direct */}
          <TouchableOpacity 
            style={[styles.optionContainer, { backgroundColor: '#ffebee' }]} 
            onPress={handleLogout}
          >
            <View style={[styles.optionLeft, styles.optionLeftRTL]}>
              <Ionicons name="log-out-outline" size={24} color="#e74c3c" />
              <Text style={[styles.optionTitle, styles.textRTL, { color: '#e74c3c', fontWeight: 'bold' }]}>
                התנתק
              </Text>
            </View>
            <Ionicons name="chevron-back" size={20} color="#e74c3c" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
            <Text style={[styles.deleteAccountText, styles.textRTL]}>
              מחק חשבון
            </Text>
          </TouchableOpacity>
        </ProfileSection>
        
        {/* ✅ Informations de débogage (à retirer en production) */}
        {__DEV__ && (
          <ProfileSection title="מידע דיבאג (למפתחים)" isRTL={isRTL}>
            <View style={styles.debugContainer}>
              <Text style={[styles.debugText, styles.textRTL]}>
                עיר: {authContext?.userInfo?.city || 'לא מוגדר'}
              </Text>
              <Text style={[styles.debugText, styles.textRTL]}>
                כתובת: {authContext?.userInfo?.address || 'לא מוגדר'}
              </Text>
            </View>
          </ProfileSection>
        )}
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
  optionLeftRTL: {
    flexDirection: 'row-reverse',
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
  optionRightRTL: {
    flexDirection: 'row-reverse',
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
  debugContainer: {
    padding: 15,
    backgroundColor: '#f0f0f0',
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  textRTL: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
});

export default UserProfileScreen;