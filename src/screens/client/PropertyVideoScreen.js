// screens/client/PropertyVideoScreen.js
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
      videoMaxDuration: 120 // 2 דקות מקסימום
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
      
      // Préparer le fichier pour l'upload
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
            >
              <Text style={styles.buttonText}>החלף וידאו</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.deleteButton} 
              onPress={deleteVideo}
              disabled={uploading}
            >
              <Text style={styles.buttonText}>מחק וידאו</Text>
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
            >
              <Text style={styles.buttonText}>
                {uploading ? 'מעלה...' : '🎥 צלם וידאו'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.galleryButton} 
              onPress={pickVideo}
              disabled={uploading}
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
    backgroundColor: '#F5F5F5'
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    fontFamily: 'Heebo'
  },
  header: {
    marginBottom: 30,
    alignItems: 'flex-end'
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'right',
    fontFamily: 'Heebo'
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'right',
    lineHeight: 24,
    fontFamily: 'Heebo'
  },
  videoContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  video: {
    width: '100%',
    height: 300,
    borderRadius: 10,
    backgroundColor: '#000',
    marginBottom: 15
  },
  videoInfo: {
    alignItems: 'flex-end',
    marginBottom: 15
  },
  videoDate: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'Heebo'
  },
  emptyContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 15
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: 'Heebo'
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 25,
    fontFamily: 'Heebo'
  },
  buttonContainer: {
    gap: 12,
    width: '100%'
  },
  recordButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5
  },
  galleryButton: {
    backgroundColor: '#5AC8FA',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#5AC8FA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5
  },
  replaceButton: {
    backgroundColor: '#FF9500',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Heebo'
  },
  uploadingContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  uploadingText: {
    marginTop: 15,
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '600',
    fontFamily: 'Heebo'
  },
  progressText: {
    marginTop: 10,
    fontSize: 24,
    color: '#007AFF',
    fontWeight: 'bold',
    fontFamily: 'Heebo'
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 15,
    padding: 20,
    borderRightWidth: 4,
    borderRightColor: '#2196F3'
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'right',
    color: '#1976D2',
    fontFamily: 'Heebo'
  },
  infoItem: {
    fontSize: 16,
    color: '#1565C0',
    marginBottom: 8,
    textAlign: 'right',
    lineHeight: 24,
    fontFamily: 'Heebo'
  }
});