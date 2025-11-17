import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';

const LanguageSettingsScreen = () => {
  const navigation = useNavigation();
  const { userInfo, updateUserInfo } = useContext(AuthContext);
  const [selectedLanguage, setSelectedLanguage] = useState(
    userInfo?.language || 'Hébreu'
  );
  const [isLoading, setIsLoading] = useState(false);

  // Options de langue disponibles
  const languageOptions = [
    {
      id: 'he',
      name: 'Hébreu',
      nativeName: 'עברית',
      icon: 'language-outline',
    },
    {
      id: 'en',
      name: 'Anglais',
      nativeName: 'English',
      icon: 'language-outline',
    },
    {
      id: 'ar',
      name: 'Arabe',
      nativeName: 'العربية',
      icon: 'language-outline',
    },
  ];

  // Gérer la sélection de langue
  const handleSelectLanguage = (language) => {
    setSelectedLanguage(language.name);
    setIsLoading(true);

    // Simuler un délai d'API
    setTimeout(() => {
      updateUserInfo({
        ...userInfo,
        language: language.name,
      });

      setIsLoading(false);
      navigation.goBack();
    }, 1000);
  };

  // Rendre un élément de la liste des langues
  const renderLanguageItem = ({ item }) => (
    <TouchableOpacity
      style={styles.languageOption}
      onPress={() => handleSelectLanguage(item)}
    >
      <View style={styles.languageDetails}>
        <Ionicons name={item.icon} size={24} color="#3498db" />
        <View style={styles.languageNames}>
          <Text style={styles.languageName}>{item.name}</Text>
          <Text style={styles.nativeName}>{item.nativeName}</Text>
        </View>
      </View>
      {selectedLanguage === item.name && (
        <Ionicons name="checkmark" size={24} color="#3498db" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={isLoading}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Langue de l'application</Text>
        <View style={styles.placeholderButton} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Changement de langue...</Text>
        </View>
      ) : (
        <FlatList
          data={languageOptions}
          renderItem={renderLanguageItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholderButton: {
    width: 40,
  },
  listContainer: {
    padding: 16,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  languageDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageNames: {
    marginLeft: 16,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  nativeName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});

export default LanguageSettingsScreen;
