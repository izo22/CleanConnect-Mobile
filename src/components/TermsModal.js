// src/components/TermsModal.js
// ✅ Modal CGU bilingue HE/EN
// S'ouvre depuis le lien "Terms & Conditions" dans ProviderRegistrationScreen
// et ClientRegistrationScreen

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── Contenu CGU ──────────────────────────────────────────────────────────────

const terms = {
  he: {
    title: 'תנאים והגבלות ומדיניות פרטיות',
    lastUpdated: 'עודכן לאחרונה: מאי 2026',
    close: 'סגור',
    sections: [
      {
        title: '1. מהי CleanConnect?',
        body: 'CleanConnect היא פלטפורמת תיווך בלבד המחברת בין לקוחות המחפשים שירותי ניקיון לבין נותני שירות עצמאיים. CleanConnect אינה מעסיקה את נותני השירות ואינה צד בהסכם העבודה ביניהם לבין הלקוח.'
      },
      {
        title: '2. הרשמה ושימוש',
        body: 'ההרשמה לאפליקציה חינמית לחלוטין — הן עבור לקוחות והן עבור נותני שירות. אין דמי מנוי, אין עמלה על ההרשמה, ואין תשלום מוקדם מכל סוג.'
      },
      {
        title: '3. דמי תיווך',
        body: 'בעת ביצוע הזמנה, הלקוח משלם לCleanConnect דמי תיווך בלבד המורכבים מ:\n• 10 ₪ דמי טיפול קבועים\n• 3% עמלה עבור שירותי ניקיון בית רגיל ומשרדים\n• 6% עמלה עבור שירותי Airbnb וניקיון בניינים\n\nדמי התיווך נגבים ברגע ביצוע ההזמנה, באמצעות כרטיס אשראי או Bit.'
      },
      {
        title: '4. תמחור ותשלום הפרסטציה',
        body: 'מחיר הפרסטציה עצמה (שעות העבודה של נותן השירות) נקבע ישירות בין הלקוח לנותן השירות ומשולם ביניהם ישירות, ללא כל מעורבות של CleanConnect. CleanConnect אינה גובה עמלה על מחיר הפרסטציה.'
      },
      {
        title: '5. ביטול והחזר כספי',
        body: 'ביטול הזמנה אפשרי רק כאשר ההזמנה נמצאת בסטטוס "ממתין לאישור" (לפני שנותן השירות אישר).\n\nבמקרה זה, דמי התיווך יוחזרו במלואם תוך 3-5 ימי עסקים לאמצעי התשלום המקורי.\n\nברגע שנותן השירות אישר את ההזמנה ומספר הטלפון שלו נחשף, הלקוח ונותן השירות מתנהלים ביניהם ישירות. כל ביטול לאחר האישור הוא באחריות הצדדים בלבד ואינו מקנה זכות לכל החזר דרך האפליקציה.'
      },
      {
        title: '6. אחריות CleanConnect',
        body: 'CleanConnect מספקת פלטפורמת חיבור בלבד. אנו אינו אחראים לאיכות השירות, לנזק שנגרם במהלך הפרסטציה, לאי-הגעת נותן השירות, או לכל מחלוקת הנוגעת לפרסטציה עצמה.\n\nהלקוח ונותן השירות נושאים באחריות המלאה לכל הסכם ביניהם.'
      },
      {
        title: '7. עצמאות נותני השירות',
        body: 'כל נותני השירות ברשת CleanConnect הם עצמאיים. הם אינם עובדי CleanConnect, אינם שלוחיה ואינם מייצגים אותה בשום צורה. CleanConnect אינה אחראית למעשיהם, לאמינותם, לרישיונות שברשותם או להתנהגותם.'
      },
      {
        title: '8. פרטיות',
        body: 'המידע האישי שאתה מספק (שם, אימייל, טלפון) משמש אך ורק לצורך הפעלת שירות התיווך. אנו אינו מוכרים ואינו משתפים מידע זה עם צדדים שלישיים ללא הסכמתך, למעט במקרים הנדרשים על פי חוק.'
      },
      {
        title: '9. שינויים בתנאים',
        body: 'CleanConnect שומרת לעצמה את הזכות לשנות תנאים אלה בכל עת. שינויים מהותיים יובאו לידיעת המשתמשים דרך האפליקציה. המשך השימוש באפליקציה לאחר פרסום השינויים מהווה הסכמה להם.'
      },
      {
        title: '10. יצירת קשר',
        body: 'לכל שאלה, פנייה או תלונה ניתן לפנות אלינו בהמשך דרך האפליקציה. נשתדל להשיב בהקדם האפשרי.'
      },
    ]
  },
  en: {
    title: 'Terms & Conditions and Privacy Policy',
    lastUpdated: 'Last updated: May 2026',
    close: 'Close',
    sections: [
      {
        title: '1. What is CleanConnect?',
        body: 'CleanConnect is a marketplace platform that connects clients looking for cleaning services with independent service providers. CleanConnect does not employ service providers and is not a party to any agreement between them and the client.'
      },
      {
        title: '2. Registration and Use',
        body: 'Registration on the app is completely free — for both clients and service providers. There are no subscription fees, no registration charges, and no upfront payments of any kind.'
      },
      {
        title: '3. Platform Fee',
        body: 'When placing a booking, the client pays CleanConnect a platform fee only, consisting of:\n• ₪10 fixed handling fee\n• 3% commission for standard home and office cleaning\n• 6% commission for Airbnb and building cleaning services\n\nThis fee is charged at the time of booking, via credit card or Bit.'
      },
      {
        title: '4. Service Pricing and Payment',
        body: 'The price of the service itself (the provider\'s working hours) is agreed directly between the client and the provider and paid between them directly, without any involvement from CleanConnect. CleanConnect does not charge any commission on the service price.'
      },
      {
        title: '5. Cancellation and Refunds',
        body: 'Cancellation is only possible when the booking is in "Pending approval" status (before the provider has confirmed).\n\nIn this case, the platform fee will be refunded in full within 3–5 business days to the original payment method.\n\nOnce the provider has confirmed the booking and their phone number has been revealed, the client and provider communicate directly. Any cancellation after confirmation is the sole responsibility of both parties and does not entitle either party to a refund through the app.'
      },
      {
        title: '6. CleanConnect\'s Liability',
        body: 'CleanConnect provides a connection platform only. We are not responsible for the quality of service, damage caused during the service, provider no-shows, or any dispute relating to the service itself.\n\nThe client and the provider bear full responsibility for any agreement between them.'
      },
      {
        title: '7. Provider Independence',
        body: 'All service providers on CleanConnect are independent. They are not employees of CleanConnect, are not its agents, and do not represent it in any way. CleanConnect is not responsible for their actions, reliability, licenses, or conduct.'
      },
      {
        title: '8. Privacy',
        body: 'The personal information you provide (name, email, phone) is used solely for the purpose of operating the matchmaking service. We do not sell or share this information with third parties without your consent, except where required by law.'
      },
      {
        title: '9. Changes to Terms',
        body: 'CleanConnect reserves the right to modify these terms at any time. Material changes will be communicated to users through the app. Continued use of the app after changes are published constitutes acceptance of the new terms.'
      },
      {
        title: '10. Contact',
        body: 'For any questions, requests or complaints, please contact us through the app. We will do our best to respond as soon as possible.'
      },
    ]
  }
};

// ─── Composant ────────────────────────────────────────────────────────────────

const TermsModal = ({ visible, onClose, initialLang = 'he' }) => {
  const [lang, setLang] = useState(initialLang);
  const isRTL = lang === 'he';
  const t = terms[lang];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={20} color="#1F2937" />
          </TouchableOpacity>

          {/* Toggle langue */}
          <View style={styles.langToggle}>
            <TouchableOpacity
              style={[styles.langBtn, lang === 'he' && styles.langBtnActive]}
              onPress={() => setLang('he')}
            >
              <Text style={[styles.langBtnText, lang === 'he' && styles.langBtnTextActive]}>HE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
              onPress={() => setLang('en')}
            >
              <Text style={[styles.langBtnText, lang === 'en' && styles.langBtnTextActive]}>EN</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Contenu scrollable */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, isRTL && styles.textRTL]}>{t.title}</Text>
          <Text style={[styles.lastUpdated, isRTL && styles.textRTL]}>{t.lastUpdated}</Text>

          {t.sections.map((section, index) => (
            <View key={index} style={styles.section}>
              <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>{section.title}</Text>
              <Text style={[styles.sectionBody, isRTL && styles.textRTL]}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Bouton fermer en bas */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>{t.close}</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Toggle langue
  langToggle: {
    flexDirection: 'row',
    gap: 6,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  langBtnActive: {
    backgroundColor: '#4a90e2',
    borderColor: '#4a90e2',
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: -0.2,
  },
  langBtnTextActive: {
    color: '#FFFFFF',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },

  // Titres
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  lastUpdated: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    letterSpacing: -0.2,
    marginBottom: 32,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.2,
    marginBottom: 8,
    lineHeight: 18,
  },
  sectionBody: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
    letterSpacing: -0.1,
    lineHeight: 20,
  },

  // Footer
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  closeBtn: {
    backgroundColor: '#4a90e2',
    borderRadius: 8,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  // RTL
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default TermsModal;