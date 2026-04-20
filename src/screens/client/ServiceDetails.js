import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Title, Paragraph, Divider, Button, Chip, List, useTheme } from 'react-native-paper';
import { SERVICE_TYPE_LABELS, CLEANING_FREQUENCY, CLEANING_FREQUENCY_LABELS } from '../../config/constants';
import { useBooking } from '../../context/BookingContext';
import { useTranslation } from 'react-i18next';

const ServiceDetails = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { serviceType } = route.params;
  const theme = useTheme();
  const { updateBooking } = useBooking();
  
  const [selectedFrequency, setSelectedFrequency] = useState(CLEANING_FREQUENCY.ONE_TIME);
  const [selectedDuration, setSelectedDuration] = useState(2);
  
  const getServiceColor = () => {
    switch (serviceType) {
      case 'home':
        return theme.colors.homeService;
      case 'office':
        return theme.colors.officeService;
      case 'building':
        return theme.colors.buildingService;
      case 'airbnb':
        return theme.colors.airbnbService;
      default:
        return theme.colors.primary;
    }
  };
  
  const getServiceSpecificContent = () => {
    switch (serviceType) {
      case 'home':
        return {
          title: t('home_cleaning') || 'ניקיון בית',
          description: t('home_cleaning_description') || 'שירותי הניקיון הביתי שלנו מתאימים בצורה מושלמת לצרכים שלך. מתחזוקה שוטפת ועד ניקיון יסודי, המקצוענים שלנו דואגים למרחב המגורים שלך.',
          features: [
            t('feature_floor_cleaning') || 'ניקיון רצפות ומשטחים',
            t('feature_dusting') || 'הסרת אבק מלאה',
            t('feature_bathroom_kitchen') || 'ניקיון שירותים ומטבח',
            t('feature_vacuum') || 'שאיבת שטיחים',
            t('feature_eco_products') || 'מוצרים אקולוגיים זמינים'
          ],
          durations: [1, 2, 3, 4],
        };
      case 'office':
        return {
          title: t('office_cleaning') || 'ניקיון משרדים',
          description: t('office_cleaning_description') || 'שמור על סביבת עבודה נקייה ובריאה. שירותי ניקיון המשרדים שלנו מיועדים לחללי עבודה מכל הגדלים.',
          features: [
            t('feature_common_areas') || 'ניקיון אזורים משותפים',
            t('feature_disinfection') || 'חיטוי משטחי עבודה',
            t('feature_bathrooms') || 'תחזוקת שירותים',
            t('feature_trash') || 'ריקון פחי אשפה',
            t('feature_after_hours') || 'שירותים מחוץ לשעות העבודה'
          ],
          durations: [2, 3, 4, 6, 8],
        };
      case 'building':
        return {
          title: t('building_cleaning') || 'ניקיון בניינים',
          description: t('building_cleaning_description') || 'שירותים מלאים לתחזוקת חלקים משותפים של בניינים למגורים ומסחריים. מותאמים לצרכים הספציפיים של הבניין שלך.',
          features: [
            t('feature_entrance_halls') || 'ניקיון כניסות ולובי',
            t('feature_stairs_elevators') || 'תחזוקת מדרגות ומעליות',
            t('feature_windows') || 'ניקיון חלונות נגישים',
            t('feature_technical_rooms') || 'תחזוקת חדרים טכניים',
            t('feature_parking_outdoor') || 'ניקיון חניונים ושטחים חיצוניים'
          ],
          durations: [3, 4, 6, 8],
        };
      case 'airbnb':
        return {
          title: 'ניקיון אירבנב',
          description: 'שירות ניקיון מקצועי ומהיר במיוחד לדירות אירבנב. אנחנו מבינים שהזמן שבין אורחים הוא קריטי, לכן אנחנו מתמחים בניקיון יעיל ומושלם תוך פרק זמן קצר.',
          features: [
            'החלפת מצעים ומגבות',
            'ניקיון יסודי של חדרי אמבטיה ומטבח',
            'ניקיון וחיטוי כל המשטחים',
            'בדיקת פריטי מלאי ואספקה',
            'אריזת פחי אשפה והוצאתם',
            'ניקוי חלונות ומראות',
            'בדיקה סופית ודיווח',
            'זמינות גמישה בין check-out לcheck-in'
          ],
          durations: [1, 2, 3],
        };
      default:
        return {
          title: t('cleaning_service') || 'שירות ניקיון',
          description: t('professional_cleaning_services') || 'שירותי הניקיון המקצועיים שלנו.',
          features: [],
          durations: [2, 3, 4],
        };
    }
  };
  
  const serviceContent = getServiceSpecificContent();
  const serviceColor = getServiceColor();
  
  const handleContinue = () => {
    updateBooking({
      serviceType: serviceType,
      duration: selectedDuration,
      frequency: selectedFrequency
    });
    
    navigation.navigate('ProviderSearch', { 
      serviceType: serviceType,
      duration: selectedDuration,
      frequency: selectedFrequency
    });
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { backgroundColor: serviceColor }]}>
        <Title style={styles.headerTitle}>{serviceContent.title}</Title>
        <Text style={styles.headerSubtitle}>{SERVICE_TYPE_LABELS[serviceType]}</Text>
      </View>
      
      <Card style={styles.infoCard}>
        <Card.Content>
          <Paragraph style={styles.description}>{serviceContent.description}</Paragraph>
          
          <Divider style={styles.divider} />
          
          <Title style={styles.sectionTitle}>{t('services_included') || 'שירותים כלולים'}</Title>
          <List.Section>
            {serviceContent.features.map((feature, index) => (
              <List.Item
                key={index}
                title={feature}
                left={props => <List.Icon {...props} icon="check" color={serviceColor} />}
                titleStyle={styles.featureText}
              />
            ))}
          </List.Section>
          
          <Divider style={styles.divider} />
          
          <Title style={styles.sectionTitle}>{t('frequency') || 'תדירות'}</Title>
          <View style={styles.optionsContainer}>
            {Object.entries(CLEANING_FREQUENCY).map(([key, value]) => (
              <Chip
                key={key}
                selected={selectedFrequency === value}
                onPress={() => setSelectedFrequency(value)}
                style={[
                  styles.chip, 
                  selectedFrequency === value 
                    ? { backgroundColor: serviceColor } 
                    : { backgroundColor: `${serviceColor}10` }
                ]}
                textStyle={[
                  styles.chipText,
                  selectedFrequency === value ? styles.selectedChipText : { color: serviceColor }
                ]}
              >
                {CLEANING_FREQUENCY_LABELS[value]}
              </Chip>
            ))}
          </View>
          
          <Title style={styles.sectionTitle}>{t('duration_hours') || 'משך (שעות)'}</Title>
          <View style={styles.optionsContainer}>
            {serviceContent.durations.map(duration => (
              <Chip
                key={duration}
                selected={selectedDuration === duration}
                onPress={() => setSelectedDuration(duration)}
                style={[
                  styles.chip, 
                  selectedDuration === duration 
                    ? { backgroundColor: serviceColor } 
                    : { backgroundColor: `${serviceColor}10` }
                ]}
                textStyle={[
                  styles.chipText,
                  selectedDuration === duration ? styles.selectedChipText : { color: serviceColor }
                ]}
              >
                {duration}h
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>
      
      <View style={styles.buttonContainer}>
        <Button 
          mode="contained" 
          buttonColor={serviceColor}
          style={styles.button}
          onPress={handleContinue}
          labelStyle={styles.buttonLabel}
        >
          {t('find_provider') || 'מצא ספק'}
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 18 * 1.3,
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 13 * 1.3,
    color: 'white',
    opacity: 0.9,
  },
  infoCard: {
    margin: 16,
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  description: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 14 * 1.5,
    color: '#4B5563',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 16 * 1.3,
    color: '#111827',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 13 * 1.4,
    color: '#374151',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 8,
  },
  chip: {
    margin: 0,
    borderRadius: 6,
    height: 32,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  selectedChipText: {
    color: 'white',
    fontWeight: '600',
  },
  buttonContainer: {
    padding: 16,
    marginBottom: 32,
  },
  button: {
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 14 * 1.3,
  }
});

export default ServiceDetails;