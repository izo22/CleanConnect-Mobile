// src/screens/SettingsScreen.js
// ✅ Écran de paramètres avec sélecteur de langue

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Appbar, List } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import { useLanguage } from '../context/LanguageContext';

const SettingsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('parametres') || 'Paramètres'} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* Section Langue */}
        <Card style={styles.card}>
          <Card.Content>
            <LanguageSelector showTitle={true} />
          </Card.Content>
        </Card>

        {/* Section Compte */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>
              {t('compte') || 'Compte'}
            </Text>
            <List.Item
              title={t('informations_personnelles')}
              left={props => <List.Icon {...props} icon="account" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('Profile')}
            />
            <List.Item
              title={t('mes_adresses')}
              left={props => <List.Icon {...props} icon="map-marker" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('Addresses')}
            />
          </Card.Content>
        </Card>

        {/* Section Notifications */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>
              {t('notifications') || 'Notifications'}
            </Text>
            <List.Item
              title={t('notifications_reservations') || 'Notifications de réservation'}
              left={props => <List.Icon {...props} icon="bell" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
            />
          </Card.Content>
        </Card>

        {/* Indicateur RTL pour debug */}
        {__DEV__ && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.debugText}>
                Mode RTL: {isRTL ? 'Activé ✓' : 'Désactivé'}
              </Text>
            </Card.Content>
          </Card>
        )}
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
    flex: 1,
    padding: 15,
  },
  card: {
    marginBottom: 15,
    borderRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
});

export default SettingsScreen;