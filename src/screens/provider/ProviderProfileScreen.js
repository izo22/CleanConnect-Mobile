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
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

const ProviderProfileScreen = () => {
  const isRTL = true; // Always RTL for Hebrew
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
              Alert.alert(
                'שגיאה',
                'שגיאה בהתנתקות. אנא נסה שוב.'
              );
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
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.textRTL}>טוען...</Text>
      </View>
    );
  }

  if (error && !provider) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={50} color="#FF6B6B" />
        <Text style={[styles.errorText, styles.textRTL]}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={fetchProviderData}>
          <Text style={styles.buttonText}>נסה שוב</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.textRTL}>אין נתונים להצגה</Text>
        <TouchableOpacity style={[styles.button, { marginTop: 20 }]} onPress={fetchProviderData}>
          <Text style={styles.buttonText}>רענן</Text>
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
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${month} ${year}`;
    } catch (error) {
      return dateString;
    }
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
          <View style={[styles.profileHeader, styles.profileHeaderRTL]}>
            <View style={styles.headerInfo}>
              <Text style={[styles.name, styles.textRTL]}>
                {`${provider.firstName} ${provider.lastName}`}
              </Text>
              <Text style={[styles.memberSince, styles.textRTL]}>
                חבר מאז {getLocalizedDate(provider.createdAt)}
              </Text>
            </View>
          </View>
          
          {provider.bio && (
            <View style={styles.bioSection}>
              <Text style={[styles.bioText, styles.textRTL]}>{provider.bio}</Text>
            </View>
          )}
          
          <View style={[styles.cardActions, styles.cardActionsRTL]}>
            <TouchableOpacity 
              style={styles.button}
              onPress={() => navigation.navigate('EditPersonalInfo', { provider })}
            >
              <Text style={styles.buttonText}>עדכן את הפרופיל שלי</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.textRTL]}>
              הסטטיסטיקות שלי
            </Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{pendingRequests}</Text>
                <Text style={[styles.statLabel, styles.textRTL]}>
                  בקשות ממתינות
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{completedJobs}</Text>
                <Text style={[styles.statLabel, styles.textRTL]}>
                  שירותים שהושלמו
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Services Card - SUPPRIMÉ - Géré maintenant dans EditPersonalInfo */}

        {/* Service Areas Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.textRTL]}>
              אזורי שירות
            </Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.serviceAreasContainer}>
              {provider.serviceAreas && provider.serviceAreas.length > 0 ? (
                provider.serviceAreas.map((area, index) => (
                  <View key={index} style={styles.areaBadge}>
                    <Text style={styles.areaBadgeText}>{area}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyMessage, styles.textRTL]}>
                  לא הוגדרו אזורי שירות
                </Text>
              )}
            </View>
            <TouchableOpacity 
              style={styles.outlinedButton}
              onPress={() => navigation.navigate('EditServiceAreas', { areas: provider.serviceAreas })}
            >
              <Text style={styles.outlinedButtonText}>
                נהל אזורי שירות
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Contact Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.textRTL]}>
              פרטי התקשרות
            </Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.listItem}>
              <Icon name="email" size={24} color="#666" style={styles.listIcon} />
              <View style={styles.listContent}>
                <Text style={[styles.listTitle, styles.textRTL]}>
                  אימייל
                </Text>
                <Text style={[styles.listDescription, styles.textRTL]}>
                  {provider.email}
                </Text>
              </View>
            </View>
            <View style={styles.listItem}>
              <Icon name="phone" size={24} color="#666" style={styles.listIcon} />
              <View style={styles.listContent}>
                <Text style={[styles.listTitle, styles.textRTL]}>
                  טלפון
                </Text>
                <Text style={[styles.listDescription, styles.textRTL]}>
                  {provider.phone || 'לא צוין'}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.outlinedButton}
              onPress={() => navigation.navigate('EditContact', { 
                email: provider.email, 
                phone: provider.phone 
              })}
            >
              <Text style={styles.outlinedButtonText}>
                ערוך פרטי התקשרות
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.textRTL]}>
              חשבון
            </Text>
          </View>
          <View style={styles.cardContent}>
            <TouchableOpacity 
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Icon name="logout" size={20} color="#FF6B6B" style={{ marginRight: 8 }} />
              <Text style={styles.logoutButtonText}>
                התנתק
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginVertical: 10,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cardContent: {
    marginTop: 8,
  },
  cardActions: {
    marginTop: 16,
  },
  cardActionsRTL: {
    flexDirection: 'row-reverse',
  },
  profileHeader: {
    marginBottom: 16,
  },
  profileHeaderRTL: {
    alignItems: 'flex-end',
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  memberSince: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  bioSection: {
    marginTop: 10,
    marginBottom: 16,
  },
  bioText: {
    fontStyle: 'italic',
    color: '#555',
  },
  button: {
    backgroundColor: '#0066CC',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  outlinedButton: {
    borderWidth: 1,
    borderColor: '#0066CC',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  outlinedButtonText: {
    color: '#0066CC',
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0066CC',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyMessage: {
    fontStyle: 'italic',
    color: '#999',
    textAlign: 'center',
    marginVertical: 12,
  },
  serviceAreasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  areaBadge: {
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    margin: 4,
  },
  areaBadgeText: {
    color: '#0277BD',
    fontSize: 14,
  },
  availabilityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  availabilityItemRTL: {
    flexDirection: 'row-reverse',
  },
  dayName: {
    fontWeight: 'bold',
  },
  timeSlot: {
    color: '#666',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  listIcon: {
    marginRight: 16,
  },
  listContent: {
    flex: 1,
  },
  listTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  listDescription: {
    fontSize: 16,
    color: '#333',
  },
  certificationTitle: {
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  certificationItem: {
    marginLeft: 8,
    marginBottom: 4,
    color: '#555',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  logoutButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default ProviderProfileScreen;