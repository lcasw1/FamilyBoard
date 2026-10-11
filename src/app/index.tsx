import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

// Temporary home screen; replaced by sign-in / display routing in Phase 3.
export default function HomeScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('home.placeholder')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { fontSize: 32 },
});
