// JobDetailsScreen.js - Corrigé avec les bons champs API

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { providerService } from '../../services/api';
import { useTranslation } from 'react-i18next';

const JobDetailsScreen = ({ navigation, route }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const { jobId } = route.params;
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadJobDetails();
  }, []);

  const loadJobDetails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await providerService.getJobDetails(jobId);
      
      if (response && response.success) {
        let jobData;
        
        if (response.data && typeof response.data === 'object') {
          jobData = response.data;
        } else {
          jobData = response;
        }
        
        console.log('📦 Job complet:', JSON.stringify(jobData, null, 2));
        setJob(jobData);
      } else {
        throw new Error(response.message || t('jobDetails.errors.loadFailed'));
      }
    } catch (err) {
      setError(t('jobDetails.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    console.log('📅 Date reçue:', dateString);
    
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      console.log('❌ Date invalide');
      return dateString;
    }
    
    if (isRTL) {
      // Format hébreu manuel
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${day}/${month}/${year} בשעה ${hours}:${minutes}`;
    }
    
    // Pour français/anglais
    const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
    const dateStr = date.toLocaleDateString(locale);
    const timeStr = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    
    return `${dateStr} ${t('jobDetails.atTime')} ${timeStr}`;
  };

  const openMaps = (address) => {
    const encodedAddress = encodeURIComponent(address);
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    
    Linking.canOpenURL(googleMapsUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(googleMapsUrl);
        } else {
          Alert.alert(t('common.error'), t('jobDetails.errors.cannotOpenMaps'));
        }
      })
      .catch(() => {
        Alert.alert(t('common.error'), t('jobDetails.errors.cannotOpenMaps'));
      });
  };

  const callClient = (phoneNumber) => {
    const url = `tel:${phoneNumber}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          Alert.alert(t('common.error'), t('jobDetails.errors.cannotCall'));
        }
      })
      .catch(() => {
        Alert.alert(t('common.error'), t('jobDetails.errors.cannotCall'));
      });
  };

  const messageClient = (phoneNumber) => {
    const url = `sms:${phoneNumber}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          Alert.alert(t('common.error'), t('jobDetails.errors.cannotMessage'));
        }
      })
      .catch(() => {
        Alert.alert(t('common.error'), t('jobDetails.errors.cannotMessage'));
      });
  };

  const confirmJob = () => {
    Alert.alert(
      t('jobDetails.confirmModal.title'),
      t('jobDetails.confirmModal.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('jobDetails.confirmModal.confirm'),
          onPress: async () => {
            try {
              await providerService.acceptJob(jobId);
              loadJobDetails();
              Alert.alert(
                t('jobDetails.confirmModal.successTitle'),
                t('jobDetails.confirmModal.successMessage')
              );
            } catch (err) {
              Alert.alert(
                t('common.error'),
                t('jobDetails.confirmModal.errorMessage')
              );
            }
          },
        },
      ]
    );
  };

  const cancelJob = () => {
    Alert.alert(
      t('jobDetails.cancelModal.title'),
      t('jobDetails.cancelModal.message'),
      [
        { text: t('jobDetails.cancelModal.no'), style: 'cancel' },
        {
          text: t('jobDetails.cancelModal.yes'),
          style: 'destructive',
          onPress: async () => {
            try {
              await providerService.declineJob(jobId);
              loadJobDetails();
              Alert.alert(
                t('jobDetails.cancelModal.successTitle'),
                t('jobDetails.cancelModal.successMessage')
              );
            } catch (err) {
              Alert.alert(
                t('common.error'),
                t('jobDetails.cancelModal.errorMessage')
              );
            }
          },
        },
      ]
    );
  };

  const completeJob = () => {
    Alert.alert(
      t('jobDetails.completeModal.title'),
      t('jobDetails.completeModal.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('jobDetails.completeModal.confirm'),
          onPress: async () => {
            try {
              await providerService.completeJob(jobId);
              loadJobDetails();
              Alert.alert(
                t('jobDetails.completeModal.successTitle'),
                t('jobDetails.completeModal.successMessage')
              );
            } catch (err) {
              Alert.alert(
                t('common.error'),
                t('jobDetails.completeModal.errorMessage')
              );
            }
          },
        },
      ]
    );
  };

  const getStatusLabel = (status) => {
    // Map API status to UI status
    const statusMap = {
      'pending': 'pending',
      'accepted': 'confirmed',
      'completed': 'completed',
      'cancelled': 'cancelled',
    };
    
    const mappedStatus = statusMap[status] || status;
    return t(`providerRequests.status.${mappedStatus}`, mappedStatus);
  };

  const getDisplayStatus = (status) => {
    // Pour l'affichage du badge
    return status === 'accepted' ? 'confirmed' : status;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={60} color="#F44336" />
        <Text style={[styles.errorText, isRTL && styles.textRTL]}>
          {error || t('jobDetails.errors.cannotLoad')}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadJobDetails}
        >
          <Text style={styles.retryButtonText}>{t('try_again')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const displayStatus = getDisplayStatus(job.status);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <View style={[styles.headerContent, isRTL && styles.headerContentRTL]}>
            <Text style={[styles.clientName, isRTL && styles.textRTL]}>
              {job.client.firstName} {job.client.lastName}
            </Text>
            <View 
              style={[
                styles.statusBadge, 
                displayStatus === 'confirmed' ? styles.confirmedStatus : 
                displayStatus === 'pending' ? styles.pendingStatus : 
                displayStatus === 'completed' ? styles.completedStatus : 
                styles.cancelledStatus
              ]}
            >
              <Text style={styles.statusText}>
                {getStatusLabel(job.status)}
              </Text>
            </View>
          </View>
        </View>

        {job.status === 'pending' && (
          <View style={styles.pendingContainer}>
            <Text style={[styles.pendingTitle, isRTL && styles.textRTL]}>
              {t('jobDetails.pending.title')}
            </Text>
            <Text style={[styles.pendingSubtitle, isRTL && styles.textRTL]}>
              {t('jobDetails.pending.subtitle')}
            </Text>
            
            <View style={[styles.pendingActions, isRTL && styles.pendingActionsRTL]}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={confirmJob}
              >
                <Text style={styles.confirmButtonText}>
                  {t('jobDetails.actions.accept')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.declineButton}
                onPress={cancelJob}
              >
                <Text style={styles.declineButtonText}>
                  {t('jobDetails.actions.decline')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={[styles.sectionRow, isRTL && styles.sectionRowRTL]}>
            <Ionicons name="calendar" size={20} color="#666666" />
            <Text style={[styles.sectionText, isRTL && styles.textRTL]}>
              {formatDateTime(job.scheduledDate)}
            </Text>
          </View>
          
          <View style={[styles.sectionRow, isRTL && styles.sectionRowRTL]}>
            <Ionicons name="time" size={20} color="#666666" />
            <Text style={[styles.sectionText, isRTL && styles.textRTL]}>
              {job.duration} {t('jobDetails.hours')}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.sectionRow, isRTL && styles.sectionRowRTL]}
            onPress={() => openMaps(job.address)}
          >
            <Ionicons name="location" size={20} color="#666666" />
            <Text style={[styles.sectionText, styles.addressText, isRTL && styles.textRTL]}>
              {job.address}
            </Text>
            <Ionicons name="navigate" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {job.status === 'accepted' && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => callClient(job.client.phone)}
            >
              <View style={[styles.actionIcon, styles.callIcon]}>
                <Ionicons name="call" size={24} color="#FFFFFF" />
              </View>
              <Text style={[styles.actionText, isRTL && styles.textRTL]}>
                {t('jobDetails.actions.call')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => messageClient(job.client.phone)}
            >
              <View style={[styles.actionIcon, styles.messageIcon]}>
                <Ionicons name="chatbubble" size={24} color="#FFFFFF" />
              </View>
              <Text style={[styles.actionText, isRTL && styles.textRTL]}>
                {t('jobDetails.actions.message')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => openMaps(job.address)}
            >
              <View style={[styles.actionIcon, styles.directionIcon]}>
                <Ionicons name="navigate" size={24} color="#FFFFFF" />
              </View>
              <Text style={[styles.actionText, isRTL && styles.textRTL]}>
                {t('jobDetails.actions.directions')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.detailSection}>
          <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
            {t('jobDetails.serviceDetails.title')}
          </Text>
          
          <View style={[styles.detailRow, isRTL && styles.detailRowRTL]}>
            <Text style={[styles.detailLabel, isRTL && styles.textRTL]}>
              {t('jobDetails.serviceDetails.service')}
            </Text>
            <Text style={[styles.detailValue, isRTL && styles.textRTL]}>
              {job.serviceType}
            </Text>
          </View>
          
          <View style={[styles.detailRow, isRTL && styles.detailRowRTL]}>
            <Text style={[styles.detailLabel, isRTL && styles.textRTL]}>
              סוג נכס
            </Text>
            <Text style={[styles.detailValue, isRTL && styles.textRTL]}>
              {job.propertyType}
            </Text>
          </View>
          
          <View style={[styles.detailRow, isRTL && styles.detailRowRTL]}>
            <Text style={[styles.detailLabel, isRTL && styles.textRTL]}>
              {t('jobDetails.serviceDetails.price')}
            </Text>
            <Text style={[styles.detailValue, isRTL && styles.textRTL]}>
              ₪{job.price}
            </Text>
          </View>
          
          {job.description && (
            <View style={styles.notesContainer}>
              <Text style={[styles.notesLabel, isRTL && styles.textRTL]}>
                {t('jobDetails.serviceDetails.notes')}
              </Text>
              <Text style={[styles.notesText, isRTL && styles.textRTL]}>
                {job.description}
              </Text>
            </View>
          )}
        </View>

        {job.status === 'accepted' && (
          <>
            <TouchableOpacity
              style={styles.completeButton}
              onPress={completeJob}
            >
              <Text style={styles.completeButtonText}>
                {t('jobDetails.actions.markComplete')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={cancelJob}
            >
              <Text style={styles.cancelButtonText}>
                {t('jobDetails.actions.cancelJob')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginHorizontal: 30,
    marginTop: 15,
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#007AFF',
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContentRTL: {
    flexDirection: 'row-reverse',
  },
  clientName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  confirmedStatus: {
    backgroundColor: '#E8F5E9',
  },
  pendingStatus: {
    backgroundColor: '#FFF8E1',
  },
  completedStatus: {
    backgroundColor: '#E8F5E9',
  },
  cancelledStatus: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
  },
  pendingContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 10,
    alignItems: 'center',
  },
  pendingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 5,
  },
  pendingSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
    textAlign: 'center',
  },
  pendingActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 30,
  },
  pendingActionsRTL: {
    flexDirection: 'row-reverse',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  declineButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  declineButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginBottom: 10,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  sectionRowRTL: {
    flexDirection: 'row-reverse',
  },
  sectionText: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 10,
    flex: 1,
  },
  addressText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    marginBottom: 10,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  callIcon: {
    backgroundColor: '#4CAF50',
  },
  messageIcon: {
    backgroundColor: '#FF9800',
  },
  directionIcon: {
    backgroundColor: '#2196F3',
  },
  actionText: {
    fontSize: 14,
    color: '#666666',
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  detailRowRTL: {
    flexDirection: 'row-reverse',
  },
  detailLabel: {
    fontSize: 16,
    color: '#666666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  notesContainer: {
    marginTop: 15,
  },
  notesLabel: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 5,
  },
  notesText: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 22,
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 5,
  },
  completeButton: {
    margin: 15,
    marginBottom: 5,
    padding: 15,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    margin: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#F44336',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 25,
  },
  cancelButtonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '500',
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default JobDetailsScreen;