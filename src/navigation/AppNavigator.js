// src/navigation/AppNavigator.js
// ✅ VERSION DEBUG ÉCRAN NOIR — logs sur chaque render et switch de navigator

import React, { useContext, useEffect, useRef } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { AuthContext } from '../context/AuthContext';

import WelcomeScreen              from '../screens/auth/WelcomeScreen';
import LoginScreen                from '../screens/auth/LoginScreen';
import ClientRegistrationScreen   from '../screens/auth/ClientRegistrationScreen';
import ProviderRegistrationScreen from '../screens/auth/ProviderRegistrationScreen';

import ProviderDashboardScreen from '../screens/provider/ProviderDashboardScreen';
import ProviderProfileScreen   from '../screens/provider/ProviderProfileScreen';
import EditServiceScreen       from '../screens/provider/EditServiceScreen';
import EditAvailabilityScreen  from '../screens/provider/EditAvailabilityScreen';
import JobDetailsScreen        from '../screens/provider/JobDetailsScreen';
import CalendarScreen          from '../screens/provider/CalendarScreen';
import AvailabilityScreen      from '../screens/provider/AvailabilityScreen';
import StatsScreen             from '../screens/provider/StatsScreen';
import RequestsScreen          from '../screens/provider/RequestsScreen';
import EditPersonalInfoScreen  from '../screens/profile/EditPersonalInfoScreen';

import HomeScreen            from '../screens/client/HomeScreen';
import ServiceDetailsScreen  from '../screens/client/ServiceDetails';
import ProviderSearchScreen  from '../screens/client/ProviderSearch';
import ClientDashboardScreen from '../screens/client/ClientDashboardScreen';
import BookingDetailsScreen  from '../screens/client/BookingDetailsScreen';

import ScheduleScreen          from '../screens/booking/ScheduleScreen';
import BookingSummaryScreen    from '../screens/booking/BookingSummaryScreen';
import BookingNotesScreen      from '../screens/booking/BookingNotesScreen';
import PaymentScreen           from '../screens/booking/PaymentScreen';
import BookingConfirmationScreen from '../screens/booking/BookingConfirmationScreen';
import AddressSelectionScreen  from '../screens/client/AddressSelection';

import ProfileStackNavigator from './ProfileStackNavigator';
import { Text, View, Alert } from 'react-native';
// ── Logger ───────────────────────────────────────────────────────────────────
const LOG_PREFIX = '🧭 [AppNavigator]';
const log = (msg, data) => {
  if (data !== undefined) {
    console.log(`${LOG_PREFIX} ${msg}`, JSON.stringify(data));
  } else {
    console.log(`${LOG_PREFIX} ${msg}`);
  }
};

// ── Écrans temporaires ────────────────────────────────────────────────────────
const ForgotPasswordScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>שכחתי סיסמה</Text>
  </View>
);

const ReviewsScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>ביקורות</Text>
  </View>
);

// ── Design system ─────────────────────────────────────────────────────────────
const HEADER_STYLE = {
  backgroundColor: '#FFFFFF',
  elevation: 0,
  shadowOpacity: 0,
  borderBottomWidth: 1,
  borderBottomColor: '#F3F4F6',
};

const HEADER_TITLE_STYLE = {
  fontSize: 16,
  fontWeight: '600',
  color: '#111827',
  letterSpacing: -0.3,
};

const STACK_SCREEN_OPTIONS = {
  headerShown: true,
  headerStyle: HEADER_STYLE,
  headerTintColor: '#111827',
  headerTitleStyle: HEADER_TITLE_STYLE,
  headerTitleAlign: 'center',
  headerBackTitleVisible: false,
};

const getHeaderOptions = (title) => ({ ...STACK_SCREEN_OPTIONS, title });

// ── Navigateurs ───────────────────────────────────────────────────────────────
const Stack                = createStackNavigator();
const Tab                  = createBottomTabNavigator();
const ProviderStack        = createStackNavigator();
const ClientStack          = createStackNavigator();
const ProviderProfileStack = createStackNavigator();

// ── Stack Client ──────────────────────────────────────────────────────────────
const ClientMainStack = () => {
  log('📦 ClientMainStack render');
  return (
    <ClientStack.Navigator screenOptions={STACK_SCREEN_OPTIONS}>
      <ClientStack.Screen name="Home"               component={HomeScreen}               options={{ headerShown: false }} />
      <ClientStack.Screen name="ServiceDetails"     component={ServiceDetailsScreen}     options={getHeaderOptions('פרטי שירות')} />
      <ClientStack.Screen name="ProviderSearch"     component={ProviderSearchScreen}     options={{ headerShown: false }} />
      <ClientStack.Screen name="AddressSelection"   component={AddressSelectionScreen}   options={getHeaderOptions('בחירת כתובת')} />
      <ClientStack.Screen name="ScheduleScreen"     component={ScheduleScreen}           options={{ headerShown: false }} />
      <ClientStack.Screen name="BookingSummary"     component={BookingSummaryScreen}     options={{ headerShown: false }} />
      <ClientStack.Screen name="BookingNotes"       component={BookingNotesScreen}       options={getHeaderOptions('הערות להזמנה')} />
      <ClientStack.Screen name="PaymentScreen"      component={PaymentScreen}            options={{ headerShown: false }} />
      <ClientStack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} options={getHeaderOptions('אישור הזמנה')} />
      <ClientStack.Screen name="BookingDetails"     component={BookingDetailsScreen}     options={{ headerShown: false }} />
    </ClientStack.Navigator>
  );
};

// ── Tabs Client ───────────────────────────────────────────────────────────────
const ClientTabs = () => {
  log('📦 ClientTabs render');
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            HomeStack: focused ? 'home'     : 'home-outline',
            Dashboard: focused ? 'calendar' : 'calendar-outline',
            Profile:   focused ? 'person'   : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#111827',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="HomeStack"  component={ClientMainStack}       options={{ title: 'בית' }} />
      <Tab.Screen name="Dashboard"  component={ClientDashboardScreen}  options={{ title: 'הזמנות', headerShown: false }} />
      <Tab.Screen name="Profile"    component={ProfileStackNavigator}  options={{ title: 'פרופיל' }} />
    </Tab.Navigator>
  );
};

// ── Stack Profil Prestataire ──────────────────────────────────────────────────
const ProviderProfileNavigator = () => {
  log('📦 ProviderProfileNavigator render');
  return (
    <ProviderProfileStack.Navigator screenOptions={STACK_SCREEN_OPTIONS}>
      <ProviderProfileStack.Screen name="ProviderProfile"  component={ProviderProfileScreen}  options={getHeaderOptions('הפרופיל שלי')} />
      <ProviderProfileStack.Screen name="EditService"      component={EditServiceScreen}       options={getHeaderOptions('עריכת שירות')} />
      <ProviderProfileStack.Screen name="AddService"       component={EditServiceScreen}       options={getHeaderOptions('הוסף שירות')} />
      <ProviderProfileStack.Screen name="EditAvailability" component={EditAvailabilityScreen}  options={getHeaderOptions('ניהול זמינות')} />
      <ProviderProfileStack.Screen name="EditServiceAreas" component={AvailabilityScreen}      options={getHeaderOptions('אזורי שירות')} />
      <ProviderProfileStack.Screen name="EditContact"      component={ProfileStackNavigator}   options={getHeaderOptions('פרטי קשר')} />
      <ProviderProfileStack.Screen name="EditExperience"   component={ProfileStackNavigator}   options={getHeaderOptions('ניסיון')} />
      <ProviderProfileStack.Screen name="EditPersonalInfo" component={EditPersonalInfoScreen}  options={getHeaderOptions('מידע אישי')} />
    </ProviderProfileStack.Navigator>
  );
};

// ── Stack Missions Prestataire ────────────────────────────────────────────────
const ProviderJobsNavigator = () => {
  log('📦 ProviderJobsNavigator render');
  return (
    <ProviderStack.Navigator screenOptions={STACK_SCREEN_OPTIONS}>
      <ProviderStack.Screen name="JobList"        component={RequestsScreen}     options={getHeaderOptions('כל הבקשות')} />
      <ProviderStack.Screen name="RequestsScreen" component={RequestsScreen}     options={getHeaderOptions('כל הבקשות')} />
      <ProviderStack.Screen name="JobDetails"     component={JobDetailsScreen}   options={getHeaderOptions('פרטי משימה')} />
      <ProviderStack.Screen name="Stats"          component={StatsScreen}        options={getHeaderOptions('סטטיסטיקות')} />
      <ProviderStack.Screen name="Availability"   component={AvailabilityScreen} options={getHeaderOptions('זמינות')} />
      <ProviderStack.Screen name="Reviews"        component={ReviewsScreen}      options={getHeaderOptions('ביקורות')} />
    </ProviderStack.Navigator>
  );
};

// ── Tabs Prestataire ──────────────────────────────────────────────────────────
const ProviderTabs = () => {
  log('📦 ProviderTabs render');
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Dashboard: focused ? 'home'     : 'home-outline',
            Jobs:      focused ? 'list'     : 'list-outline',
            Calendar:  focused ? 'calendar' : 'calendar-outline',
            Profile:   focused ? 'person'   : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#111827',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={ProviderDashboardScreen}
        options={{
          title: 'לוח בקרה',
          headerShown: true,
          headerStyle: HEADER_STYLE,
          headerTitleStyle: HEADER_TITLE_STYLE,
          headerTitleAlign: 'center',
          headerTitle: 'לוח בקרה',
        }}
      />
      <Tab.Screen name="Jobs"     component={ProviderJobsNavigator}    options={{ title: 'משימות' }} />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          title: 'יומן',
          headerShown: true,
          headerStyle: HEADER_STYLE,
          headerTitleStyle: HEADER_TITLE_STYLE,
          headerTitleAlign: 'center',
          headerTitle: 'יומן',
        }}
      />
      <Tab.Screen name="Profile" component={ProviderProfileNavigator} options={{ title: 'פרופיל' }} />
    </Tab.Navigator>
  );
};

// ── AppNavigator principal ────────────────────────────────────────────────────
const AppNavigator = () => {
  const { userToken, userRole, isLoading } = useContext(AuthContext);

  const prevTokenRef = React.useRef(userToken);

  React.useEffect(() => {
    if (prevTokenRef.current !== userToken) {
      Alert.alert(
        'NAV DEBUG',
        `token: ${prevTokenRef.current ? 'PRÉSENT' : 'NULL'} → ${userToken ? 'PRÉSENT' : 'NULL'}\nrole: ${userRole || 'NULL'}\nisLoading: ${isLoading}`
      );
      prevTokenRef.current = userToken;
    }
  });

  if (isLoading) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
      }}>
        <Text style={{ color: '#6B7280', fontSize: 15, fontWeight: '400' }}>
          טוען...
        </Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!userToken ? (
        <>
          <Stack.Screen name="Welcome"              component={WelcomeScreen} />
          <Stack.Screen name="Login"                component={LoginScreen} />
          <Stack.Screen name="ClientRegistration"   component={ClientRegistrationScreen} />
          <Stack.Screen name="ProviderRegistration" component={ProviderRegistrationScreen} />
          <Stack.Screen name="ForgotPassword"       component={ForgotPasswordScreen} />
        </>
      ) : userRole === 'provider' ? (
        <Stack.Screen name="ProviderTabs" component={ProviderTabs} />
      ) : (
        <Stack.Screen name="ClientTabs" component={ClientTabs} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;