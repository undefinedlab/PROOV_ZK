import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';

interface ThemeColors {
  text: string;
  background: string;
  tint: string;
  primary: string;
  secondary: string;
  card: string;
  inactive: string;
  textSecondary: string;
  error: string;
  success: string;
  border: string;
  accent: string;
}

export default function useTheme(): ThemeColors {
  const colorScheme = useColorScheme() ?? 'light';
  
  return {
    text: Colors[colorScheme].text,
    background: Colors[colorScheme].background,
    tint: Colors[colorScheme].tint,
    primary: colorScheme === 'light' ? '#0a7ea4' : '#3a9fc0', // Primary button/action color
    secondary: colorScheme === 'light' ? '#106c8a' : '#5cb4d1', // Secondary button/action color
    card: colorScheme === 'light' ? '#ffffff' : '#1e2022', // Card background
    inactive: colorScheme === 'light' ? '#98a0a6' : '#68747c', // Inactive elements
    textSecondary: colorScheme === 'light' ? '#5e6973' : '#a0a9b1', // Secondary text color
    error: colorScheme === 'light' ? '#e53935' : '#ff5252', // Error color
    success: colorScheme === 'light' ? '#4caf50' : '#66bb6a', // Success color
    border: colorScheme === 'light' ? '#e0e0e0' : '#2d3035', // Border color
    accent: colorScheme === 'light' ? '#6200ee' : '#bb86fc', // Accent color
  };
} 