// src/screens/client/HomeScreen.js
// ✅ VERSION MODERNE - Design startup avec header personnalisé

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
      <View style={[styles.cardIconContainer, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={32} color={color} />
      </View>
      
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
      
      <View style={[styles.cardButton, { backgroundColor: color }]}>
        <Text style={styles.cardButtonText}>הזמן עכשיו</Text>
        <Ionicons name="arrow-back" size={16} color="white" style={{ marginRight: 4 }} />
      </View>
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
      {/* ✅ HEADER MODERNE PERSONNALISÉ */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>
            שלום, {userInfo?.firstName || 'לקוח'}
          </Text>
          <Text style={styles.subtitle}>
            איזה סוג שירות אתה מחפש?
          </Text>
        </View>
      </View>

      {/* ✅ CARDS DE SERVICES MODERNES */}
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

      {/* ✅ BOUTONS D'ACTIONS MODERNES */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <View style={styles.actionIconContainer}>
            <Ionicons name="calendar" size={24} color="#2E86C1" />
          </View>
          <Text style={styles.actionCardTitle}>ההזמנות שלי</Text>
          <Text style={styles.actionCardSubtitle}>צפה בהזמנות</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={styles.actionIconContainer}>
            <Ionicons name="person" size={24} color="#2E86C1" />
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
    backgroundColor: '#F8F9FA',
  },
  
  // ✅ HEADER MODERNE
  header: {
    backgroundColor: '#2E86C1',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
    textAlign: 'right',
    fontWeight: '500',
  },
  
  // ✅ CARDS DE SERVICES MODERNES
  servicesContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'flex-end',
  },
  cardContent: {
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 20,
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'right',
  },
  cardDescription: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',
    fontWeight: '500',
  },
  cardButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  cardButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  
  // ✅ ACTIONS CARDS MODERNES
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
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionCardTitle: {
    color: '#1F2937',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  actionCardSubtitle: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default HomeScreen;