import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Composant simple pour afficher un graphique en barres
const BarChart = ({ data, maxValue, barColor }) => {
  return (
    <View style={styles.chartContainer}>
      {data.map((item, index) => (
        <View key={index} style={styles.barContainer}>
          <Text style={styles.barLabel}>{item.label}</Text>
          <View style={styles.barWrapper}>
            <View
              style={[
                styles.bar,
                { width: `${(item.value / maxValue) * 100}%`, backgroundColor: barColor },
              ]}
            />
            <Text style={styles.barValue}>{item.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

// Périodes disponibles pour les statistiques
const PERIODS = [
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'year', label: 'Année' },
];

const StatsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState('month');
  const [stats, setStats] = useState({
    totalJobs: 0,
    completedJobs: 0,
    cancelledJobs: 0,
    totalEarnings: 0,
    averageRating: 0,
    jobsData: [],
    earningsData: [],
    topServices: [],
    topLocations: [],
  });

  useEffect(() => {
    loadStats(activePeriod);
  }, [activePeriod]);

  // Simuler le chargement des statistiques
  const loadStats = async (period) => {
    setLoading(true);
    
    // Simuler un délai de chargement
    setTimeout(() => {
      // Données simulées qui changent en fonction de la période
      let mockStats;
      
      switch (period) {
        case 'week':
          mockStats = {
            totalJobs: 5,
            completedJobs: 4,
            cancelledJobs: 1,
            totalEarnings: 1800,
            averageRating: 4.7,
            jobsData: [
              { label: 'Lun', value: 1 },
              { label: 'Mar', value: 0 },
              { label: 'Mer', value: 2 },
              { label: 'Jeu', value: 1 },
              { label: 'Ven', value: 1 },
              { label: 'Sam', value: 0 },
              { label: 'Dim', value: 0 },
            ],
            earningsData: [
              { label: 'Lun', value: 400 },
              { label: 'Mar', value: 0 },
              { label: 'Mer', value: 700 },
              { label: 'Jeu', value: 350 },
              { label: 'Ven', value: 350 },
              { label: 'Sam', value: 0 },
              { label: 'Dim', value: 0 },
            ],
            topServices: [
              { name: 'Nettoyage complet', count: 3, percentage: 60 },
              { name: 'Nettoyage de base', count: 1, percentage: 20 },
              { name: 'Nettoyage vitres', count: 1, percentage: 20 },
            ],
            topLocations: [
              { name: 'Tel Aviv', count: 4, percentage: 80 },
              { name: 'Herzliya', count: 1, percentage: 20 },
            ],
          };
          break;
        
        case 'month':
          mockStats = {
            totalJobs: 22,
            completedJobs: 20,
            cancelledJobs: 2,
            totalEarnings: 8500,
            averageRating: 4.8,
            jobsData: [
              { label: 'Sem 1', value: 5 },
              { label: 'Sem 2', value: 6 },
              { label: 'Sem 3', value: 6 },
              { label: 'Sem 4', value: 5 },
            ],
            earningsData: [
              { label: 'Sem 1', value: 1900 },
              { label: 'Sem 2', value: 2300 },
              { label: 'Sem 3', value: 2200 },
              { label: 'Sem 4', value: 2100 },
            ],
            topServices: [
              { name: 'Nettoyage complet', count: 12, percentage: 55 },
              { name: 'Nettoyage de base', count: 5, percentage: 23 },
              { name: 'Nettoyage vitres', count: 3, percentage: 14 },
              { name: 'Nettoyage après travaux', count: 2, percentage: 9 },
            ],
            topLocations: [
              { name: 'Tel Aviv', count: 15, percentage: 68 },
              { name: 'Herzliya', count: 4, percentage: 18 },
              { name: 'Ramat Gan', count: 2, percentage: 9 },
              { name: 'Jaffa', count: 1, percentage: 5 },
            ],
          };
          break;
        
        case 'quarter':
          mockStats = {
            totalJobs: 65,
            completedJobs: 60,
            cancelledJobs: 5,
            totalEarnings: 25000,
            averageRating: 4.8,
            jobsData: [
              { label: 'Jan', value: 20 },
              { label: 'Fév', value: 22 },
              { label: 'Mar', value: 23 },
            ],
            earningsData: [
              { label: 'Jan', value: 7500 },
              { label: 'Fév', value: 8500 },
              { label: 'Mar', value: 9000 },
            ],
            topServices: [
              { name: 'Nettoyage complet', count: 35, percentage: 54 },
              { name: 'Nettoyage de base', count: 15, percentage: 23 },
              { name: 'Nettoyage vitres', count: 10, percentage: 15 },
              { name: 'Nettoyage après travaux', count: 5, percentage: 8 },
            ],
            topLocations: [
              { name: 'Tel Aviv', count: 40, percentage: 62 },
              { name: 'Herzliya', count: 12, percentage: 18 },
              { name: 'Ramat Gan', count: 8, percentage: 12 },
              { name: 'Jaffa', count: 5, percentage: 8 },
            ],
          };
          break;
        
        case 'year':
          mockStats = {
            totalJobs: 250,
            completedJobs: 235,
            cancelledJobs: 15,
            totalEarnings: 95000,
            averageRating: 4.8,
            jobsData: [
              { label: 'T1', value: 65 },
              { label: 'T2', value: 60 },
              { label: 'T3', value: 55 },
              { label: 'T4', value: 70 },
            ],
            earningsData: [
              { label: 'T1', value: 25000 },
              { label: 'T2', value: 22000 },
              { label: 'T3', value: 20000 },
              { label: 'T4', value: 28000 },
            ],
            topServices: [
              { name: 'Nettoyage complet', count: 135, percentage: 54 },
              { name: 'Nettoyage de base', count: 60, percentage: 24 },
              { name: 'Nettoyage vitres', count: 40, percentage: 16 },
              { name: 'Nettoyage après travaux', count: 15, percentage: 6 },
            ],
            topLocations: [
              { name: 'Tel Aviv', count: 160, percentage: 64 },
              { name: 'Herzliya', count: 45, percentage: 18 },
              { name: 'Ramat Gan', count: 30, percentage: 12 },
              { name: 'Jaffa', count: 15, percentage: 6 },
            ],
          };
          break;
        
        default:
          mockStats = {
            totalJobs: 0,
            completedJobs: 0,
            cancelledJobs: 0,
            totalEarnings: 0,
            averageRating: 0,
            jobsData: [],
            earningsData: [],
            topServices: [],
            topLocations: [],
          };
      }
      
      setStats(mockStats);
      setLoading(false);
    }, 1000);
  };

  // Trouver la valeur maximale pour dimensionner les graphiques correctement
  const getMaxValue = (data) => {
    return Math.max(...data.map(item => item.value)) || 1;
  };

  // Calculer le pourcentage de missions terminées
  const completionRate = stats.totalJobs > 0 
    ? ((stats.completedJobs / stats.totalJobs) * 100).toFixed(1) 
    : '0.0';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes statistiques</Text>
      </View>
      
      {/* Filtres de période */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.periodFilters}
      >
        {PERIODS.map((period) => (
          <TouchableOpacity
            key={period.id}
            style={[
              styles.periodButton,
              activePeriod === period.id && styles.activePeriodButton,
            ]}
            onPress={() => setActivePeriod(period.id)}
          >
            <Text
              style={[
                styles.periodButtonText,
                activePeriod === period.id && styles.activePeriodButtonText,
              ]}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <ScrollView style={styles.scrollView}>
          {/* Résumé des statistiques */}
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{stats.totalJobs}</Text>
                <Text style={styles.summaryLabel}>Missions totales</Text>
              </View>
              
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{completionRate}%</Text>
                <Text style={styles.summaryLabel}>Taux de réalisation</Text>
              </View>
              
              <View style={styles.summaryItem}>
                <View style={styles.ratingContainer}>
                  <Text style={styles.summaryValue}>{stats.averageRating.toFixed(1)}</Text>
                  <Ionicons name="star" size={16} color="#FFD700" />
                </View>
                <Text style={styles.summaryLabel}>Note moyenne</Text>
              </View>
            </View>
            
            <View style={styles.earningsContainer}>
              <Text style={styles.earningsLabel}>Revenus totaux</Text>
              <Text style={styles.earningsValue}>{stats.totalEarnings} ₪</Text>
            </View>
          </View>
          
          {/* Graphique des missions */}
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Missions par période</Text>
            <BarChart
              data={stats.jobsData}
              maxValue={getMaxValue(stats.jobsData)}
              barColor="#007AFF"
            />
          </View>
          
          {/* Graphique des revenus */}
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Revenus par période</Text>
            <BarChart
              data={stats.earningsData}
              maxValue={getMaxValue(stats.earningsData)}
              barColor="#4CAF50"
            />
          </View>
          
          {/* Top services */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Services les plus demandés</Text>
            {stats.topServices.map((service, index) => (
              <View key={index} style={styles.statItem}>
                <View style={styles.statInfo}>
                  <Text style={styles.statName}>{service.name}</Text>
                  <Text style={styles.statCount}>{service.count} missions</Text>
                </View>
                <View style={styles.percentageContainer}>
                  <View style={styles.percentageBarContainer}>
                    <View
                      style={[
                        styles.percentageBar,
                        { width: `${service.percentage}%`, backgroundColor: '#FF9800' },
                      ]}
                    />
                  </View>
                  <Text style={styles.percentageText}>{service.percentage}%</Text>
                </View>
              </View>
            ))}
          </View>
          
          {/* Top quartiers */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Quartiers les plus desservis</Text>
            {stats.topLocations.map((location, index) => (
              <View key={index} style={styles.statItem}>
                <View style={styles.statInfo}>
                  <Text style={styles.statName}>{location.name}</Text>
                  <Text style={styles.statCount}>{location.count} missions</Text>
                </View>
                <View style={styles.percentageContainer}>
                  <View style={styles.percentageBarContainer}>
                    <View
                      style={[
                        styles.percentageBar,
                        { width: `${location.percentage}%`, backgroundColor: '#9C27B0' },
                      ]}
                    />
                  </View>
                  <Text style={styles.percentageText}>{location.percentage}%</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  periodFilters: {
    paddingHorizontal: 10,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  periodButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  activePeriodButton: {
    backgroundColor: '#007AFF',
  },
  periodButtonText: {
    fontSize: 14,
    color: '#666666',
  },
  activePeriodButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  summaryContainer: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    margin: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 5,
    textAlign: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earningsContainer: {
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 16,
    color: '#333333',
  },
  earningsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  chartSection: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
  },
  chartContainer: {
    marginTop: 10,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  barLabel: {
    width: 50,
    fontSize: 14,
    color: '#666666',
  },
  barWrapper: {
    flex: 1,
    height: 25,
    backgroundColor: '#F0F0F0',
    borderRadius: 5,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  bar: {
    height: '100%',
  },
  barValue: {
    position: 'absolute',
    right: 10,
    color: '#333333',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statsSection: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  statItem: {
    marginBottom: 15,
  },
  statInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  statName: {
    fontSize: 14,
    color: '#333333',
  },
  statCount: {
    fontSize: 14,
    color: '#666666',
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentageBarContainer: {
    flex: 1,
    height: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 5,
    overflow: 'hidden',
    marginRight: 10,
  },
  percentageBar: {
    height: '100%',
  },
  percentageText: {
    width: 40,
    fontSize: 14,
    color: '#666666',
    textAlign: 'right',
  },
});

export default StatsScreen;