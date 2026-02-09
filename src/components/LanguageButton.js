// src/components/LanguageButton.js
// ✅ Bouton icône pour changer rapidement la langue

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { IconButton, Portal, Text } from 'react-native-paper';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from './LanguageSelector';

const LanguageButton = () => {
  const [visible, setVisible] = useState(false);
  const { currentLanguage } = useLanguage();

  // Drapeaux pour chaque langue
  const flags = {
    he: '🇮🇱',
    fr: '🇫🇷',
    en: '🇬🇧'
  };

  const showModal = () => setVisible(true);
  const hideModal = () => setVisible(false);

  return (
    <>
      <TouchableOpacity 
        onPress={showModal}
        style={styles.button}
      >
        <Text style={styles.flagIcon}>{flags[currentLanguage] || '🌐'}</Text>
      </TouchableOpacity>

      <Portal>
        <Modal
          visible={visible}
          onRequestClose={hideModal}
          animationType="slide"
          transparent={true}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Choose Language</Text>
                <IconButton
                  icon="close"
                  size={24}
                  onPress={hideModal}
                />
              </View>
              
              <LanguageSelector 
                showTitle={false}
                containerStyle={styles.selectorContainer}
              />
            </View>
          </View>
        </Modal>
      </Portal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 8,
    marginRight: 8,
  },
  flagIcon: {
    fontSize: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '85%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  selectorContainer: {
    borderRadius: 0,
  },
});

export default LanguageButton;