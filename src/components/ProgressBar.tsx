import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ProgressBarProps {
  percentage: number;
  height?: number;
  showText?: boolean;
  color?: string;
  backgroundColor?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  height = 10,
  showText = false,
  color = '#6366F1', // Indigo primary
  backgroundColor = '#E2E8F0',
}) => {
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

  return (
    <View style={styles.container}>
      <View style={[styles.track, { height, backgroundColor, borderRadius: height / 2 }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${clampedPercentage}%`,
              height,
              backgroundColor: color,
              borderRadius: height / 2,
            },
          ]}
        />
      </View>
      {showText && <Text style={styles.text}>{clampedPercentage}%</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  track: {
    flex: 1,
    overflow: 'hidden',
  },
  fill: {
    transitionProperty: 'width',
  } as any,
  text: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    minWidth: 40,
    textAlign: 'right',
  },
});
