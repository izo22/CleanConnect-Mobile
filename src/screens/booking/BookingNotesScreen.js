// src/screens/booking/BookingNotesScreen.js
// ✅ גרסה מתורגמת לעברית עם העלאת וידאו/תמונה
// ✅ תוקן: נוסף תמיכה ב-Airbnb עם צבע #FF5A5F
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, TouchableOpacity, Platform } from 'react-native';
import { Text, TextInput, Button, useTheme, Appbar, IconButton, Card } from 'react-native-paper';
import { useBooking } from '../../context/BookingContext';
import { getServiceColor } from '../../config/constants';  // ✅ Import getServiceColor
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Video } from 'expo-av';

const BookingNotesScreen = ({ route, navigation }) => {
  const theme = useTheme();
  const { currentBooking, updateBooking } = useBooking();
  const { notes: initialNotes } = route.params || {};
  
  const [notes, setNotes] = useState(initialNotes || currentBooking.notes || '');
  const [media, setMedia] = useState(currentBooking.media || []);
  const [isUploading, setIsUploading] = useState(false);
  
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const isRTL = true; // תמיד RTL לעברית
  
  // ✅ ✅ ✅ COULEUR DYNAMIQUE depuis constants.js
  const serviceColor = getServiceColor(currentBooking.serviceType);
  
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
  
  const renderMediaItem = (mediaItem) => {
    return (
      <Card key={mediaItem.id} style={styles.mediaCard}>
        <View style={styles.mediaContainer}>
          {mediaItem.type === 'image' ? (
            <Image 
              source={{ uri: mediaItem.uri }} 
              style={styles.mediaThumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.videoThumbnailContainer}>
              <Video
                source={{ uri: mediaItem.uri }}
                style={styles.mediaThumbnail}
                resizeMode="cover"
                shouldPlay={false}
                isLooping={false}
              />
              <View style={styles.videoOverlay}>
                <Icon name="play-circle" size={40} color="white" />
              </View>
            </View>
          )}
          
          <View style={[styles.mediaInfo, styles.rtlRow]}>
            <Icon 
              name={mediaItem.type === 'video' ? 'video' : 'image'} 
              size={20} 
              color={serviceColor}
              style={styles.iconRTL}
            />
            <View style={styles.mediaDetails}>
              <Text style={[styles.mediaFileName, styles.textRTL]} numberOfLines={1}>
                {mediaItem.fileName}
              </Text>
              <Text style={[styles.mediaSize, styles.textRTL]}>
                {formatFileSize(mediaItem.size)}
                {mediaItem.duration && ` • ${Math.round(mediaItem.duration)}s`}
              </Text>
            </View>
          </View>
          
          <IconButton
            icon="close-circle"
            size={24}
            color="#F44336"
            onPress={() => handleRemoveMedia(mediaItem.id)}
            style={styles.removeButtonRTL}
          />
        </View>
      </Card>
    );
  };
  
  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: serviceColor }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="white" />
        <Appbar.Content 
          title="הערות והוראות" 
          color="white"
          titleStyle={styles.textRTL}
        />
        <Appbar.Action icon="check" onPress={handleSaveNotes} color="white" />
      </Appbar.Header>
      
      <ScrollView style={styles.content}>
        <Text style={[styles.label, styles.textRTL]}>
          הוסף הערות מיוחדות או הוראות לספק השירות
        </Text>
        
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={[styles.textInput, styles.textInputRTL]}
          multiline
          numberOfLines={10}
          mode="outlined"
          theme={{ colors: { primary: serviceColor } }}
          placeholder="לדוגמה: קוד גישה, מיקום מפתח, אזורים שצריכים תשומת לב מיוחדת..."
        />
        
        <View style={styles.examplesContainer}>
          <Text style={[styles.examplesTitle, styles.textRTL]}>
            הצעות להערות:
          </Text>
          <View style={[styles.exampleChips, styles.rtlRow]}>
            <Button 
              mode="outlined" 
              style={styles.exampleChip}
              labelStyle={[styles.exampleChipLabel, styles.textRTL]}
              onPress={() => setNotes(notes ? `${notes}\n📍 קוד גישה: 1234` : '📍 קוד גישה: 1234')}
              color={serviceColor}
            >
              קוד גישה
            </Button>
            
            <Button 
              mode="outlined" 
              style={styles.exampleChip}
              labelStyle={[styles.exampleChipLabel, styles.textRTL]}
              onPress={() => setNotes(notes ? `${notes}\n🐕 יש חיות מחמד בבית` : '🐕 יש חיות מחמד בבית')}
              color={serviceColor}
            >
              חיות מחמד
            </Button>
            
            <Button 
              mode="outlined" 
              style={styles.exampleChip}
              labelStyle={[styles.exampleChipLabel, styles.textRTL]}
              onPress={() => setNotes(notes ? `${notes}\n⚠️ פריטים שבירים` : '⚠️ פריטים שבירים')}
              color={serviceColor}
            >
              פריטים שבירים
            </Button>
            
            <Button 
              mode="outlined" 
              style={styles.exampleChip}
              labelStyle={[styles.exampleChipLabel, styles.textRTL]}
              onPress={() => setNotes(notes ? `${notes}\n🌿 להשתמש במוצרים אקולוגיים` : '🌿 להשתמש במוצרים אקולוגיים')}
              color={serviceColor}
            >
              מוצרים אקולוגיים
            </Button>
            
            <Button 
              mode="outlined" 
              style={styles.exampleChip}
              labelStyle={[styles.exampleChipLabel, styles.textRTL]}
              onPress={() => setNotes(notes ? `${notes}\n🚪 כניסה דרך הכניסה האחורית` : '🚪 כניסה דרך הכניסה האחורית')}
              color={serviceColor}
            >
              כניסה מיוחדת
            </Button>
          </View>
        </View>
        
        <View style={styles.mediaSection}>
          <View style={[styles.mediaSectionHeader, styles.rtlRow]}>
            <Text style={[styles.mediaSectionTitle, styles.textRTL]}>
              תמונות וסרטונים
            </Text>
            <Text style={[styles.mediaCount, styles.textRTL]}>
              {media.length}/3
            </Text>
          </View>
          
          <Text style={[styles.mediaDescription, styles.textRTL]}>
            העלה עד 3 תמונות או סרטונים כדי להראות לספק השירות מה צריך לנקות או אזורים בעייתיים.
          </Text>
          
          {media.map(mediaItem => renderMediaItem(mediaItem))}
          
          {media.length < 3 && (
            <Button
              mode="outlined"
              icon="camera-plus"
              onPress={handlePickMedia}
              style={[styles.addMediaButton, { borderColor: serviceColor }]}
              color={serviceColor}
              loading={isUploading}
              disabled={isUploading}
              labelStyle={styles.textRTL}
            >
              {isUploading ? 'טוען...' : 'הוסף תמונה או סרטון'}
            </Button>
          )}
          
          {media.length > 0 && (
            <View style={[styles.mediaInfoBox, styles.rtlRow]}>
              <Icon 
                name="information" 
                size={16} 
                color="#666"
                style={styles.iconRTL}
              />
              <Text style={[styles.mediaInfoText, styles.textRTL]}>
                התמונות והסרטונים יעזרו לספק השירות להבין טוב יותר את הצרכים שלך ולהתכונן בהתאם.
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            buttonColor={serviceColor} style={styles.button}
            onPress={handleSaveNotes}
            labelStyle={styles.textRTL}
          >
            שמור
          </Button>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 15,
  },
  label: {
    fontSize: 16,
    marginBottom: 15,
    color: '#444',
  },
  textInput: {
    backgroundColor: 'white',
    marginBottom: 20,
  },
  textInputRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  examplesContainer: {
    marginBottom: 20,
  },
  examplesTitle: {
    fontSize: 16,
    marginBottom: 10,
    color: '#666',
  },
  exampleChips: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
  },
  exampleChip: {
    margin: 4,
    borderRadius: 20,
  },
  exampleChipLabel: {
    fontSize: 12,
  },
  mediaSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  mediaSectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mediaSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  mediaCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  mediaDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 15,
    lineHeight: 18,
  },
  mediaCard: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
  },
  mediaContainer: {
    flexDirection: 'column',
    padding: 10,
  },
  mediaThumbnail: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  videoThumbnailContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
  },
  mediaInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 5,
  },
  iconRTL: {
    marginLeft: 8,
    marginRight: 0,
  },
  mediaDetails: {
    flex: 1,
  },
  mediaFileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  mediaSize: {
    fontSize: 12,
    color: '#666',
  },
  removeButtonRTL: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  addMediaButton: {
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  mediaInfoBox: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
  },
  mediaInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    marginRight: 8,
    lineHeight: 18,
  },
  buttonContainer: {
    marginTop: 10,
    marginBottom: 30,
  },
  button: {
    paddingVertical: 8,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default BookingNotesScreen;