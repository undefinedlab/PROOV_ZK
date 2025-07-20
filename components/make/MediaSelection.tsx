import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface MediaSelectionProps {
  visible: boolean;
  onClose: () => void;
}

const MediaSelection: React.FC<MediaSelectionProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const [animation] = useState(new Animated.Value(0));
  
  useEffect(() => {
    if (visible) {
      Animated.spring(animation, {
        toValue: 1,
        tension: 70,
        friction: 10,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(animation, {
        toValue: 0,
        tension: 70,
        friction: 10,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, animation]);
  
  const navigateToCamera = (mediaType: 'photo' | 'video') => {
    onClose();
    // Small delay to ensure smooth transition
    setTimeout(() => router.push({
      pathname: '/make',
      params: { mediaType }
    }), 100);
  };
  
  const navigateToScan = () => {
    onClose();
    // Small delay to ensure smooth transition
    setTimeout(() => router.push({
      pathname: '/(tabs)/verify',
      params: { openScanner: 'true' }
    }), 100);
  };
  
  const backgroundOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.7],
  });
  
  const menuTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [height / 2, 0],
  });
  
  const menuOpacity = animation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });
  
  if (!visible) return null;

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Animated background overlay with touch to close */}
        <Pressable style={styles.fullScreen} onPress={onClose}>
          <Animated.View
            style={[
              styles.overlay,
              { opacity: backgroundOpacity },
            ]}
          />
        </Pressable>
        
        {/* Menu options */}
        <Animated.View
          style={[
            styles.menuContainer,
            {
              opacity: menuOpacity,
              transform: [{ translateY: menuTranslateY }],
            },
          ]}
        >
          {/* Main media options */}
          <View style={styles.mainOptions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigateToCamera('photo')}
              activeOpacity={0.9}
            >
              <View style={[styles.iconBackground, styles.photoBackground]}>
                <Ionicons name="camera" size={30} color="#FFFFFF" />
              </View>
              <Text style={styles.iconText}>Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigateToCamera('video')}
              activeOpacity={0.9}
            >
              <View style={[styles.iconBackground, styles.videoBackground]}>
                <Ionicons name="videocam" size={28} color="#FFFFFF" />
              </View>
              <Text style={styles.iconText}>Video</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.iconButton}
              onPress={navigateToScan}
              activeOpacity={0.9}
            >
              <View style={[styles.iconBackground, styles.scanBackground]}>
                <Ionicons name="qr-code" size={28} color="#FFFFFF" />
              </View>
              <Text style={styles.iconText}>Scan</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  menuContainer: {
    position: 'absolute',
    bottom: 0,
    width: width,
    zIndex: 2,
    paddingBottom: 80,
    paddingTop: 20,
  },
  mainOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
  },
  iconButton: {
    alignItems: 'center',
  },
  iconBackground: {
    width: 60,
    height: 60,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  photoBackground: {
    backgroundColor: '#007AFF',
  },
  videoBackground: {
    backgroundColor: '#FF2D55',
  },
  scanBackground: {
    backgroundColor: '#5856D6',
  },
  iconText: {
    color: '#FFFFFF',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MediaSelection; 