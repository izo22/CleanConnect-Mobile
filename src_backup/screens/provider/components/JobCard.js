import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const JobCard = ({ job, onPress }) => {
  const formatDate = (dateString) => {
    const options = { hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleTimeString(undefined, options);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.serviceName}>{job.serviceName}</Text>
        <View style={[
          styles.statusBadge, 
          job.status === 'confirmed' ? styles.statusConfirmed : styles.statusPending
        ]}>
          <Text style={styles.statusText}>
            {job.status === 'confirmed' ? 'Confirmé' : 'En attente'}
          </Text>
        </View>
      </View>
      
      <View style={styles.detailRow}>
        <Ionicons name="person-outline" size={16} color="#666" />
        <Text style={styles.detailText}>{job.clientName}</Text>
      </View>
      
      <View style={styles.detailRow}>
        <Ionicons name="location-outline" size={16} color="#666" />
        <Text style={styles.detailText}>{job.address}</Text>
      </View>
      
      <View style={styles.footer}>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.detailText}>{formatDate(job.date)} • {job.duration}h</Text>
        </View>
        
        <Text style={styles.price}>{job.price} ₪</Text>
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
  detailText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
});

export default JobCard;

