import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../theme';
import { AppText } from '../ui/AppText';
import { Card } from '../ui/Card';
import { StatusBadge, StatusTone } from '../ui/StatusBadge';

interface ATSStatusCardProps {
  status: string;
  detail?: string;
  tone?: StatusTone;
}

/** ATS STATUS card on Contact Record ("Documents Requested · Waiting on candidate"). */
export function ATSStatusCard({ status, detail, tone = 'warning' }: ATSStatusCardProps) {
  return (
    <Card>
      <View style={styles.row}>
        <AppText variant="cardTitle" style={styles.status}>
          {status}
        </AppText>
        {detail ? <StatusBadge label={detail} tone={tone} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  status: {
    flex: 1,
  },
});
