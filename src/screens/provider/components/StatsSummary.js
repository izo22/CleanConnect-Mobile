import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, I18nManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const StatsSummary = ({ stats, onPress }) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.title}>סטטיסטיקות</Text>
        <Ionicons name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"} size={20} color="#256FA8" />
      </View>
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.completedJobs}</Text>
          <Text style={styles.statLabel}>משימות שהושלמו</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.pendingJobs}</Text>
          <Text style={styles.statLabel}>משימות ממתינות</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalEarnings.toLocaleString()} ₪</Text>
          <Text style={styles.statLabel}>הכנסות</Text>
        </View>
        
        <View style={styles.statItem}>
          <View style={styles.ratingContainer}>
            <Text style={styles.statValue}>{stats.rating.toFixed(1)}</Text>
            <Ionicons name="star" size={14} color="#FFD700" style={styles.ratingIcon} />
          </View>
          <Text style={styles.statLabel}>דירוג</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    margin: 15,
    shadowColor: '#1B4F7A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B2A36',
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B2A36',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#5E6E7C',
    textAlign: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingIcon: {
    marginLeft: 2,
  },
});

export default StatsSummary;