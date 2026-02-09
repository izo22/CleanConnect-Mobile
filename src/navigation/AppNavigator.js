import React, { useContext } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Text, View, TouchableOpacity } from 'react-native';

// Contexte d'authentification
import { AuthContext } from '../context/AuthContext';

// Écrans d'authentification
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import ClientRegistrationScreen from '../screens/auth/ClientRegistrationScreen';
import ProviderRegistrationScreen from '../screens/auth/ProviderRegistrationScreen';

// Écrans prestataires
import ProviderDashboardScreen from '../screens/provider/ProviderDashboardScreen';
import ProviderProfileScreen from '../screens/provider/ProviderProfileScreen';
import EditServiceScreen from '../screens/provider/EditServiceScreen';
import EditAvailabilityScreen from '../screens/provider/EditAvailabilityScreen';
import JobListScreen from '../screens/provider/JobListScreen';
import JobDetailsScreen from '../screens/provider/JobDetailsScreen';
import CalendarScreen from '../screens/provider/CalendarScreen';
import AvailabilityScreen from '../screens/provider/AvailabilityScreen';
import StatsScreen from '../screens/provider/StatsScreen';
import RequestsScreen from '../screens/provider/RequestsScreen';
import EditPersonalInfoScreen from '../screens/profile/EditPersonalInfoScreen';

// Écrans client
import HomeScreen from '../screens/client/HomeScreen';
import ServiceDetailsScreen from '../screens/client/ServiceDetails';
import ProviderSearchScreen from '../screens/client/ProviderSearch';
import ClientDashboardScreen from '../screens/client/ClientDashboardScreen';
import BookingDetailsScreen from '../screens/client/BookingDetailsScreen';

// Écrans booking
import ScheduleScreen from '../screens/booking/ScheduleScreen';
import BookingSummaryScreen from '../screens/booking/BookingSummaryScreen';
import BookingNotesScreen from '../screens/booking/BookingNotesScreen';
import PaymentScreen from '../screens/booking/PaymentScreen';
import BookingConfirmationScreen from '../screens/booking/BookingConfirmationScreen';
import AddressSelectionScreen from '../screens/client/AddressSelection';

// Importer ProfileStackNavigator
import ProfileStackNavigator from './ProfileStackNavigator';

// Écran Mot de passe oublié temporaire
const ForgotPasswordScreen = () => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>שכחתי סיסמה</Text>
    </View>
  );
};

// Écran Reviews temporaire pour les prestataires
const ReviewsScreen = () => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>ביקורות</Text>
    </View>
  );
};

// Piles de navigation
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const ProviderStack = createStackNavigator();
const ClientStack = createStackNavigator();
const ProviderProfileStack = createStackNavigator();

// Options d'en-tête standard
const getHeaderOptions = (title) => ({
  title: title,
  headerShown: true,
  headerStyle: {
    backgroundColor: '#2E86C1',
  },
  headerTintColor: '#fff',
  headerTitleStyle: {
    fontWeight: 'bold',
  }
});

// Navigateur principal des écrans client
const ClientMainStack = () => {
  return (
    <ClientStack.Navigator 
      screenOptions={{ 
        headerShown: true,
        headerStyle: {
          backgroundColor: '#2E86C1',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        }
      }}
    >
      <ClientStack.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ 
          headerShown: false
        }} 
      />
      <ClientStack.Screen 
        name="ServiceDetails" 
        component={ServiceDetailsScreen} 
        options={getHeaderOptions("פרטי שירות")}
      />
      <ClientStack.Screen 
        name="ProviderSearch" 
        component={ProviderSearchScreen} 
        options={{ headerShown: false }}
      />
      <ClientStack.Screen 
        name="AddressSelection" 
        component={AddressSelectionScreen}
        options={getHeaderOptions("בחירת כתובת")}
      />
      <ClientStack.Screen 
        name="ScheduleScreen" 
        component={ScheduleScreen}
        options={{ headerShown: false }}
      />
      <ClientStack.Screen 
        name="BookingSummary" 
        component={BookingSummaryScreen}
        options={{ headerShown: false }}
      />
      <ClientStack.Screen 
        name="BookingNotes" 
        component={BookingNotesScreen}
        options={getHeaderOptions("הערות להזמנה")}
      />
      <ClientStack.Screen 
        name="PaymentScreen" 
        component={PaymentScreen}
        options={{ headerShown: false }}
      />
      <ClientStack.Screen 
        name="BookingConfirmation" 
        component={BookingConfirmationScreen}
        options={getHeaderOptions("אישור הזמנה")}
      />
      <ClientStack.Screen 
        name="BookingDetails" 
        component={BookingDetailsScreen}
        options={getHeaderOptions("פרטי הזמנה")}
      />
    </ClientStack.Navigator>
  );
};

// Configuration des onglets de l'application principale pour les clients
const ClientTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'HomeStack') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Dashboard') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3498db',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="HomeStack" 
        component={ClientMainStack} 
        options={{
          title: 'בית',
        }}
      />
      <Tab.Screen 
        name="Dashboard" 
        component={ClientDashboardScreen} 
        options={{
          title: 'הזמנות',
          headerShown: true,
          header: () => (
            <View style={{ height: 90, backgroundColor: '#2E86C1', justifyContent: 'flex-end', paddingBottom: 10, paddingHorizontal: 15 }}>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>הזמנות</Text>
            </View>
          )
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          title: 'פרופיל',
        }}
      />
    </Tab.Navigator>
  );
};

// Navigateur pour les écrans de profil prestataire
const ProviderProfileNavigator = () => {
  return (
    <ProviderProfileStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2E86C1',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        }
      }}
    >
      <ProviderProfileStack.Screen 
        name="ProviderProfile" 
        component={ProviderProfileScreen} 
        options={getHeaderOptions('הפרופיל שלי')} 
      />
      <ProviderProfileStack.Screen 
        name="EditService" 
        component={EditServiceScreen} 
        options={getHeaderOptions('עריכת שירות')} 
      />
      <ProviderProfileStack.Screen 
        name="AddService" 
        component={EditServiceScreen} 
        options={getHeaderOptions('הוסף שירות')} 
      />
      <ProviderProfileStack.Screen 
        name="EditAvailability" 
        component={EditAvailabilityScreen} 
        options={getHeaderOptions('ניהול זמינות')} 
      />
      <ProviderProfileStack.Screen 
        name="EditServiceAreas" 
        component={AvailabilityScreen} 
        options={getHeaderOptions('אזורי שירות')} 
      />
      <ProviderProfileStack.Screen 
        name="EditContact" 
        component={ProfileStackNavigator} 
        options={getHeaderOptions('פרטי קשר')} 
      />
      <ProviderProfileStack.Screen 
        name="EditExperience" 
        component={ProfileStackNavigator} 
        options={getHeaderOptions('ניסיון')} 
      />
      <ProviderProfileStack.Screen 
        name="EditPersonalInfo" 
        component={EditPersonalInfoScreen}
        options={getHeaderOptions('מידע אישי')} 
      />
    </ProviderProfileStack.Navigator>
  );
};

// Configuration des onglets de l'application principale pour les prestataires
const ProviderTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Jobs') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3498db',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={ProviderDashboardScreen} 
        options={{
          title: 'לוח בקרה',
          headerShown: true,
          header: () => (
            <View style={{ height: 90, backgroundColor: '#2E86C1', justifyContent: 'flex-end', paddingBottom: 10, paddingHorizontal: 15 }}>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>לוח בקרה</Text>
            </View>
          )
        }}
      />
      <Tab.Screen 
        name="Jobs" 
        component={ProviderJobsNavigator} 
        options={{
          title: 'משימות',
        }}
      />
      <Tab.Screen 
        name="Calendar" 
        component={CalendarScreen} 
        options={{
          title: 'יומן',
          headerShown: true,
          header: () => (
            <View style={{ height: 90, backgroundColor: '#2E86C1', justifyContent: 'flex-end', paddingBottom: 10, paddingHorizontal: 15 }}>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>יומן</Text>
            </View>
          )
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProviderProfileNavigator}
        options={{
          title: 'פרופיל',
        }}
      />
    </Tab.Navigator>
  );
};

// Navigateur pour les écrans liés aux missions des prestataires
const ProviderJobsNavigator = () => {
  return (
    <ProviderStack.Navigator>
      <ProviderStack.Screen 
        name="JobList" 
        component={JobListScreen} 
        options={getHeaderOptions('המשימות שלי')} 
      />
      <ProviderStack.Screen 
        name="RequestsScreen" 
        component={RequestsScreen} 
        options={getHeaderOptions('כל הבקשות')} 
      />
      <ProviderStack.Screen 
        name="JobDetails" 
        component={JobDetailsScreen} 
        options={getHeaderOptions('פרטי משימה')} 
      />
      <ProviderStack.Screen 
        name="Stats" 
        component={StatsScreen} 
        options={getHeaderOptions('סטטיסטיקות')} 
      />
      <ProviderStack.Screen 
        name="Availability" 
        component={AvailabilityScreen} 
        options={getHeaderOptions('זמינות')} 
      />
      <ProviderStack.Screen 
        name="Reviews" 
        component={ReviewsScreen} 
        options={getHeaderOptions('ביקורות')} 
      />
    </ProviderStack.Navigator>
  );
};

// Navigation principale de l'application
const AppNavigator = () => {
  const { userToken, userRole, isLoading } = useContext(AuthContext);
  
  // Afficher un écran de chargement pendant l'initialisation
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>טוען...</Text>
      </View>
    );
  }
  
  // Logique de navigation basée sur l'état d'authentification
  const isAuthenticated = !!userToken;
  
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        // Routes authentifiées
        userRole === "provider" ? (
          // Interface prestataire
          <Stack.Screen name="ProviderTabs" component={ProviderTabs} />
        ) : (
          // Interface client
          <Stack.Screen name="ClientTabs" component={ClientTabs} />
        )
      ) : (
        // Routes non-authentifiées
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="ClientRegistration" component={ClientRegistrationScreen} />
          <Stack.Screen name="ProviderRegistration" component={ProviderRegistrationScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;