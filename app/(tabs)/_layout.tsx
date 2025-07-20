import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import MediaSelection from '@/components/make/MediaSelection';
import ContentModal from '@/components/navigation/ContentModal';
import useTheme from '@/hooks/useTheme';
import GalleryScreen from './gallery';
import SettingsScreen from './settings';

export default function TabLayout() {
  const theme = useTheme();
  const [showMediaSelection, setShowMediaSelection] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName="verify"
        screenOptions={{
          tabBarActiveTintColor: theme.text,
          tabBarInactiveTintColor: theme.inactive,
          tabBarStyle: {
            borderTopWidth: 0,
            height: Platform.OS === 'ios' ? 95 : 75,
            paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 20) : 15,
            paddingHorizontal: 10,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
            shadowOpacity: 0.3,
            shadowRadius: 2,
            borderRadius: Platform.OS === 'ios' ? 24 : 0,
            marginHorizontal: Platform.OS === 'ios' ? 20 : 0,
            marginBottom: Platform.OS === 'ios' ? 25 : 0,
            position: 'absolute',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
            marginTop: 4,
          },
          tabBarItemStyle: {
            paddingTop: 6,
            borderRadius: 0,
          },
          headerShown: false,
          tabBarButton: (props) => (
            <Pressable
              {...props}
              android_disableSound={true}
              android_ripple={{color: 'transparent'}}
              style={({ pressed }) => [
                props.style,
                { opacity: 1 } // No opacity change when pressed
              ]}
            />
          ),
        }}>
        {/* Verify tab - hidden from tab bar but still accessible as default */}
        <Tabs.Screen
          name="verify"
          options={{
            href: null, // Hide from tab bar
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} color={color} />
            ),
          }}
        />
        
        {/* Gallery button - opens modal instead of navigating */}
        <Tabs.Screen
          name="gallery"
          listeners={{
            tabPress: (e) => {
              // Prevent default navigation
              e.preventDefault();
              setShowGalleryModal(true);
            }
          }}
          options={{
            title: 'Gallery',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'images' : 'images-outline'} color={color} />
            ),
          }}
        />
        
        {/* Action button for media selection */}
        <Tabs.Screen
          name="make"
          listeners={{
            tabPress: (e) => {
              // Prevent default navigation
              e.preventDefault();
              setShowMediaSelection(true);
            }
          }}
          options={{
            title: '',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon 
                name={focused ? 'camera' : 'camera-outline'} 
                color={theme.text} 
                style={{
                  backgroundColor: 'rgb(89, 140, 251)',
                  width: 70,
                  height: 70,
                  borderRadius: 35,
                  textAlign: 'center',
                  lineHeight: 70,
                  fontSize: 32,
                  shadowColor: focused ? theme.secondary : theme.primary,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 2,
                  marginTop: -15,
                  borderWidth: 0,
                  overflow: 'hidden',
                }}
              />
            ),
          }}
        />
        
        {/* Settings button - opens modal instead of navigating */}
        <Tabs.Screen
          name="settings"
          listeners={{
            tabPress: (e) => {
              // Prevent default navigation
              e.preventDefault();
              setShowSettingsModal(true);
            }
          }}
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'settings' : 'settings-outline'} color={color} />
            ),
          }}
        />
        
        {/* Hidden explore tab from original template */}
        <Tabs.Screen
          name="explore"
          options={{
            href: null, // Hide from tab bar
          }}
        />
        
        {/* Hide tabMenu tab */}
        <Tabs.Screen
          name="tabMenu"
          options={{
            href: null, // Hide from tab bar
          }}
        />
        
        {/* Hide devices tab */}
        <Tabs.Screen
          name="devices"
          options={{
            href: null, // Hide from tab bar
          }}
        />
      </Tabs>

      {/* Media Selection Modal */}
      <MediaSelection 
        visible={showMediaSelection} 
        onClose={() => setShowMediaSelection(false)} 
      />
      
      {/* Gallery Modal */}
      <ContentModal
        visible={showGalleryModal}
        onClose={() => setShowGalleryModal(false)}
        title="Gallery"
      >
        <GalleryScreen />
      </ContentModal>
      
      {/* Settings Modal */}
      <ContentModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="Settings"
      >
        <SettingsScreen />
      </ContentModal>
    </View>
  );
}
