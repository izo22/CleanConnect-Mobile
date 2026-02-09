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
  
  // מצב מקומי לאפשרויות שנבחרו
  const [selectedFrequency, setSelectedFrequency] = useState(CLEANING_FREQUENCY.ONE_TIME);
  const [selectedDuration, setSelectedDuration] = useState(2); // ברירת מחדל 2 שעות
  
  // צבע משויך לסוג השירות
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
  
  // תוכן ספציפי לפי סוג השירות
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
  
  // ניהול המעבר למסך חיפוש ספקים
  const handleContinue = () => {
    // עדכון הקשר ההזמנה
    updateBooking({
      serviceType: serviceType,
      duration: selectedDuration,
      frequency: selectedFrequency
    });
    
    // ניווט למסך חיפוש ספקים
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
                  selectedFrequency === value ? { backgroundColor: serviceColor } : null
                ]}
                textStyle={selectedFrequency === value ? styles.selectedChipText : null}
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
                  selectedDuration === duration ? { backgroundColor: serviceColor } : null
                ]}
                textStyle={selectedDuration === duration ? styles.selectedChipText : null}
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
          labelStyle={{ fontSize: 14, fontWeight: '500' }}
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 30,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.8,
  },
  infoCard: {
    margin: 15,
    borderRadius: 8,
    elevation: 4,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 10,
  },
  divider: {
    height: 1,
    marginVertical: 15,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 10,
  },
  featureText: {
    fontSize: 15,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  chip: {
    margin: 4,
  },
  selectedChipText: {
    color: 'white',
  },
  buttonContainer: {
    padding: 15,
    marginBottom: 30,
  },
  button: {
    paddingVertical: 8,
  }
});

export default ServiceDetails;