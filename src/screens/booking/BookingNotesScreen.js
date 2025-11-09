// src/screens/booking/BookingNotesScreen.js
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput, Button, useTheme, Appbar } from 'react-native-paper';
import { useBooking } from '../../context/BookingContext';

const BookingNotesScreen = ({ route, navigation }) => {
  const theme = useTheme();
  const { currentBooking, updateBooking } = useBooking();
  const { notes: initialNotes } = route.params || {};
  
  const [notes, setNotes] = useState(initialNotes || currentBooking.notes || '');
  
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
  
  // Handler pour sauvegarder les notes
  const handleSaveNotes = () => {
    updateBooking({ notes });
    navigation.goBack();
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
  buttonContainer: {
    marginTop: 10,
    marginBottom: 30,
  },
  button: {
    paddingVertical: 8,
  }
});

export default BookingNotesScreen;