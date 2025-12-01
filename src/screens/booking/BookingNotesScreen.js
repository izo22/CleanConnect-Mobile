// src/screens/booking/BookingNotesScreen.js
// ✅ VERSION AVEC UPLOAD VIDÉO/PHOTO
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, TouchableOpacity, Platform } from 'react-native';
import { Text, TextInput, Button, useTheme, Appbar, IconButton, Card } from 'react-native-paper';
import { useBooking } from '../../context/BookingContext';
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
  
  // Taille maximale en bytes (50 MB)
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  
  // Couleur associée au type de service
  const getServiceColor = () => {
    switch (currentBooking.serviceType) {
      case 'home':
        return theme.colors.homeService;
      case 'office':
        return theme.colors.officeService;
      case 'building':
        return theme.colors.buildingService;
      default:
        return theme.colors.primary;
    }
  };
  
  const serviceColor = getServiceColor();
  
  // Demander les permissions
  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'Nous avons besoin de la permission pour accéder à vos photos et vidéos.'
        );
        return false;
      }
    }
    return true;
  };
  
  // Obtenir la taille du fichier
  const getFileSize = async (uri) => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      return fileInfo.size || 0;
    } catch (error) {
      console.error('Erreur lors de la récupération de la taille du fichier:', error);
      return 0;
    }
  };
  
  // Formater la taille pour l'affichage
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };
  
  // Sélectionner une vidéo ou photo
  const handlePickMedia = async () => {
    // Vérifier les permissions
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;
    
    // Vérifier le nombre de médias (max 3)
    if (media.length >= 3) {
      Alert.alert(
        'Limite atteinte',
        'Vous pouvez ajouter maximum 3 fichiers (photos ou vidéos).'
      );
      return;
    }
    
    try {
      setIsUploading(true);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All, // Photos et vidéos
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 60, // 60 secondes max
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        
        // Vérifier la taille du fichier
        const fileSize = await getFileSize(selectedAsset.uri);
        
        if (fileSize > MAX_FILE_SIZE) {
          Alert.alert(
            'Fichier trop volumineux',
            `Le fichier sélectionné (${formatFileSize(fileSize)}) dépasse la limite de 50 MB. Veuillez choisir un fichier plus petit.`
          );
          setIsUploading(false);
          return;
        }
        
        // Ajouter le média à la liste
        const newMedia = {
          id: Date.now().toString(),
          uri: selectedAsset.uri,
          type: selectedAsset.type, // 'image' ou 'video'
          fileName: selectedAsset.uri.split('/').pop(),
          size: fileSize,
          duration: selectedAsset.duration || null,
        };
        
        setMedia([...media, newMedia]);
        
        Alert.alert(
          'Succès',
          `${selectedAsset.type === 'video' ? 'Vidéo' : 'Photo'} ajoutée avec succès (${formatFileSize(fileSize)})`
        );
      }
    } catch (error) {
      console.error('Erreur lors de la sélection du média:', error);
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de la sélection du fichier. Veuillez réessayer.'
      );
    } finally {
      setIsUploading(false);
    }
  };
  
  // Supprimer un média
  const handleRemoveMedia = (mediaId) => {
    Alert.alert(
      'Confirmer la suppression',
      'Voulez-vous vraiment supprimer ce fichier ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            setMedia(media.filter(m => m.id !== mediaId));
          }
        }
      ]
    );
  };
  
  // Handler pour sauvegarder les notes et médias
  const handleSaveNotes = () => {
    // Calculer la taille totale
    const totalSize = media.reduce((sum, m) => sum + m.size, 0);
    
    if (totalSize > MAX_FILE_SIZE * 3) { // 150MB max au total
      Alert.alert(
        'Taille totale trop importante',
        'La taille totale de vos fichiers dépasse 150 MB. Veuillez supprimer certains fichiers.'
      );
      return;
    }
    
    updateBooking({ 
      notes,
      media: media.length > 0 ? media : null 
    });
    navigation.goBack();
  };
  
  // Rendu d'un média (image ou vidéo)
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
          
          <View style={styles.mediaInfo}>
            <Icon 
              name={mediaItem.type === 'video' ? 'video' : 'image'} 
              size={20} 
              color={serviceColor}
              style={styles.mediaIcon}
            />
            <View style={styles.mediaDetails}>
              <Text style={styles.mediaFileName} numberOfLines={1}>
                {mediaItem.fileName}
              </Text>
              <Text style={styles.mediaSize}>
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
            style={styles.removeButton}
          />
        </View>
      </Card>
    );
  };
  
  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: serviceColor }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="white" />
        <Appbar.Content title="Instructions spéciales" color="white" />
        <Appbar.Action icon="check" onPress={handleSaveNotes} color="white" />
      </Appbar.Header>
      
      <ScrollView style={styles.content}>
        <Text style={styles.label}>
          Informations supplémentaires pour votre prestataire
        </Text>
        
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={styles.textInput}
          multiline
          numberOfLines={10}
          mode="outlined"
          theme={{ colors: { primary: serviceColor } }}
          placeholder="Exemples : code d'accès, animaux domestiques, zones spécifiques à nettoyer, etc."
        />
        
        <View style={styles.examplesContainer}>
          <Text style={styles.examplesTitle}>Suggestions :</Text>
          <View style={styles.exampleChips}>
            <Button 
              mode="outlined" 
              style={styles.exampleChip}
              labelStyle={styles.exampleChipLabel}
              onPress={() => setNotes(notes ? `${notes}\nCode d'accès : ` : "Code d'accès : ")}
              color={serviceColor}
            >
              Code d'accès
            </Button>
            
            <Button 
              mode="outlined" 
              style={styles.exampleChip}
              labelStyle={styles.exampleChipLabel}
              onPress={() => setNotes(notes ? `${notes}\nJ'ai des animaux domestiques` : "J'ai des animaux domestiques")}
              color={serviceColor}
            >
              Animaux domestiques
            </Button>
            
            <Button 
              mode="outlined" 
              style={styles.exampleChip}
              labelStyle={styles.exampleChipLabel}
              onPress={() => setNotes(notes ? `${notes}\nAttention aux objets fragiles` : "Attention aux objets fragiles")}
              color={serviceColor}
            >
              Objets fragiles
            </Button>
            
            <Button 
              mode="outlined" 
              style={styles.exampleChip}
              labelStyle={styles.exampleChipLabel}
              onPress={() => setNotes(notes ? `${notes}\nProduits écologiques uniquement` : "Produits écologiques uniquement")}
              color={serviceColor}
            >
              Produits écologiques
            </Button>
            
            <Button 
              mode="outlined" 
              style={styles.exampleChip}
              labelStyle={styles.exampleChipLabel}
              onPress={() => setNotes(notes ? `${notes}\nPorte à l'arrière du bâtiment` : "Porte à l'arrière du bâtiment")}
              color={serviceColor}
            >
              Accès spécifique
            </Button>
          </View>
        </View>
        
        {/* ✅ NOUVELLE SECTION MÉDIAS */}
        <View style={styles.mediaSection}>
          <View style={styles.mediaSectionHeader}>
            <Text style={styles.mediaSectionTitle}>Photos et Vidéos</Text>
            <Text style={styles.mediaCount}>{media.length}/3</Text>
          </View>
          
          <Text style={styles.mediaDescription}>
            Ajoutez des photos ou une vidéo pour aider le prestataire à mieux comprendre vos besoins (max 50 MB par fichier, 60 secondes pour les vidéos)
          </Text>
          
          {/* Liste des médias */}
          {media.map(mediaItem => renderMediaItem(mediaItem))}
          
          {/* Bouton ajouter média */}
          {media.length < 3 && (
            <Button
              mode="outlined"
              icon="camera-plus"
              onPress={handlePickMedia}
              style={[styles.addMediaButton, { borderColor: serviceColor }]}
              color={serviceColor}
              loading={isUploading}
              disabled={isUploading}
            >
              {isUploading ? 'Chargement...' : 'Ajouter une photo ou vidéo'}
            </Button>
          )}
          
          {media.length > 0 && (
            <View style={styles.mediaInfoBox}>
              <Icon name="information" size={16} color="#666" />
              <Text style={styles.mediaInfoText}>
                Les fichiers seront envoyés au prestataire après la confirmation de la réservation
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            style={[styles.button, { backgroundColor: serviceColor }]}
            onPress={handleSaveNotes}
          >
            Enregistrer
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
  examplesContainer: {
    marginBottom: 20,
  },
  examplesTitle: {
    fontSize: 16,
    marginBottom: 10,
    color: '#666',
  },
  exampleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  exampleChip: {
    margin: 4,
    borderRadius: 20,
  },
  exampleChipLabel: {
    fontSize: 12,
  },
  
  // ✅ NOUVEAUX STYLES POUR LES MÉDIAS
  mediaSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  mediaSectionHeader: {
    flexDirection: 'row',
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
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 5,
  },
  mediaIcon: {
    marginRight: 8,
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
  removeButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  addMediaButton: {
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  mediaInfoBox: {
    flexDirection: 'row',
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
    marginLeft: 8,
    lineHeight: 18,
  },
  
  buttonContainer: {
    marginTop: 10,
    marginBottom: 30,
  },
  button: {
    paddingVertical: 8,
  }
});

export default BookingNotesScreen;