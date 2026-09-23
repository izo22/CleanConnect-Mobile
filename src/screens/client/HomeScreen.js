// src/screens/client/HomeScreen.js
// ✅ VERSION "LIGHT BLUE" — hero bleu clair, cards arrondies avec ombre douce
// Toutes les données restent dynamiques (utilisateur connecté, types de service)

import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SERVICE_TYPES, SERVICE_COLORS } from '../../config/constants';
import { useAuth } from '../../context/AuthContext';
import { useBooking } from '../../context/BookingContext';
import { theme } from '../../config/theme';

const ServiceCard = ({ title, description, color, icon, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.cardIconContainer, { backgroundColor: `${color}14` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>

      <TouchableOpacity
        style={[styles.cardButton, { backgroundColor: color }]}
        onPress={onPress}
      >
        <Text style={styles.cardButtonText}>הזמן עכשיו</Text>
        <Ionicons name="arrow-back" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const HomeScreen = ({ navigation }) => {
  const { userInfo } = useAuth();
  const { updateBooking } = useBooking();

  const serviceOptions = [
    {
      type: SERVICE_TYPES.HOME,
      title: 'ניקיון בית',
      color: SERVICE_COLORS.HOME,
      description: 'ניקיון מקצועי לבית שלך, מותאם לצרכים הספציפיים שלך',
      icon: 'home'
    },
    {
      type: SERVICE_TYPES.OFFICE,
      title: 'ניקיון משרדים',
      color: SERVICE_COLORS.OFFICE,
      description: 'שירותים מלאים למשרדים וחללים מקצועיים',
      icon: 'briefcase'
    },
    {
      type: SERVICE_TYPES.BUILDING,
      title: 'ניקיון בניינים',
      color: SERVICE_COLORS.BUILDING,
      description: 'תחזוקה של חלקים משותפים ובניינים מגורים',
      icon: 'business'
    },
    {
      type: SERVICE_TYPES.AIRBNB,
      title: 'ניקיון אירבנב',
      color: SERVICE_COLORS.AIRBNB,
      description: 'שירות ניקיון מקצועי לדירות אירבנב. ניקיון מהיר ויעיל בין אורחים',
      icon: 'key'
    }
  ];

  const navigateToService = (serviceType) => {
    updateBooking({
      serviceType: serviceType,
      duration: 2,
      frequency: 'one_time'
    });

    navigation.navigate('ProviderSearch', {
      serviceType,
      duration: '2',
      frequency: 'once'
    });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* HERO BLEU CLAIR */}
      <LinearGradient
        colors={[theme.colors.primaryDark, theme.colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.greeting}>
          שלום, {userInfo?.firstName || 'לקוח'} 👋
        </Text>

        <Text style={styles.subtitle}>
          איזה סוג שירות אתה מחפש?
        </Text>
      </LinearGradient>

      {/* CARDS DE SERVICES */}
      <View style={styles.servicesContainer}>
        {serviceOptions.map((service) => (
          <ServiceCard
            key={service.type}
            title={service.title}
            description={service.description}
            color={service.color}
            icon={service.icon}
            onPress={() => navigateToService(service.type)}
          />
        ))}
      </View>

      {/* QUICK ACTIONS */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <View style={styles.actionIconContainer}>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
          </View>
          <Text style={styles.actionCardTitle}>ההזמנות שלי</Text>
          <Text style={styles.actionCardSubtitle}>צפה בהזמנות</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={styles.actionIconContainer}>
            <Ionicons name="person-outline" size={20} color={theme.colors.primary} />
          </View>
          <Text style={styles.actionCardTitle}>הפרופיל שלי</Text>
          <Text style={styles.actionCardSubtitle}>ערוך פרטים</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // HERO BLEU CLAIR
  header: {
    paddingTop: 64,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'right',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'right',
    letterSpacing: -0.2,
  },

  // CARDS DE SERVICES
  servicesContainer: {
    padding: 16,
    paddingTop: 20,
    marginTop: -20,
  },
  card: {
    backgroundColor: theme.colors.surface,
    marginBottom: 16,
    borderRadius: theme.roundness.large,
    padding: 20,
    ...theme.shadow,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'flex-end',
  },
  cardContent: {
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: '600',
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 6,
    textAlign: 'right',
    letterSpacing: -0.3,
  },
  cardDescription: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  cardButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: theme.roundness.medium,
  },
  cardButtonText: {
    fontWeight: '600',
    fontSize: 13,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.2,
  },

  // QUICK ACTIONS
  actionsContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: theme.roundness.large,
    alignItems: 'center',
    ...theme.shadow,
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: `${theme.colors.primary}14`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionCardTitle: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  actionCardSubtitle: {
    color: theme.colors.textLight,
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: -0.2,
  },
});

export default HomeScreen;
