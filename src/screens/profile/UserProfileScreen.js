// src/screens/profile/UserProfileScreen.js — CleanCasa · bleu clair (maquette 10)
// Logique inchangée (navigation, logout, suppression de compte).
import React, { useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import { palette as C } from '../../config/theme';

const ProfileOption = ({ icon, title, onPress, value, rightComponent, last }) => (
  <TouchableOpacity style={[styles.option, last && styles.optionLast]} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.optionIcon}>
      <Ionicons name={icon} size={18} color={C.primary} />
    </View>
    <Text style={styles.optionTitle}>{title}</Text>
    {value ? <Text style={styles.optionValue} numberOfLines={1}>{value}</Text> : null}
    {rightComponent || <Ionicons name="chevron-back" size={18} color={C.subtle} />}
  </TouchableOpacity>
);

const ProfileSection = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionCard}>{children}</View>
  </View>
);

const UserProfileScreen = () => {
  const authContext = useContext(AuthContext);
  const navigation = useNavigation();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [profileData, setProfileData] = useState({
    firstName: '', lastName: '', email: '', phone: '', city: '', address: '', language: 'עברית',
  });

  useEffect(() => {
    if (authContext?.userInfo) {
      const u = authContext.userInfo;
      setProfileData({
        firstName: u.firstName || u.name || 'משתמש',
        lastName: u.lastName || '',
        email: u.email || 'email@example.com',
        phone: u.phone || 'לא צוין',
        city: u.city || 'לא צוין',
        address: u.address || 'לא צוינה',
        language: u.language || 'עברית',
      });
    }
  }, [authContext?.userInfo]);

  const handleEditPersonalInfo = () => navigation.navigate('EditPersonalInfo', { profileData });
  const handleLogout = () => authContext.logout();
  const handleDeleteAccount = () => {
    Alert.alert('מחיקת חשבון', 'האם אתה בטוח שברצונך למחוק את החשבון? פעולה זו אינה הפיכה.', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => setTimeout(() => authContext.logout(), 300) },
    ]);
  };

  const initials = `${profileData.firstName.charAt(0)}${profileData.lastName.charAt(0)}`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>פרופיל</Text>

        <TouchableOpacity style={styles.headerCard} onPress={handleEditPersonalInfo} activeOpacity={0.8}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{profileData.firstName} {profileData.lastName}</Text>
            <Text style={styles.userEmail}>{profileData.email}</Text>
          </View>
          <Ionicons name="create-outline" size={20} color={C.primary} />
        </TouchableOpacity>

        <ProfileSection title="פרטים אישיים">
          <ProfileOption icon="person-outline" title="ערוך פרטים" onPress={handleEditPersonalInfo} />
          <ProfileOption icon="call-outline" title="טלפון" value={profileData.phone} onPress={handleEditPersonalInfo} last />
        </ProfileSection>

        <ProfileSection title="הנכס שלי">
          <ProfileOption icon="location-outline" title="עיר" value={profileData.city} onPress={handleEditPersonalInfo} />
          <ProfileOption icon="home-outline" title="כתובת" value={profileData.address} onPress={handleEditPersonalInfo} />
          <ProfileOption icon="videocam-outline" title="וידאו של הנכס" onPress={() => navigation.navigate('PropertyVideo')} last />
        </ProfileSection>

        <ProfileSection title="העדפות">
          <ProfileOption icon="language-outline" title="שפה" value={profileData.language} onPress={() => navigation.navigate('LanguageSettings')} />
          <ProfileOption
            icon="notifications-outline"
            title="התראות"
            onPress={() => setNotificationsEnabled(!notificationsEnabled)}
            last
            rightComponent={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: C.borderStrong, true: C.accent }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={C.borderStrong}
              />
            }
          />
        </ProfileSection>

        <TouchableOpacity style={styles.logout} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={C.error} />
          <Text style={styles.logoutText}>התנתקות</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.delete} onPress={handleDeleteAccount}>
          <Text style={styles.deleteText}>מחק חשבון</Text>
        </TouchableOpacity>

        {__DEV__ && (
          <View style={styles.debug}>
            <Text style={styles.debugText}>עיר: {authContext?.userInfo?.city || 'לא מוגדר'}</Text>
            <Text style={styles.debugText}>כתובת: {authContext?.userInfo?.address || 'לא מוגדר'}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 32, gap: 16 },
  screenTitle: { fontSize: 26, fontWeight: '700', color: C.ink, textAlign: 'right' },
  headerCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 14 },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.tintStrong, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '700', color: C.primaryDark },
  userName: { fontSize: 18, fontWeight: '600', color: C.ink, textAlign: 'right' },
  userEmail: { fontSize: 13, color: C.muted, textAlign: 'right', marginTop: 2 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: C.muted, textAlign: 'right' },
  sectionCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14 },
  option: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.divider },
  optionLast: { borderBottomWidth: 0 },
  optionIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { flex: 1, fontSize: 15, color: C.ink, textAlign: 'right' },
  optionValue: { maxWidth: 140, fontSize: 13, color: C.muted, textAlign: 'left' },
  logout: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.errorBorder, borderRadius: 999, paddingVertical: 13, marginTop: 4 },
  logoutText: { fontSize: 15, fontWeight: '600', color: C.error },
  delete: { alignItems: 'center', paddingVertical: 6 },
  deleteText: { fontSize: 13, color: C.muted, textDecorationLine: 'underline' },
  debug: { padding: 12, backgroundColor: C.divider, borderRadius: 14 },
  debugText: { fontSize: 12, color: C.muted, textAlign: 'right', marginBottom: 4 },
});

export default UserProfileScreen;
