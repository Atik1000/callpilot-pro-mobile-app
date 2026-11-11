import { FileText } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ATSDocument, atsDocumentStatusLabel } from '../../types';
import { colors, spacing } from '../../theme';
import { AppText } from '../ui/AppText';
import { StatusBadge, StatusTone } from '../ui/StatusBadge';

interface DocumentListItemProps {
  document: ATSDocument;
  onPress?: () => void;
}

const toneByStatus: Record<ATSDocument['status'], StatusTone> = {
  working: 'success',
  waiting: 'warning',
  received: 'success',
};

export function DocumentListItem({ document, onPress }: DocumentListItemProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${document.name}, ${atsDocumentStatusLabel[document.status]}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && onPress && styles.pressed]}
    >
      <FileText size={18} color={colors.secondary} />
      <View style={styles.name}>
        <AppText variant="bodyMedium" numberOfLines={1}>
          {document.name}
        </AppText>
      </View>
      <StatusBadge
        label={atsDocumentStatusLabel[document.status]}
        tone={toneByStatus[document.status]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  name: {
    flex: 1,
  },
});
