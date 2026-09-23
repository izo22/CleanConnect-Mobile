// ProviderDashboardScreen.js — CleanCasa · bleu clair (maquette 11)
// Logique inchangée : chargement du profil, stats, missions du jour.
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { providerService } from '../../services/api';
import { SERVICE_TYPE_LABELS } from '../../config/constants';
import { palette as C } from '../../config/theme';

const STATUS = {
  pending: { bg: C.warningBg, text: C.warning, label: 'ממתין' },
  pending_payment: { bg: C.warningBg, text: C.warning, label: 'ממתין לתשלום' },
  payment_pending: { bg: C.warningBg, text: C.warning, label: 'ממתין לתשלום' },
  accepted: { bg: '#E1F0FA', text: C.primaryDark, label: 'מאושר' },
  confirmed: { bg: '#E1F0FA', text: C.primaryDark, label: 'מאושר' },
  in_progress: { bg: '#E1F0FA', text: C.primaryDark, label: 'בביצוע' },
  completed: { bg: '#EEF1F4', text: '#4A5763', label: 'הושלם' },
  cancelled: { bg: '#FDECEA', text: C.error, label: 'בוטל' },
};
const getStatus = (s) => STATUS[s?.toLowerCase()] || { bg: C.warningBg, text: C.warning, label: s };

const formatDateTime = (dateString) => {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return `${d.getDate()}/${d.getMonth() + 1} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const ProviderDashboardScreen = ({ navigation }) => {
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchProviderData = async () => {
    try {
      setLoading(true);
      const response = await providerService.getProviderProfile();
      setProvider(response.data);
      setError(null);
    } catch (err) {
      setError('שגיאה בטעינת הנתונים');
      console.error('Error fetching provider data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchProviderData(); }, []);
  useFocusEffect(useCallback(() => { fetchProviderData(); }, []));
  const onRefresh = () => { setRefreshing(true); fetchProviderData(); };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={styles.muted}>טוען...</Text>
      </View>
    );
  }

  if (error && !provider) {
    return (
      <View style={styles.center}>
        <Icon name="error-outline" size={44} color={C.error} />
        <Text style={[styles.muted, { color: C.error }]}>{error}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={fetchProviderData}>
          <Text style={styles.primaryBtnText}>נסה שוב</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const requests = provider?.requests || [];
  const pendingRequests = requests.filter((r) => r.status === 'pending' || r.status === 'pending_payment');
  const completedJobs = requests.filter((r) => r.status === 'completed');
  const todayRequests = requests.filter((r) => new Date(r.date).toDateString() === new Date().toDateString());

  const stats = [
    { icon: 'hourglass-empty', value: pendingRequests.length, label: 'ממתינות' },
    { icon: 'task-alt', value: completedJobs.length, label: 'הושלמו' },
    { icon: 'star-outline', value: provider?.rating ? provider.rating.toFixed(1) : '0.0', label: 'דירוג' },
  ];

  const openJob = (id) => navigation.navigate('Jobs', { screen: 'JobDetails', params: { jobId: id } });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
    >
      <View style={styles.greetingRow}>
        <View>
          <Text style={styles.greetingSmall}>שלום,</Text>
          <Text style={styles.greeting}>{provider?.firstName || ''}</Text>
        </View>
        <TouchableOpacity style={styles.bell} onPress={() => navigation.navigate('Jobs', { screen: 'RequestsScreen' })}>
          <Icon name="notifications-none" size={22} color={C.brand} />
          {pendingRequests.length > 0 && <View style={styles.bellDot} />}
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Icon name={s.icon} size={18} color={C.primary} />
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>משימות להיום</Text>
        <TouchableOpacity style={styles.seeAll} onPress={() => navigation.navigate('Jobs', { screen: 'RequestsScreen' })}>
          <Text style={styles.link}>כל הבקשות</Text>
          <Icon name="chevron-left" size={16} color={C.primary} />
        </TouchableOpacity>
      </View>

      {todayRequests.length > 0 ? (
        todayRequests.map((request) => {
          const st = getStatus(request.status);
          return (
            <TouchableOpacity key={request._id} style={styles.jobCard} onPress={() => openJob(request._id)} activeOpacity={0.85}>
              <View style={styles.jobHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(request.client?.firstName || '').charAt(0)}{(request.client?.lastName || '').charAt(0)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientName}>{request.client?.firstName} {request.client?.lastName}</Text>
                  <Text style={styles.jobSub}>{SERVICE_TYPE_LABELS[request.serviceType] || request.serviceType} · {formatDateTime(request.date)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: st.bg }]}>
                  <Text style={[styles.badgeText, { color: st.text }]}>{st.label}</Text>
                </View>
              </View>
              <View style={styles.jobRow}>
                <Icon name="location-on" size={15} color={C.muted} />
                <Text style={styles.jobAddress} numberOfLines={1}>{request.address}</Text>
              </View>
              <View style={styles.jobFooter}>
                <Text style={styles.price}>₪{request.price || request.totalPrice || 0}</Text>
                <View style={styles.seeAll}>
                  <Text style={styles.link}>פרטי משימה</Text>
                  <Icon name="chevron-left" size={16} color={C.primary} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={styles.empty}>
          <Icon name="event-available" size={36} color={C.accent} />
          <Text style={styles.muted}>אין משימות להיום</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>המידע שלי</Text>
      <View style={styles.infoCard}>
        {[
          ['email', 'אימייל', provider?.email],
          ['phone', 'טלפון', provider?.phone],
          ['cleaning-services', 'שירותים', provider?.serviceDetails?.map((s) => s.type).join(', ')],
          ['place', 'אזורים', provider?.serviceAreas?.join(', ')],
        ].map(([icon, label, value], i, arr) => (
          <View key={label} style={[styles.infoRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={styles.infoIcon}><Icon name={icon} size={17} color={C.primary} /></View>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.outlineBtn} onPress={() => navigation.navigate('Profile', { screen: 'ProviderProfile' })}>
        <Icon name="edit" size={17} color={C.primaryDark} />
        <Text style={styles.outlineBtnText}>ערוך פרופיל</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 18, paddingBottom: 32, gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 20, backgroundColor: C.bg },
  muted: { fontSize: 14, color: C.muted, textAlign: 'center' },
  greetingRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  greetingSmall: { fontSize: 14, color: C.muted, textAlign: 'right' },
  greeting: { fontSize: 24, fontWeight: '700', color: C.ink, textAlign: 'right' },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 10, left: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5484D' },
  statsRow: { flexDirection: 'row-reverse', gap: 8 },
  statCard: { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 12, alignItems: 'flex-end', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: C.brand },
  statLabel: { fontSize: 11, color: C.muted },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: C.ink, textAlign: 'right' },
  seeAll: { flexDirection: 'row-reverse', alignItems: 'center', gap: 2 },
  link: { fontSize: 13, fontWeight: '500', color: C.primary },
  jobCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 14, gap: 10 },
  jobHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.tintStrong, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: C.primaryDark },
  clientName: { fontSize: 15, fontWeight: '600', color: C.ink, textAlign: 'right' },
  jobSub: { fontSize: 12, color: C.muted, textAlign: 'right', marginTop: 2 },
  badge: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  jobRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  jobAddress: { flex: 1, fontSize: 13, color: C.text2, textAlign: 'right' },
  jobFooter: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.divider, paddingTop: 10 },
  price: { fontSize: 16, fontWeight: '700', color: C.brand },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 24, backgroundColor: C.tint, borderRadius: 20 },
  infoCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14 },
  infoRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider },
  infoIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 14, fontWeight: '500', color: C.ink },
  infoValue: { flex: 1, fontSize: 13, color: C.muted, textAlign: 'left' },
  primaryBtn: { backgroundColor: C.primary, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 28 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  outlineBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.primary, borderRadius: 999, paddingVertical: 12, backgroundColor: C.surface },
  outlineBtnText: { fontSize: 15, fontWeight: '600', color: C.primaryDark },
});

export default ProviderDashboardScreen;
