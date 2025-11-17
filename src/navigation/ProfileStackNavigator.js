import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Écrans de profil utilisateur
import UserProfileScreen from '../screens/profile/UserProfileScreen';
import EditPersonalInfoScreen from '../screens/profile/EditPersonalInfoScreen';
import ManageAddressesScreen from '../screens/profile/ManageAddressesScreen';
import EditAddressScreen from '../screens/profile/EditAddressScreen';
import LanguageSettingsScreen from '../screens/profile/LanguageSettingsScreen';
import EditPhoneScreen from '../screens/profile/EditPhoneScreen';

const Stack = createStackNavigator();

// Navigateur de la pile du profil
const ProfileStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="EditPersonalInfo" component={EditPersonalInfoScreen} />
      <Stack.Screen name="ManageAddresses" component={ManageAddressesScreen} />
      <Stack.Screen name="EditAddress" component={EditAddressScreen} />
      <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} />
      <Stack.Screen name="EditPhone" component={EditPhoneScreen} />
    </Stack.Navigator>
  );
};

export default ProfileStackNavigator;
