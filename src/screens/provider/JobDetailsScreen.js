// JobDetailsScreen.js - REFONTE UI MINIMALISTE PREMIUM
/*
CHANGEMENTS MAJEURS:
- ❌ Suppression complète de i18n / useTranslation / react-i18next
- ✅ Textes hébreux hardcodés dans l'objet HE (en haut du fichier)
- ✅ isRTL = true implicite partout (flexDirection: 'row-reverse', textAlign: 'right')
- ✅ Style ultra-minimaliste premium (Stripe / Linear / Revolut)
- Typographie: tailles réduites, letterSpacing négatif, lineHeight serré
- Fond: #F9FAFB, cards blanches avec bordure #F3F4F6
- Badges: fond opacité 10%, borderRadius 6px, fontSize 11
- Boutons: outline style, borderRadius 8-10px, hauteur ~44-48px
- Ombres: supprimées
- Spacing: structuré par le vide, sections bien séparées
- Composants locaux extraits: InfoRow, QuickAction, DetailRow
*/

import React, { useState, useEffect, useLayoutEffect } from 'react';
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
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { providerService } from '../../services/api';

// ── Textes hébreux hardcodés ─────────────────────────────────────────────────
const HE = {
  loading: 'טוען...',
  retry: 'נסה שוב',
  error: 'שגיאה',
  cancel: 'ביטול',
  unknownClient: 'לקוח לא ידוע',
  service: 'שירות',
  atTime: 'בשעה',
  errors: {
    loadFailed: 'טעינת פרטי המשימה נכשלה',
    notFound: 'המשימה לא נמצאה',
    cannotOpenMaps: 'לא ניתן לפתוח מפות',
    cannotCall: 'לא ניתן לבצע שיחה',
    cannotMessage: 'לא ניתן לשלוח הודעה',
    actionFailed: 'הפעולה נכשלה, נסה שוב',
  },
  status: {
    pending:    'ממתין לאישור',
    accepted:   'מאושר',
    inProgress: 'בביצוע',
    completed:  'הושלם',
    cancelled:  'בוטל',
  },
  actions: {
    accept:       'קבל משימה',
    decline:      'דחה',
    directions:   'ניווט',
    markComplete: 'סמן כהושלם',
    cancelJob:    'ביטול משימה',
  },
  details:    'פרטי המשימה',
  duration:   'משך זמן',
  hours:      'שעות',
  rooms:      'חדרים',
  bathrooms:  'חדרי אמבטיה',
  notes:      'הערות',
  confirmModal: {
    title:          'אישור משימה',
    message:        'האם אתה בטוח שברצונך לקבל את המשימה?',
    confirm:        'קבל',
    successTitle:   'המשימה אושרה',
    successMessage: 'המשימה נוספה לרשימת המשימות שלך',
  },
  declineModal: {
    title:          'דחיית משימה',
    message:        'האם אתה בטוח שברצונך לדחות את המשימה?',
    decline:        'דחה',
    successTitle:   'המשימה נדחתה',
    successMessage: 'המשימה הוסרה מרשימתך',
  },
  completeModal: {
    title:          'סיום משימה',
    message:        'האם סיימת את המשימה?',
    complete:       'סיים',
    successTitle:   'כל הכבוד!',
    successMessage: 'המשימה סומנה כהושלמה',
  },
  cancelModal: {
    title:          'ביטול משימה',
    message:        'האם אתה בטוח שברצונך לבטל את המשימה?',
    cancel:         'בטל משימה',
    successTitle:   'המשימה בוטלה',
    successMessage: 'המשימה בוטלה בהצלחה',
  },
};
// ────────────────────────────────────────────────────────────────────────────

const JobDetailsScreen = ({ navigation, route }) => {
  const { jobId } = route.params;
  const [job, setJob]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // ── Masquer le header natif du navigator (bleu) ───────────────────────────
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => { loadJobDetails(); }, []);

  const loadJobDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await providerService.getJobDetails(jobId);
      if (response?.success) {
        setJob(response.data && typeof response.data === 'object' ? response.data : response);
      } else {
        throw new Error(response.message || HE.errors.loadFailed);
      }
    } catch {
      setError(HE.errors.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${y} ${HE.atTime} ${hh}:${mm}`;
  };

  const openMaps = (address) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.canOpenURL(url)
      .then((ok) => ok ? Linking.openURL(url) : Alert.alert(HE.error, HE.errors.cannotOpenMaps))
      .catch(() => Alert.alert(HE.error, HE.errors.cannotOpenMaps));
  };

  const confirmJob = () => {
    Alert.alert(HE.confirmModal.title, HE.confirmModal.message, [
      { text: HE.cancel, style: 'cancel' },
      {
        text: HE.confirmModal.confirm,
        onPress: async () => {
          try {
            await providerService.acceptJob(jobId);
            loadJobDetails();
            Alert.alert(HE.confirmModal.successTitle, HE.confirmModal.successMessage);
          } catch {
            Alert.alert(HE.error, HE.errors.actionFailed);
          }
        },
      },
    ]);
  };

  const declineJob = () => {
    Alert.alert(HE.declineModal.title, HE.declineModal.message, [
      { text: HE.cancel, style: 'cancel' },
      {
        text: HE.declineModal.decline,
        style: 'destructive',
        onPress: async () => {
          try {
            await providerService.declineJob(jobId, { reason: 'declined_by_provider' });
            navigation.goBack();
            Alert.alert(HE.declineModal.successTitle, HE.declineModal.successMessage);
          } catch {
            Alert.alert(HE.error, HE.errors.actionFailed);
          }
        },
      },
    ]);
  };

  const markAsCompleted = () => {
    Alert.alert(HE.completeModal.title, HE.completeModal.message, [
      { text: HE.cancel, style: 'cancel' },
      {
        text: HE.completeModal.complete,
        onPress: async () => {
          try {
            await providerService.completeJob(jobId);
            loadJobDetails();
            Alert.alert(HE.completeModal.successTitle, HE.completeModal.successMessage);
          } catch {
            Alert.alert(HE.error, HE.errors.actionFailed);
          }
        },
      },
    ]);
  };

  const cancelJob = () => {
    Alert.alert(HE.cancelModal.title, HE.cancelModal.message, [
      { text: HE.cancel, style: 'cancel' },
      {
        text: HE.cancelModal.cancel,
        style: 'destructive',
        onPress: async () => {
          try {
            await providerService.cancelJob(jobId);
            navigation.goBack();
            Alert.alert(HE.cancelModal.successTitle, HE.cancelModal.successMessage);
          } catch {
            Alert.alert(HE.error, HE.errors.actionFailed);
          }
        },
      },
    ]);
  };

  const getStatusConfig = (status) => {
    const configs = {
      pending:     { label: HE.status.pending,    color: '#F59E0B', bg: '#F59E0B1A' },
      accepted:    { label: HE.status.accepted,   color: '#16A34A', bg: '#16A34A1A' },
      in_progress: { label: HE.status.inProgress, color: '#3B82F6', bg: '#3B82F61A' },
      completed:   { label: HE.status.completed,  color: '#16A34A', bg: '#16A34A1A' },
      cancelled:   { label: HE.status.cancelled,  color: '#DC2626', bg: '#DC26261A' },
    };
    return configs[status?.toLowerCase()] || configs.pending;
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={styles.loadingText}>{HE.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !job) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
          <Text style={[styles.errorText, styles.rtl]}>{error || HE.errors.notFound}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadJobDetails}>
            <Text style={styles.retryBtnText}>{HE.retry}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = getStatusConfig(job.status);
  const client       = job.client || job.userId || {};
  const clientName   =
    client.firstName && client.lastName
      ? `${client.firstName} ${client.lastName}`
      : client.name || HE.unknownClient;
  const jobStatus = job.status?.toLowerCase();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Custom Header (remplace le header bleu du navigator) ─────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>פרטי משימה</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header Card : type + statut + prix ────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            {/* Droite : nom du service + badge */}
            <View style={styles.headerRight}>
              <Text style={[styles.serviceName, styles.rtl]}>
                {job.serviceType || HE.service}
              </Text>
              <View style={[styles.badge, { backgroundColor: statusConfig.bg }]}>
                <Text style={[styles.badgeText, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>
            {/* Gauche : prix */}
            <Text style={styles.price}>₪{job.totalPrice || job.price || 0}</Text>
          </View>

          <View style={styles.divider} />

          {/* Infos client intégrées dans la même carte */}
          <View style={{ marginTop: 12, gap: 8 }}>
            <InfoRow icon="person-outline" text={clientName} />
            {job.address && (
              <InfoRow
                icon="location-outline"
                text={job.address}
                isLink
                onPress={() => openMaps(job.address)}
              />
            )}
            {job.date && (
              <InfoRow icon="time-outline" text={formatDateTime(job.date)} />
            )}
          </View>
        </View>

        {/* ── Boutons Accept / Decline (status pending) ─────────────────── */}
        {jobStatus === 'pending' && (
          <View style={styles.card}>
            <View style={styles.pendingRow}>
              <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={confirmJob}>
                <Text style={styles.btnPrimaryText}>{HE.actions.accept}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnDangerOutline, { flex: 1 }]} onPress={declineJob}>
                <Text style={styles.btnDangerOutlineText}>{HE.actions.decline}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Navigation ────────────────────────────────────────────────── */}
        {job.address && (
          <View style={styles.card}>
            <View style={styles.quickRow}>
              <QuickAction
                icon="navigate"
                label={HE.actions.directions}
                color="#3B82F6"
                onPress={() => openMaps(job.address)}
              />
            </View>
          </View>
        )}

        {/* ── Détails de la mission ──────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={[styles.sectionTitle, styles.rtl]}>{HE.details}</Text>

          {/* duration peut s'appeler duration ou hours selon le schéma */}
          <DetailRow
            label={HE.duration}
            value={
              job.duration || job.hours || job.durationHours
                ? `${job.duration || job.hours || job.durationHours} ${HE.hours}`
                : '—'
            }
          />

          {/* date/heure de la mission */}
          {(job.date || job.scheduledDate || job.bookingDate) && (
            <DetailRow
              label="תאריך ושעה"
              value={formatDateTime(job.date || job.scheduledDate || job.bookingDate)}
            />
          )}

          {/* prix total */}
          <DetailRow
            label="מחיר"
            value={`₪${job.totalPrice || job.price || 0}`}
          />

          {job.rooms && <DetailRow label={HE.rooms} value={String(job.rooms)} />}
          {job.bathrooms && <DetailRow label={HE.bathrooms} value={String(job.bathrooms)} />}

          {(job.notes || job.clientNotes || job.description) && (
            <View style={styles.notesBlock}>
              <Text style={[styles.detailLabel, styles.rtl]}>{HE.notes}</Text>
              <Text style={[styles.notesText, styles.rtl]}>
                {job.notes || job.clientNotes || job.description}
              </Text>
            </View>
          )}
        </View>

        {/* ── CTA principaux ────────────────────────────────────────────── */}
        <View style={styles.ctaBlock}>
          {(jobStatus === 'accepted' || jobStatus === 'in_progress') && (
            <TouchableOpacity style={styles.btnComplete} onPress={markAsCompleted}>
              <Text style={styles.btnCompleteText}>{HE.actions.markComplete}</Text>
            </TouchableOpacity>
          )}
          {jobStatus !== 'completed' && jobStatus !== 'cancelled' && (
            <TouchableOpacity style={styles.btnCancelOutline} onPress={cancelJob}>
              <Text style={styles.btnCancelOutlineText}>{HE.actions.cancelJob}</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

// ── Composants locaux ────────────────────────────────────────────────────────

const InfoRow = ({ icon, text, isLink, onPress }) => (
  <TouchableOpacity
    style={styles.infoRow}
    onPress={onPress}
    disabled={!isLink}
    activeOpacity={isLink ? 0.55 : 1}
  >
    <Text style={[styles.infoText, styles.rtl, isLink && styles.linkText]}>{text}</Text>
    <View style={styles.infoIconWrap}>
      <Ionicons name={icon} size={16} color="#9CA3AF" />
    </View>
  </TouchableOpacity>
);

const QuickAction = ({ icon, label, color, onPress }) => (
  <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.quickActionIcon, { backgroundColor: `${color}18` }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={[styles.detailValue, styles.rtl]}>{value}</Text>
    <Text style={[styles.detailLabel, styles.rtl]}>{label}</Text>
  </View>
);

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // Layout
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Custom header (remplace le header bleu du navigator)
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    // Compensation Android StatusBar
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
  },
  headerBack: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // States
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '400',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
    fontWeight: '400',
  },
  retryBtn: {
    marginTop: 4,
    paddingVertical: 9,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  retryBtnText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },

  // Card (surface blanche)
  card: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: -20,
    marginTop: 16,
  },

  // Header
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 8,
  },
  serviceName: {
    fontSize: 19,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  badge: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  price: {
    fontSize: 20,
    fontWeight: '600',
    color: '#16A34A',
    letterSpacing: -0.5,
    marginLeft: 16,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '400',
    lineHeight: 20,
  },
  linkText: {
    color: '#2563EB',
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Pending actions
  pendingRow: {
    flexDirection: 'row-reverse',
    gap: 10,
  },

  // Quick actions
  quickRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  quickAction: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400',
  },

  // Details section
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  detailRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  detailLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '400',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.2,
  },

  // Notes
  notesBlock: { marginTop: 14, gap: 8 },
  notesText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    fontWeight: '400',
  },

  // Buttons
  btnPrimary: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  btnDangerOutline: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.25)',
    alignItems: 'center',
  },
  btnDangerOutlineText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  // CTA bottom
  ctaBlock: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  btnComplete: {
    paddingVertical: 14,
    backgroundColor: '#16A34A',
    borderRadius: 10,
    alignItems: 'center',
  },
  btnCompleteText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  btnCancelOutline: {
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.2)',
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  btnCancelOutlineText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  // RTL global
  rtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default JobDetailsScreen;