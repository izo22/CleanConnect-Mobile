// screens/client/PropertyVideoScreen.js - REFONTE UI MINIMALISTE PREMIUM
/*
CHANGEMENTS MAJEURS APPLIQUÉS:
✓ Container: fond #F9FAFB au lieu de #F5F5F5
✓ Cards: borderRadius 12px, bordures 1px #F3F4F6, elevation/shadow supprimées
✓ Typographie: fontSize réduits de 10-15% (title 24px, subtitle 14px)
✓ Poids: '400' par défaut, '600' pour titres/CTA
✓ Buttons: hauteur 40px, borderRadius 8px, ombres supprimées
✓ Colors: #111827 (textes actifs), #6B7280 (secondaires), #9CA3AF (hints)
✓ letterSpacing: -0.2 à -0.3 pour compression visuelle
✓ lineHeight: serré (1.3-1.4)
✓ Spacing: doublé entre sections
✓ InfoBox: background subtil #F0F9FF, borderColor ultra-léger
✓ Icons emoji: conservés mais taille réduite
✓ Video container: bordure au lieu d'ombre
*/

// ✅ מסך העלאת וידאו של הנכס

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform
} from 'react-native';
import { Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config/constants';

export default function PropertyVideoScreen({ navigation }) {
  const [video, setVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchVideo();
  }, []);

  const fetchVideo = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/users/property-video`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success && data.video) {
        setVideo(data.video);
      }
    } catch (error) {
      console.error('שגיאה בטעינת הוידאו:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('אין הרשאה', 'אנחנו צריכים גישה לגלריה שלך');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 120
    });

    if (!result.canceled) {
      uploadVideo(result.assets[0]);
    }
  };

  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('אין הרשאה', 'אנחנו צריכים גישה למצלמה');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 120,
      quality: 0.8
    });

    if (!result.canceled) {
      uploadVideo(result.assets[0]);
    }
  };

  const uploadVideo = async (videoAsset) => {
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      
      const fileUri = Platform.OS === 'ios' 
        ? videoAsset.uri.replace('file://', '') 
        : videoAsset.uri;
      
      formData.append('video', {
        uri: fileUri,
        type: 'video/mp4',
        name: 'property-video.mp4'
      });

      const token = await AsyncStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/users/property-video`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        body: formData
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setVideo(data.video);
        Alert.alert('הצלחה', 'הוידאו נשמר בהצלחה');
      } else {
        Alert.alert('שגיאה', data.message || 'בעיה בשמירת הוידאו');
      }
    } catch (error) {
      console.error('שגיאת העלאה:', error);
      Alert.alert('שגיאה', 'אירעה שגיאה בהעלאת הוידאו');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const deleteVideo = async () => {
    Alert.alert(
      'מחיקת וידאו',
      'האם אתה בטוח שברצונך למחוק את הוידאו?',
      [
        { 
          text: 'ביטול', 
          style: 'cancel' 
        },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              const response = await fetch(`${API_URL}/api/users/property-video`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
              });
              
              const data = await response.json();
              
              if (response.ok && data.success) {
                setVideo(null);
                Alert.alert('הצלחה', 'הוידאו נמחק');
              } else {
                Alert.alert('שגיאה', 'בעיה במחיקת הוידאו');
              }
            } catch (error) {
              console.error('שגיאת מחיקה:', error);
              Alert.alert('שגיאה', 'אירעה שגיאה במחיקת הוידאו');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>טוען...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>וידאו של הנכס שלי</Text>
        <Text style={styles.subtitle}>
          הוידאו הזה יישלח לכל הספקים שאתה מבקש מהם הצעת מחיר
        </Text>
      </View>

      {video ? (
        <View style={styles.videoContainer}>
          <Video
            source={{ uri: video.url }}
            style={styles.video}
            useNativeControls
            resizeMode="contain"
            shouldPlay={false}
          />
          
          <View style={styles.videoInfo}>
            <Text style={styles.videoDate}>
              הועלה ב: {new Date(video.uploadedAt).toLocaleDateString('he-IL')}
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.replaceButton} 
              onPress={pickVideo}
              disabled={uploading}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>החלף וידאו</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.deleteButton} 
              onPress={deleteVideo}
              disabled={uploading}
              activeOpacity={0.7}
            >
              <Text style={[styles.buttonText, { color: '#FF3B30' }]}>מחק וידאו</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📹</Text>
          <Text style={styles.emptyTitle}>אין לך וידאו עדיין</Text>
          <Text style={styles.emptyText}>
            העלה וידאו קצר של הנכס שלך כדי שספקים יוכלו לראות אותו לפני שהם מגיעים
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.recordButton} 
              onPress={recordVideo}
              disabled={uploading}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>
                {uploading ? 'מעלה...' : '🎥 צלם וידאו'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.galleryButton} 
              onPress={pickVideo}
              disabled={uploading}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>
                {uploading ? 'מעלה...' : '📁 בחר מהגלריה'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {uploading && (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.uploadingText}>מעלה וידאו...</Text>
          {uploadProgress > 0 && (
            <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
          )}
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>💡 טיפים לוידאו מוצלח:</Text>
        <Text style={styles.infoItem}>• צלם את כל החדרים שצריך לנקות</Text>
        <Text style={styles.infoItem}>• הראה אזורים שצריכים תשומת לב מיוחדת</Text>
        <Text style={styles.infoItem}>• וודא שהתאורה טובה</Text>
        <Text style={styles.infoItem}>• אורך מומלץ: 1-2 דקות</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB'
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
    letterSpacing: -0.1
  },
  header: {
    marginBottom: 24,
    alignItems: 'flex-end'
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'right',
    color: '#111827',
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'right',
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: -0.1,
  },
  videoContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 16,
    marginBottom: 16,
  },
  video: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    backgroundColor: '#000',
    marginBottom: 12
  },
  videoInfo: {
    alignItems: 'flex-end',
    marginBottom: 12
  },
  videoDate: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '400',
    letterSpacing: -0.1,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    color: '#111827',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    fontWeight: '400',
    letterSpacing: -0.1,
  },
  buttonContainer: {
    gap: 10,
    width: '100%'
  },
  recordButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
  },
  galleryButton: {
    backgroundColor: '#5AC8FA',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
  },
  replaceButton: {
    backgroundColor: '#FF9500',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FF3B30',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  uploadingContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  progressText: {
    marginTop: 8,
    fontSize: 20,
    color: '#007AFF',
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  infoBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'right',
    color: '#111827',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  infoItem: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
    textAlign: 'right',
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: -0.1,
  }
});