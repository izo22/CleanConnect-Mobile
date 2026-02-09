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
  I18nManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

// Composant simple pour afficher un graphique en barres
const BarChart = ({ data, maxValue, barColor, isRTL }) => {
  return (
    <View style={[styles.chartContainer, isRTL && styles.chartContainerRTL]}>
      {data.map((item, index) => (
        <View key={index} style={styles.barContainer}>
          <Text style={[styles.barLabel, isRTL && styles.rtlText]}>{item.label}</Text>
          <View style={[styles.barWrapper, isRTL && styles.barWrapperRTL]}>
            <View
              style={[
                styles.bar,
                { width: `${(item.value / maxValue) * 100}%`, backgroundColor: barColor },
                isRTL && styles.barRTL
              ]}
            />
            <Text style={[styles.barValue, isRTL && styles.rtlText]}>{item.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const StatsScreen = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  
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

  // Périodes disponibles
  const PERIODS = [
    { id: 'week', label: t('stats.periods.week') },
    { id: 'month', label: t('stats.periods.month') },
    { id: 'quarter', label: t('stats.periods.quarter') },
    { id: 'year', label: t('stats.periods.year') },
  ];

  useEffect(() => {
    loadStats(activePeriod);
  }, [activePeriod, i18n.language]);

  // Simuler le chargement des statistiques
  const loadStats = async (period) => {
    setLoading(true);
    
    setTimeout(() => {
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
              { label: t('stats.days.mon'), value: 1 },
              { label: t('stats.days.tue'), value: 0 },
              { label: t('stats.days.wed'), value: 2 },
              { label: t('stats.days.thu'), value: 1 },
              { label: t('stats.days.fri'), value: 1 },
              { label: t('stats.days.sat'), value: 0 },
              { label: t('stats.days.sun'), value: 0 },
            ],
            earningsData: [
              { label: t('stats.days.mon'), value: 400 },
              { label: t('stats.days.tue'), value: 0 },
              { label: t('stats.days.wed'), value: 700 },
              { label: t('stats.days.thu'), value: 350 },
              { label: t('stats.days.fri'), value: 350 },
              { label: t('stats.days.sat'), value: 0 },
              { label: t('stats.days.sun'), value: 0 },
            ],
            topServices: [
              { name: t('stats.services.complete'), count: 3, percentage: 60 },
              { name: t('stats.services.basic'), count: 1, percentage: 20 },
              { name: t('stats.services.windows'), count: 1, percentage: 20 },
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
              { label: t('stats.weeks.week1'), value: 5 },
              { label: t('stats.weeks.week2'), value: 6 },
              { label: t('stats.weeks.week3'), value: 6 },
              { label: t('stats.weeks.week4'), value: 5 },
            ],
            earningsData: [
              { label: t('stats.weeks.week1'), value: 1900 },
              { label: t('stats.weeks.week2'), value: 2300 },
              { label: t('stats.weeks.week3'), value: 2200 },
              { label: t('stats.weeks.week4'), value: 2100 },
            ],
            topServices: [
              { name: t('stats.services.complete'), count: 12, percentage: 55 },
              { name: t('stats.services.basic'), count: 5, percentage: 23 },
              { name: t('stats.services.windows'), count: 3, percentage: 14 },
              { name: t('stats.services.postWork'), count: 2, percentage: 9 },
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
              { label: t('stats.months.jan'), value: 20 },
              { label: t('stats.months.feb'), value: 22 },
              { label: t('stats.months.mar'), value: 23 },
            ],
            earningsData: [
              { label: t('stats.months.jan'), value: 7500 },
              { label: t('stats.months.feb'), value: 8500 },
              { label: t('stats.months.mar'), value: 9000 },
            ],
            topServices: [
              { name: t('stats.services.complete'), count: 35, percentage: 54 },
              { name: t('stats.services.basic'), count: 15, percentage: 23 },
              { name: t('stats.services.windows'), count: 10, percentage: 15 },
              { name: t('stats.services.postWork'), count: 5, percentage: 8 },
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
              { label: t('stats.quarters.q1'), value: 65 },
              { label: t('stats.quarters.q2'), value: 60 },
              { label: t('stats.quarters.q3'), value: 55 },
              { label: t('stats.quarters.q4'), value: 70 },
            ],
            earningsData: [
              { label: t('stats.quarters.q1'), value: 25000 },
              { label: t('stats.quarters.q2'), value: 22000 },
              { label: t('stats.quarters.q3'), value: 20000 },
              { label: t('stats.quarters.q4'), value: 28000 },
            ],
            topServices: [
              { name: t('stats.services.complete'), count: 135, percentage: 54 },
              { name: t('stats.services.basic'), count: 60, percentage: 24 },
              { name: t('stats.services.windows'), count: 40, percentage: 16 },
              { name: t('stats.services.postWork'), count: 15, percentage: 6 },
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

  // Trouver la valeur maximale pour dimensionner les graphiques
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
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
          {t('stats.title')}
        </Text>
      </View>
      
      {/* Filtres de période */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.periodFilters,
          isRTL && styles.periodFiltersRTL
        ]}
      >
        {PERIODS.map((period) => (
          <TouchableOpacity
            key={period.id}
            style={[
              styles.periodButton,
              activePeriod === period.id && styles.activePeriodButton,
              isRTL && styles.periodButtonRTL
            ]}
            onPress={() => setActivePeriod(period.id)}
          >
            <Text
              style={[
                styles.periodButtonText,
                activePeriod === period.id && styles.activePeriodButtonText,
                isRTL && styles.rtlText
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
            <View style={[styles.summaryRow, isRTL && styles.summaryRowRTL]}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, isRTL && styles.rtlText]}>
                  {stats.totalJobs}
                </Text>
                <Text style={[styles.summaryLabel, isRTL && styles.rtlText]}>
                  {t('stats.summary.totalJobs')}
                </Text>
              </View>
              
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, isRTL && styles.rtlText]}>
                  {completionRate}%
                </Text>
                <Text style={[styles.summaryLabel, isRTL && styles.rtlText]}>
                  {t('stats.summary.completionRate')}
                </Text>
              </View>
              
              <View style={styles.summaryItem}>
                <View style={[styles.ratingContainer, isRTL && styles.ratingContainerRTL]}>
                  <Text style={[styles.summaryValue, isRTL && styles.rtlText]}>
                    {stats.averageRating.toFixed(1)}
                  </Text>
                  <Ionicons name="star" size={16} color="#FFD700" />
                </View>
                <Text style={[styles.summaryLabel, isRTL && styles.rtlText]}>
                  {t('stats.summary.averageRating')}
                </Text>
              </View>
            </View>
            
            <View style={styles.earningsContainer}>
              <Text style={[styles.earningsLabel, isRTL && styles.rtlText]}>
                {t('stats.summary.totalEarnings')}
              </Text>
              <Text style={[styles.earningsValue, isRTL && styles.rtlText]}>
                {stats.totalEarnings} ₪
              </Text>
            </View>
          </View>
          
          {/* Graphique des missions */}
          <View style={styles.chartSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {t('stats.charts.jobsByPeriod')}
            </Text>
            <BarChart
              data={stats.jobsData}
              maxValue={getMaxValue(stats.jobsData)}
              barColor="#007AFF"
              isRTL={isRTL}
            />
          </View>
          
          {/* Graphique des revenus */}
          <View style={styles.chartSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {t('stats.charts.earningsByPeriod')}
            </Text>
            <BarChart
              data={stats.earningsData}
              maxValue={getMaxValue(stats.earningsData)}
              barColor="#4CAF50"
              isRTL={isRTL}
            />
          </View>
          
          {/* Top services */}
          <View style={styles.statsSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {t('stats.topServices.title')}
            </Text>
            {stats.topServices.map((service, index) => (
              <View key={index} style={[styles.statItem, isRTL && styles.statItemRTL]}>
                <View style={[styles.statInfo, isRTL && styles.statInfoRTL]}>
                  <Text style={[styles.statName, isRTL && styles.rtlText]}>
                    {service.name}
                  </Text>
                  <Text style={[styles.statCount, isRTL && styles.rtlText]}>
                    {service.count} {t('stats.missions')}
                  </Text>
                </View>
                <View style={[styles.percentageContainer, isRTL && styles.percentageContainerRTL]}>
                  <View style={styles.percentageBarContainer}>
                    <View
                      style={[
                        styles.percentageBar,
                        { width: `${service.percentage}%`, backgroundColor: '#FF9800' },
                        isRTL && styles.percentageBarRTL
                      ]}
                    />
                  </View>
                  <Text style={[styles.percentageText, isRTL && styles.rtlText]}>
                    {service.percentage}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
          
          {/* Top quartiers */}
          <View style={styles.statsSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {t('stats.topLocations.title')}
            </Text>
            {stats.topLocations.map((location, index) => (
              <View key={index} style={[styles.statItem, isRTL && styles.statItemRTL]}>
                <View style={[styles.statInfo, isRTL && styles.statInfoRTL]}>
                  <Text style={[styles.statName, isRTL && styles.rtlText]}>
                    {location.name}
                  </Text>
                  <Text style={[styles.statCount, isRTL && styles.rtlText]}>
                    {location.count} {t('stats.missions')}
                  </Text>
                </View>
                <View style={[styles.percentageContainer, isRTL && styles.percentageContainerRTL]}>
                  <View style={styles.percentageBarContainer}>
                    <View
                      style={[
                        styles.percentageBar,
                        { width: `${location.percentage}%`, backgroundColor: '#9C27B0' },
                        isRTL && styles.percentageBarRTL
                      ]}
                    />
                  </View>
                  <Text style={[styles.percentageText, isRTL && styles.rtlText]}>
                    {location.percentage}%
                  </Text>
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
  periodFiltersRTL: {
    flexDirection: 'row-reverse',
  },
  periodButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  periodButtonRTL: {
    marginHorizontal: 5,
  },
  activePeriodButton: {
    backgroundColor: '#007AFF',
  },
  periodButtonText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  activePeriodButtonText: {
    color: '#FFFFFF',
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
    margin: 15,
    padding: 20,
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
    marginBottom: 20,
  },
  summaryRowRTL: {
    flexDirection: 'row-reverse',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 24,
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
  ratingContainerRTL: {
    flexDirection: 'row-reverse',
  },
  earningsContainer: {
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  earningsLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 5,
  },
  earningsValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  chartSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 15,
  },
  chartContainer: {
    marginTop: 10,
  },
  chartContainerRTL: {
    flexDirection: 'column-reverse',
  },
  barContainer: {
    marginBottom: 15,
  },
  barLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 5,
  },
  barWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barWrapperRTL: {
    flexDirection: 'row-reverse',
  },
  bar: {
    height: 24,
    borderRadius: 4,
    minWidth: 20,
  },
  barRTL: {
    alignSelf: 'flex-end',
  },
  barValue: {
    marginLeft: 8,
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  statsSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
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
  statItemRTL: {
    flexDirection: 'row-reverse',
  },
  statInfo: {
    marginBottom: 5,
  },
  statInfoRTL: {
    alignItems: 'flex-end',
  },
  statName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  statCount: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentageContainerRTL: {
    flexDirection: 'row-reverse',
  },
  percentageBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    marginRight: 10,
    overflow: 'hidden',
  },
  percentageBar: {
    height: '100%',
    borderRadius: 4,
  },
  percentageBarRTL: {
    alignSelf: 'flex-end',
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
    minWidth: 35,
  },
  rtlText: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
});

export default StatsScreen;