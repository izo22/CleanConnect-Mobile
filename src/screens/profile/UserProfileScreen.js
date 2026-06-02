// src/screens/profile/UserProfileScreen.js
// ✅ תורגם לעברית ישירות ללא i18n
// ✅ תוקן: הצגת עיר אמיתית מהפרופיל
// ✅ נוסף: גישה לוידאו של הנכס
// ✅ תוקן: עריכת כתובת ועיר דרך EditPersonalInfo
// ✅ תוקן: fix écran noir lors de la déconnexion

import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

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
  const isRTL = true;

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    city: '',
    address: '',
    language: 'עברית',
  });

  useEffect(() => {
    if (authContext?.userInfo) {
      setProfileData({
        firstName: authContext.userInfo.firstName || authContext.userInfo.name || 'משתמש',
        lastName: authContext.userInfo.lastName || '',
        email: authContext.userInfo.email || 'email@example.com',
        phone: authContext.userInfo.phone || 'לא צוין',
        city: authContext.userInfo.city || 'לא צוין',
        address: authContext.userInfo.address || 'לא צוינה',
        language: authContext.userInfo.language || 'עברית',
      });

      console.log('📋 נתוני פרופיל:', {
        city: authContext.userInfo.city,
        address: authContext.userInfo.address
      });
    }
  }, [authContext?.userInfo]);

  const handleLanguageChange = () => {
    navigation.navigate('LanguageSettings');
  };

  const handleEditPersonalInfo = () => {
    navigation.navigate('EditPersonalInfo', { profileData });
  };

  const handleEditAddress = () => {
    navigation.navigate('EditPersonalInfo', { profileData });
  };

  const handlePropertyVideo = () => {
    navigation.navigate('PropertyVideo');
  };

  // ✅ FIX écran noir : pas de setIsLoading local, l'écran va être démonté immédiatement
  const handleLogout = async () => {
    try {
      await authContext.logout();
    } catch (error) {
      console.error('❌ Erreur lors de la déconnexion:', error);
      Alert.alert('שגיאה', 'אירעה שגיאה בעת ההתנתקות. נסה שוב.');
    }
  };

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
            Alert.alert('החשבון נמחק', 'החשבון שלך נמחק בהצלחה');
            try {
              await authContext.logout();
            } catch (e) {
              console.error('❌ Erreur suppression compte:', e);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
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

        {/* Adresse, ville et vidéo */}
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

        {/* Informations de débogage */}
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