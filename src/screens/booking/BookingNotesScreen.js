// src/screens/booking/BookingNotesScreen.js — CleanCasa · bleu clair (logique inchangée)
// L'en-tête vient du Stack (« הערות להזמנה ») : l'Appbar bleue en double a été retirée.
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert, Image, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { useBooking } from '../../context/BookingContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Video } from 'expo-av';
import { palette as C } from '../../config/theme';

const SUGGESTIONS = [
  ['קוד גישה', '📍 קוד גישה: 1234'],
  ['חיות מחמד', '🐕 יש חיות מחמד בבית'],
  ['פריטים שבירים', '⚠️ פריטים שבירים'],
  ['מוצרים אקולוגיים', '🌿 להשתמש במוצרים אקולוגיים'],
  ['כניסה מיוחדת', '🚪 כניסה דרך הכניסה האחורית'],
];

const BookingNotesScreen = ({ route, navigation }) => {
  const { currentBooking, updateBooking } = useBooking();
  const { notes: initialNotes } = route.params || {};
  
  const [notes, setNotes] = useState(initialNotes || currentBooking.notes || '');
  const [media, setMedia] = useState(currentBooking.media || []);
  const [isUploading, setIsUploading] = useState(false);
  
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const isRTL = true; // תמיד RTL לעברית
  
  
  
  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'הרשאה נדחתה',
          'אנחנו צריכים הרשאה לגשת לתמונות ולסרטונים שלך'
        );
        return false;
      }
    }
    return true;
  };
  
  const getFileSize = async (uri) => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      return fileInfo.size || 0;
    } catch (error) {
      console.error('שגיאה בקבלת גודל קובץ:', error);
      return 0;
    }
  };
  
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 בתים';
    const k = 1024;
    const sizes = ['בתים', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };
  
  const handlePickMedia = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;
    
    if (media.length >= 3) {
      Alert.alert(
        'הגעת למגבלה',
        'אפשר להעלות עד 3 תמונות או סרטונים'
      );
      return;
    }
    
    try {
      setIsUploading(true);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 60,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        const fileSize = await getFileSize(selectedAsset.uri);
        
        if (fileSize > MAX_FILE_SIZE) {
          Alert.alert(
            'הקובץ גדול מדי',
            `גודל הקובץ (${formatFileSize(fileSize)}) עולה על המגבלה של 50MB`
          );
          setIsUploading(false);
          return;
        }
        
        const newMedia = {
          id: Date.now().toString(),
          uri: selectedAsset.uri,
          type: selectedAsset.type,
          fileName: selectedAsset.uri.split('/').pop(),
          size: fileSize,
          duration: selectedAsset.duration || null,
        };
        
        setMedia([...media, newMedia]);
        
        Alert.alert(
          'הועלה בהצלחה',
          `${selectedAsset.type === 'video' ? 'סרטון' : 'תמונה'} הועלה בהצלחה (${formatFileSize(fileSize)})`
        );
      }
    } catch (error) {
      console.error('שגיאה בבחירת מדיה:', error);
      Alert.alert(
        'שגיאה',
        'כשל בבחירת הקובץ. אנא נסה שוב.'
      );
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleRemoveMedia = (mediaId) => {
    Alert.alert(
      'אישור מחיקה',
      'האם אתה בטוח שברצונך למחוק קובץ זה?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: () => {
            setMedia(media.filter(m => m.id !== mediaId));
          }
        }
      ]
    );
  };
  
  const handleSaveNotes = () => {
    const totalSize = media.reduce((sum, m) => sum + m.size, 0);
    
    if (totalSize > MAX_FILE_SIZE * 3) {
      Alert.alert(
        'סך הקבצים גדול מדי',
        'הגודל הכולל של הקבצים עולה על 150MB'
      );
      return;
    }
    
    updateBooking({ 
      notes,
      media: media.length > 0 ? media : null 
    });
    navigation.goBack();
  };
  
  const addSuggestion = (text) => setNotes(notes ? `${notes}\n${text}` : text);

  const renderMediaItem = (m) => (
    <View key={m.id} style={styles.mediaCard}>
      {m.type === 'image' ? (
        <Image source={{ uri: m.uri }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={styles.thumb}>
          <Video source={{ uri: m.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" shouldPlay={false} isLooping={false} />
          <View style={styles.videoOverlay}><Icon name="play-circle" size={40} color="#FFFFFF" /></View>
        </View>
      )}
      <View style={styles.mediaInfo}>
        <View style={styles.mediaIcon}><Icon name={m.type === 'video' ? 'video-outline' : 'image-outline'} size={18} color={C.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.mediaName} numberOfLines={1}>{m.fileName}</Text>
          <Text style={styles.mediaSize}>{formatFileSize(m.size)}{m.duration ? ` · ${Math.round(m.duration)}s` : ''}</Text>
        </View>
        <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveMedia(m.id)} hitSlop={8}>
          <Icon name="trash-can-outline" size={18} color={C.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>הערות למנקה</Text>
        <Text style={styles.help}>הוסף הערות מיוחדות או הוראות לספק השירות</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={styles.textArea}
          multiline
          placeholder="לדוגמה: קוד גישה, מיקום מפתח, אזורים שצריכים תשומת לב מיוחדת..."
          placeholderTextColor={C.subtle}
          textAlignVertical="top"
        />

        <Text style={styles.label}>הצעות להערות</Text>
        <View style={styles.chips}>
          {SUGGESTIONS.map(([label, text]) => (
            <TouchableOpacity key={label} style={styles.chip} onPress={() => addSuggestion(text)} activeOpacity={0.8}>
              <Icon name="plus" size={14} color={C.primaryDark} />
              <Text style={styles.chipText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.mediaHeader}>
          <Text style={styles.sectionTitle}>תמונות וסרטונים</Text>
          <Text style={styles.count}>{media.length}/3</Text>
        </View>
        <Text style={styles.help}>העלה עד 3 תמונות או סרטונים כדי להראות לספק השירות מה צריך לנקות או אזורים בעייתיים.</Text>

        {media.map(renderMediaItem)}

        {media.length < 3 && (
          <TouchableOpacity style={styles.addMedia} onPress={handlePickMedia} disabled={isUploading} activeOpacity={0.8}>
            {isUploading ? <ActivityIndicator color={C.primary} /> : <Icon name="camera-plus-outline" size={26} color={C.primary} />}
            <Text style={styles.addMediaText}>{isUploading ? 'טוען...' : 'הוסף תמונה או סרטון'}</Text>
            <Text style={styles.addMediaSub}>עד 50MB לקובץ</Text>
          </TouchableOpacity>
        )}

        {media.length > 0 && (
          <View style={styles.infoBox}>
            <Icon name="information-outline" size={16} color={C.primaryDark} />
            <Text style={styles.infoText}>התמונות והסרטונים יעזרו לספק השירות להבין טוב יותר את הצרכים שלך ולהתכונן בהתאם.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveNotes} activeOpacity={0.85}>
          <Text style={styles.saveText}>שמור</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 18, paddingBottom: 24, gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: C.ink, textAlign: 'right' },
  help: { fontSize: 13, color: C.muted, textAlign: 'right', lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '600', color: C.text2, textAlign: 'right', marginTop: 6 },
  textArea: { minHeight: 140, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, fontSize: 15, color: C.ink, textAlign: 'right', writingDirection: 'rtl' },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: C.tint, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  chipText: { fontSize: 13, color: C.primaryDark, fontWeight: '500' },
  mediaHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  count: { fontSize: 13, fontWeight: '600', color: C.muted },
  mediaCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 10, gap: 10 },
  thumb: { width: '100%', height: 180, borderRadius: 14, backgroundColor: C.divider, overflow: 'hidden' },
  videoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14, 40, 62, 0.35)' },
  mediaInfo: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  mediaIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' },
  mediaName: { fontSize: 14, fontWeight: '500', color: C.ink, textAlign: 'right' },
  mediaSize: { fontSize: 12, color: C.muted, textAlign: 'right' },
  removeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FDECEA', alignItems: 'center', justifyContent: 'center' },
  addMedia: { alignItems: 'center', gap: 4, paddingVertical: 22, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.accent, backgroundColor: C.surface },
  addMediaText: { fontSize: 15, fontWeight: '600', color: C.primaryDark },
  addMediaSub: { fontSize: 12, color: C.muted },
  infoBox: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8, backgroundColor: C.tint, borderRadius: 14, padding: 12 },
  infoText: { flex: 1, fontSize: 12, color: C.text2, textAlign: 'right', lineHeight: 18 },
  footer: { padding: 18, paddingTop: 10, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: '#E8EFF5' },
  saveBtn: { backgroundColor: C.primary, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default BookingNotesScreen;
