import { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet, Modal } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

interface Props {
  value: string | null;       // YYYY-MM-DD or null
  onChange: (date: string) => void;
  placeholder?: string;
  label?: string;
  minimumDate?: Date;
}

export default function DatePickerButton({ value, onChange, placeholder = '날짜 선택', label, minimumDate }: Props) {
  const [show, setShow] = useState(false);

  const dateObj = value ? new Date(value + 'T00:00:00') : new Date();

  const handleChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selected) {
      const y = selected.getFullYear();
      const m = String(selected.getMonth() + 1).padStart(2, '0');
      const d = String(selected.getDate()).padStart(2, '0');
      onChange(`${y}-${m}-${d}`);
    }
  };

  const displayText = value || placeholder;

  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={styles.button} onPress={() => setShow(true)} activeOpacity={0.7}>
        <Ionicons name="calendar-outline" size={18} color={value ? theme.primary : theme.subtext} />
        <Text style={[styles.text, !value && styles.placeholder]}>{displayText}</Text>
      </TouchableOpacity>

      {/* Android: 네이티브 피커 직접 노출 */}
      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display="default"
          onChange={handleChange}
          maximumDate={new Date()}
          {...(minimumDate ? { minimumDate } : {})}
        />
      )}

      {/* iOS: 모달 내 인라인 피커 */}
      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide">
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShow(false)}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>날짜 선택</Text>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={styles.doneBtn}>완료</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateObj}
                mode="date"
                display="inline"
                onChange={handleChange}
                maximumDate={new Date()}
                {...(minimumDate ? { minimumDate } : {})}
                style={{ height: 340 }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  text: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '500',
  },
  placeholder: {
    color: theme.subtext,
    fontWeight: '400',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  doneBtn: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
  },
});
