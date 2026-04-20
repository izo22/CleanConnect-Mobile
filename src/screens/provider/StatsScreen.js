// StatsScreen.js - REFONTE UI MINIMALISTE PREMIUM
/*
CHANGEMENTS MAJEURS:
- Typographie: tailles réduites (24→20, 16→14, 14→12, 12→11)
- Poids: 'bold' → '600', '500' → '400'
- Container: fond #F9FAFB
- Cards: borderRadius 12px, bordures 1px #F3F4F6, shadowOpacity 0.03
- Period selector: borderRadius 8px, fontSize 12
- Chart bars: borderRadius 8px, hauteur proportionnelle
- Percentage bars: borderRadius 6px
- Colors: #111827 pour textes, #6B7280 pour secondaires
- Spacing: doublé entre sections (15→24)
*/
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
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

  const PERIODS = [
    { id: 'week', label: t('stats.periods.week') },
    { id: 'month', label: t('stats.periods.month') },
    { id: 'quarter', label: t('stats.periods.quarter') },
    { id: 'year', label: t('stats.periods.year') },
  ];

  useEffect(() => {
    loadStats(activePeriod);
  }, [activePeriod, i18n.language]);

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
              { name: t('stats.services.windows'), count: 35, percentage: 14 },
              { name: t('stats.services.postWork'), count: 20, percentage: 8 },
            ],
            topLocations: [
              { name: 'Tel Aviv', count: 155, percentage: 62 },
              { name: 'Herzliya', count: 45, percentage: 18 },
              { name: 'Ramat Gan', count: 30, percentage: 12 },
              { name: 'Jaffa', count: 20, percentage: 8 },
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
    }, 500);
  };

  const formatCurrency = (amount) => {
    return `₪${amount.toLocaleString()}`;
  };

  const maxJobsValue = Math.max(...stats.jobsData.map(item => item.value), 1);
  const maxEarningsValue = Math.max(...stats.earningsData.map(item => item.value), 1);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
          {t('stats.title')}
        </Text>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {PERIODS.map((period) => (
          <TouchableOpacity
            key={period.id}
            style={[
              styles.periodButton,
              activePeriod === period.id && styles.periodButtonActive,
            ]}
            onPress={() => setActivePeriod(period.id)}
          >
            <Text
              style={[
                styles.periodButtonText,
                activePeriod === period.id && styles.periodButtonTextActive,
                isRTL && styles.rtlText,
              ]}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
            {t('stats.loading')}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollContainer}>
          {/* Summary Cards */}
          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, isRTL && styles.rtlText]}>
                {stats.totalJobs}
              </Text>
              <Text style={[styles.summaryLabel, isRTL && styles.rtlText]}>
                {t('stats.totalJobs')}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, isRTL && styles.rtlText]}>
                {stats.completedJobs}
              </Text>
              <Text style={[styles.summaryLabel, isRTL && styles.rtlText]}>
                {t('stats.completed')}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, isRTL && styles.rtlText]}>
                {formatCurrency(stats.totalEarnings)}
              </Text>
              <Text style={[styles.summaryLabel, isRTL && styles.rtlText]}>
                {t('stats.earnings')}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.ratingContainer}>
                <Text style={[styles.summaryValue, isRTL && styles.rtlText]}>
                  {stats.averageRating.toFixed(1)}
                </Text>
                <Ionicons name="star" size={14} color="#FFD700" />
              </View>
              <Text style={[styles.summaryLabel, isRTL && styles.rtlText]}>
                {t('stats.rating')}
              </Text>
            </View>
          </View>

          {/* Jobs Chart */}
          <View style={styles.chartCard}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {t('stats.jobsPerPeriod')}
            </Text>
            <BarChart 
              data={stats.jobsData}
              maxValue={maxJobsValue}
              barColor="#007AFF"
              isRTL={isRTL}
            />
          </View>

          {/* Earnings Chart */}
          <View style={styles.chartCard}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {t('stats.earningsPerPeriod')}
            </Text>
            <BarChart 
              data={stats.earningsData}
              maxValue={maxEarningsValue}
              barColor="#10B981"
              isRTL={isRTL}
            />
          </View>

          {/* Top Services */}
          {stats.topServices.length > 0 && (
            <View style={styles.statsSection}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                {t('stats.topServices')}
              </Text>
              {stats.topServices.map((service, index) => (
                <View key={index} style={styles.statItem}>
                  <View style={[styles.statInfo, isRTL && styles.statInfoRTL]}>
                    <Text style={[styles.statName, isRTL && styles.rtlText]}>
                      {service.name}
                    </Text>
                    <Text style={[styles.statCount, isRTL && styles.rtlText]}>
                      {service.count} {t('stats.jobs')}
                    </Text>
                  </View>
                  <View style={[styles.percentageContainer, isRTL && styles.percentageContainerRTL]}>
                    <View style={styles.percentageBarContainer}>
                      <View 
                        style={[
                          styles.percentageBar, 
                          { width: `${service.percentage}%`, backgroundColor: '#F59E0B' },
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
          )}

          {/* Top Locations */}
          {stats.topLocations.length > 0 && (
            <View style={styles.statsSection}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                {t('stats.topLocations')}
              </Text>
              {stats.topLocations.map((location, index) => (
                <View key={index} style={styles.statItem}>
                  <View style={[styles.statInfo, isRTL && styles.statInfoRTL]}>
                    <Text style={[styles.statName, isRTL && styles.rtlText]}>
                      {location.name}
                    </Text>
                    <Text style={[styles.statCount, isRTL && styles.rtlText]}>
                      {location.count} {t('stats.jobs')}
                    </Text>
                  </View>
                  <View style={[styles.percentageContainer, isRTL && styles.percentageContainerRTL]}>
                    <View style={styles.percentageBarContainer}>
                      <View 
                        style={[
                          styles.percentageBar, 
                          { width: `${location.percentage}%`, backgroundColor: '#8B5CF6' },
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
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#007AFF',
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
  },
  scrollContainer: {
    flex: 1,
  },
  summaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '400',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  chartContainer: {
    marginTop: 8,
  },
  chartContainerRTL: {
    flexDirection: 'column-reverse',
  },
  barContainer: {
    marginBottom: 16,
  },
  barLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 6,
    fontWeight: '400',
  },
  barWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barWrapperRTL: {
    flexDirection: 'row-reverse',
  },
  bar: {
    height: 20,
    borderRadius: 8,
    minWidth: 20,
  },
  barRTL: {
    alignSelf: 'flex-end',
  },
  barValue: {
    marginLeft: 10,
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  statsSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  statItem: {
    marginBottom: 16,
  },
  statItemRTL: {
    flexDirection: 'row-reverse',
  },
  statInfo: {
    marginBottom: 8,
  },
  statInfoRTL: {
    alignItems: 'flex-end',
  },
  statName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.2,
    lineHeight: 16,
  },
  statCount: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '400',
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
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    marginRight: 10,
    overflow: 'hidden',
  },
  percentageBar: {
    height: '100%',
    borderRadius: 6,
  },
  percentageBarRTL: {
    alignSelf: 'flex-end',
  },
  percentageText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    minWidth: 35,
  },
  rtlText: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
});

export default StatsScreen;