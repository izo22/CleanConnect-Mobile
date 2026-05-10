// ProviderProfileScreen.js - REFONTE UI MINIMALISTE PREMIUM
/*
CHANGEMENTS MAJEURS:
- Typographie: tailles réduites (28→24, 24→20, 16→14, 14→12)
- Poids: 'bold' → '600', '500' → '400'  
- Container: fond #F9FAFB
- Cards: borderRadius 12px, bordures 1px #F3F4F6, shadowOpacity 0.03
- Badges: backgroundColor à 10% d'opacité, borderRadius 6px
- Stats: fontSize 24→20, fontWeight 'bold'→'600'
- Buttons: paddingVertical 12, borderRadius 8px
- Icons: size réduits (50→40, 24→20)
- Colors: #111827 pour textes, #6B7280 pour secondaires, #9CA3AF pour disabled
- Spacing: doublé entre sections (16→32)
*/
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { providerService } from '../../services/api';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const ProviderProfileScreen = () => {
  const isRTL = true;
  const { logout } = useContext(AuthContext);
  const navigation = useNavigation();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProviderData = async () => {
    try {
      setLoading(true);
      const response = await providerService.getProviderProfile();
      setProvider(response.data);
      setError(null);
    } catch (err) {
      setError('שגיאה בטעינת הפרופיל');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProviderData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchProviderData();
    }, [])
  );

  const handleLogout = async () => {
    Alert.alert(
      'התנתקות',
      'האם אתה בטוח שברצונך להתנתק?',
      [
        {
          text: 'ביטול',
          style: 'cancel'
        },
        {
          text: 'התנתק',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await logout();
            } catch (error) {
              Alert.alert('שגיאה', 'שגיאה בהתנתקות. אנא נסה שוב.');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={[styles.loadingText, styles.textRTL]}>טוען...</Text>
      </View>
    );
  }

  if (error && !provider) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={40} color="#EF4444" />
        <Text style={[styles.errorText, styles.textRTL]}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchProviderData}>
          <Text style={styles.retryButtonText}>נסה שוב</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.emptyText, styles.textRTL]}>אין נתונים להצגה</Text>
        <TouchableOpacity style={[styles.retryButton, { marginTop: 20 }]} onPress={fetchProviderData}>
          <Text style={styles.retryButtonText}>רענן</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pendingRequests = provider.requests?.filter(req => req.status === 'pending').length || 0;
  const completedJobs = provider.requests?.filter(req => req.status === 'completed').length || 0;

  const getLocalizedDate = (dateString) => {
    try {
      const date = new Date(dateString);
      const monthNames = [
        'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
      ];
      return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    } catch (error) {
      return dateString;
    }
  };

  const getDayName = (dayNumber) => {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return days[dayNumber] || '';
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchProviderData();
            }}
          />
        }
      >
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.headerInfo}>
              <Text style={[styles.name, styles.textRTL]}>
                {`${provider.firstName} ${provider.lastName}`}
              </Text>
              <Text style={[styles.email, styles.textRTL]}>
                {provider.email}
              </Text>
              {provider.phone && (
                <Text style={[styles.phone, styles.textRTL]}>
                  {provider.phone}
                </Text>
              )}
              {provider.joinDate && (
                <Text style={[styles.joinDate, styles.textRTL]}>
                  הצטרף {getLocalizedDate(provider.joinDate)}
                </Text>
              )}
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{pendingRequests}</Text>
              <Text style={[styles.statLabel, styles.textRTL]}>ממתינות</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{completedJobs}</Text>
              <Text style={[styles.statLabel, styles.textRTL]}>הושלמו</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {provider.rating ? provider.rating.toFixed(1) : '0.0'}
              </Text>
              <Text style={[styles.statLabel, styles.textRTL]}>דירוג</Text>
            </View>
          </View>
        </View>

        {/* Services */}
        <View style={styles.card}>
          <Text style={[styles.sectionTitle, styles.textRTL]}>שירותים</Text>
          {provider.serviceDetails && provider.serviceDetails.length > 0 ? (
            provider.serviceDetails.map((service, index) => (
              <View key={index} style={[styles.serviceItem, index !== provider.serviceDetails.length - 1 && styles.serviceItemBorder]}>
                <View style={styles.serviceInfo}>
                  <Text style={[styles.serviceType, styles.textRTL]}>
                    {service.type}
                  </Text>
                  <Text style={[styles.serviceRate, styles.textRTL]}>
                    ₪{service.hourlyRate} לשעה
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyMessage, styles.textRTL]}>
              אין שירותים רשומים
            </Text>
          )}
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditService', {
              serviceDetails: provider.serviceDetails || [],
              serviceAreas: provider.serviceAreas || [],
            })}
            >
            <Icon name="edit" size={18} color="#007AFF" />
            <Text style={[styles.editButtonText, styles.textRTL]}>ערוך שירותים</Text>
          </TouchableOpacity>
        </View>

        {/* Service Areas */}
        {provider.serviceAreas && provider.serviceAreas.length > 0 && (
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, styles.textRTL]}>אזורי שירות</Text>
            <View style={styles.serviceAreasContainer}>
              {provider.serviceAreas.map((area, index) => (
                <View key={index} style={styles.areaBadge}>
                  <Text style={[styles.areaBadgeText, styles.textRTL]}>{area}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Availability */}
        {provider.availability && provider.availability.length > 0 && (
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, styles.textRTL]}>זמינות</Text>
            {provider.availability.map((slot, index) => (
              <View 
                key={index} 
                style={[
                  styles.availabilityItem, 
                  styles.availabilityItemRTL,
                  index !== provider.availability.length - 1 && styles.availabilityItemBorder
                ]}
              >
                <Text style={[styles.dayName, styles.textRTL]}>
                  {getDayName(slot.day)}
                </Text>
                <Text style={[styles.timeSlot, styles.textRTL]}>
                  {slot.startTime} - {slot.endTime}
                </Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('EditAvailability', { availability: provider.availability })}
            >
              <Icon name="edit" size={18} color="#007AFF" />
              <Text style={[styles.editButtonText, styles.textRTL]}>ערוך זמינות</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Additional Info */}
        {(provider.companyName || provider.businessLicense || provider.description) && (
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, styles.textRTL]}>מידע נוסף</Text>
            
            {provider.companyName && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, styles.textRTL]}>שם חברה</Text>
                <Text style={[styles.infoValue, styles.textRTL]}>{provider.companyName}</Text>
              </View>
            )}
            
            {provider.businessLicense && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, styles.textRTL]}>רישיון עסק</Text>
                <Text style={[styles.infoValue, styles.textRTL]}>{provider.businessLicense}</Text>
              </View>
            )}
            
            {provider.description && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, styles.textRTL]}>תיאור</Text>
                <Text style={[styles.infoValue, styles.textRTL]}>{provider.description}</Text>
              </View>
            )}
          </View>
        )}

        {/* Logout */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Icon name="logout" size={20} color="#EF4444" />
            <Text style={[styles.logoutButtonText, styles.textRTL]}>התנתק</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
    fontWeight: '400',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '400',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  profileHeader: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerInfo: {
    gap: 8,
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.4,
    lineHeight: 31,
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
    lineHeight: 18,
  },
  phone: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
    lineHeight: 18,
  },
  joinDate: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '400',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#007AFF',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '400',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  serviceItem: {
    paddingVertical: 12,
  },
  serviceItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  serviceInfo: {
    gap: 4,
  },
  serviceType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  serviceRate: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400',
    lineHeight: 16,
  },
  emptyMessage: {
    fontStyle: 'italic',
    color: '#9CA3AF',
    textAlign: 'center',
    marginVertical: 12,
    fontSize: 13,
    fontWeight: '400',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF10',
  },
  editButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  serviceAreasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 0,
    gap: 8,
  },
  areaBadge: {
    backgroundColor: '#3B82F610',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  areaBadgeText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '500',
  },
  availabilityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  availabilityItemRTL: {
    flexDirection: 'row-reverse',
  },
  availabilityItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dayName: {
    fontWeight: '600',
    fontSize: 14,
    color: '#111827',
    letterSpacing: -0.2,
  },
  timeSlot: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '400',
  },
  infoRow: {
    marginBottom: 16,
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '400',
    lineHeight: 18,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#EF444410',
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default ProviderProfileScreen;