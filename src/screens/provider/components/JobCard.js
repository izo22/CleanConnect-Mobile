import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, I18nManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const JobCard = ({ job, onPress }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  
  const formatDate = (dateString) => {
    const options = { hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleTimeString(undefined, options);
  };

  const getStatusText = (status) => {
    const statusMap = {
      'confirmed': t('jobCard.status.confirmed'),
      'accepted': t('jobCard.status.accepted'),
      'in-progress': t('jobCard.status.inProgress'),
      'completed': t('jobCard.status.completed'),
      'pending': t('jobCard.status.pending')
    };
    return statusMap[status] || t('jobCard.status.pending');
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={[styles.header, isRTL && styles.headerRTL]}>
        <Text style={[styles.serviceName, isRTL && styles.rtlText]}>
          {job.serviceName}
        </Text>
        <View style={[
          styles.statusBadge, 
          job.status === 'confirmed' ? styles.statusConfirmed : styles.statusPending
        ]}>
          <Text style={[styles.statusText, isRTL && styles.rtlText]}>
            {getStatusText(job.status)}
          </Text>
        </View>
      </View>
      
      <View style={[styles.detailRow, isRTL && styles.detailRowRTL]}>
        <Ionicons name="person-outline" size={16} color="#666" />
        <Text style={[styles.detailText, isRTL && styles.detailTextRTL]}>
          {job.clientName}
        </Text>
      </View>
      
      <View style={[styles.detailRow, isRTL && styles.detailRowRTL]}>
        <Ionicons name="location-outline" size={16} color="#666" />
        <Text style={[styles.detailText, isRTL && styles.detailTextRTL]}>
          {job.address}
        </Text>
      </View>
      
      <View style={[styles.footer, isRTL && styles.footerRTL]}>
        <View style={[styles.detailRow, isRTL && styles.detailRowRTL]}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={[styles.detailText, isRTL && styles.detailTextRTL]}>
            {formatDate(job.date)} • {job.duration}h
          </Text>
        </View>
        
        <Text style={[styles.price, isRTL && styles.rtlText]}>
          {job.price} ₪
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerRTL: {
    flexDirection: 'row-reverse',
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusConfirmed: {
    backgroundColor: '#E6F7EE',
  },
  statusPending: {
    backgroundColor: '#FFF4E5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333333',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailRowRTL: {
    flexDirection: 'row-reverse',
  },
  detailText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
  },
  detailTextRTL: {
    marginLeft: 0,
    marginRight: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  footerRTL: {
    flexDirection: 'row-reverse',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  rtlText: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
});

export default JobCard;