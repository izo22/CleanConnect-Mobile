// src/screens/client/HomeScreen.js
// ✅ VERSION PREMIUM MINIMALISTE
// Style ultra-épuré : Stripe, Linear, Revolut
// Maximum d'espace blanc, typographie légère, accents subtils

import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SERVICE_TYPES, SERVICE_COLORS } from '../../config/constants';
import { useAuth } from '../../context/AuthContext';
import { useBooking } from '../../context/BookingContext';

const ServiceCard = ({ title, description, color, icon, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.cardIconContainer, { backgroundColor: `${color}10` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
      
      <TouchableOpacity 
        style={[styles.cardButton, { borderColor: color }]}
        onPress={onPress}
      >
        <Text style={[styles.cardButtonText, { color }]}>הזמן עכשיו</Text>
        <Ionicons name="arrow-back" size={14} color={color} style={{ marginRight: 4 }} />
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
    <ScrollView style={styles.container}>
      {/* HEADER MINIMALISTE BLANC */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          שלום, {userInfo?.firstName || 'לקוח'}
        </Text>
        
        <Text style={styles.subtitle}>
          איזה סוג שירות אתה מחפש?
        </Text>
        
        <View style={styles.blueLine} />
      </View>

      {/* CARDS DE SERVICES ULTRA-MINIMALISTES */}
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

      {/* QUICK ACTIONS MINIMALISTES */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <View style={styles.actionIconContainer}>
            <Ionicons name="calendar-outline" size={20} color="#2E86C1" />
          </View>
          <Text style={styles.actionCardTitle}>ההזמנות שלי</Text>
          <Text style={styles.actionCardSubtitle}>צפה בהזמנות</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={styles.actionIconContainer}>
            <Ionicons name="person-outline" size={20} color="#2E86C1" />
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
    backgroundColor: '#FFFFFF',
  },
  
  // HEADER MINIMALISTE BLANC
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'right',
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#9CA3AF',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 16,
  },
  blueLine: {
    height: 3,
    width: '100%',
    backgroundColor: '#2E86C1',
    borderRadius: 2,
  },
  
  // CARDS DE SERVICES ULTRA-MINIMALISTES
  servicesContainer: {
    padding: 16,
    paddingTop: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 10,
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
    color: '#1F2937',
    marginBottom: 6,
    textAlign: 'right',
    letterSpacing: -0.3,
  },
  cardDescription: {
    color: '#6B7280',
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
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  cardButtonText: {
    fontWeight: '500',
    fontSize: 13,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  
  // QUICK ACTIONS ULTRA-MINIMALISTES
  actionsContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#2E86C110',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionCardTitle: {
    color: '#1F2937',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  actionCardSubtitle: {
    color: '#9CA3AF',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: -0.2,
  },
});

export default HomeScreen;