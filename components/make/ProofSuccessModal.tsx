import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore
import ConfettiCannon from 'react-native-confetti-cannon';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

// Import types from existing code
interface CircomProof {}

interface ZKCapsule {
  capsule_id: string;
  public_claims: Record<string, string>;
  proof: CircomProof;
  metadata: {
    proof_scheme: string;
    circuit_version: string;
    image_hash: string;
    verification_key: string;
    ipfsCid?: string;
    ipfsUrl?: string;
    created_at: number;
    storageType: string;
    walrusBlobId?: string;
  };
}

interface PhotoMetadata {
  timestamp: number;
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
    continent?: string;
  };
  deviceInfo: string;
  photoHash: string;
  photoUri?: string;
  ipfsCid?: string;
}

interface ProofSuccessModalProps {
  capsule: ZKCapsule;
  metadata: PhotoMetadata | null;
  onReset: () => void;
}

const ProofSuccessModal: React.FC<ProofSuccessModalProps> = ({ 
  capsule, 
  metadata, 
  onReset
}) => {
  const router = useRouter();
  const confettiRef = useRef<ConfettiCannon>(null);

  React.useEffect(() => {
    // Trigger confetti animation on first render
    setTimeout(() => {
      if (confettiRef.current) {
        confettiRef.current.start();
      }
    }, 500);
  }, []);

  // Functions for success modal actions
  const sharePhoto = async () => {
    if (!metadata?.photoUri) return;
    
    try {
      await Sharing.shareAsync(metadata.photoUri, {
        dialogTitle: 'Share ZK Verified Photo',
      });
    } catch (error) {
      console.error('Error sharing photo:', error);
      Alert.alert('Error', 'Failed to share photo');
    }
  };
  
  const downloadPhoto = async () => {
    if (!metadata?.photoUri) return;
    
    try {
      // Request media library permissions first
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required', 
          'Please grant permission to save photos to your gallery.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => {
                Alert.alert('Info', 'Please go to Settings > Privacy > Photos and enable access for this app.');
              }
            }
          ]
        );
        return;
      }
      
      // Copy to a temporary location if needed
      const filename = `ZK_Photo_${Date.now()}.jpg`;
      const localUri = `${FileSystem.documentDirectory}${filename}`;
      
      await FileSystem.copyAsync({
        from: metadata.photoUri,
        to: localUri
      });
      
      // Save to media library
      const asset = await MediaLibrary.createAssetAsync(localUri);
      await MediaLibrary.createAlbumAsync('ZK Photos', asset, false);
      
      Alert.alert('Success!', 'Photo saved to your gallery in "ZK Photos" album');
    } catch (error) {
      console.error('Error downloading photo:', error);
      Alert.alert('Error', 'Failed to save photo to gallery');
    }
  };
  
  const copyCapsuleToClipboard = async () => {
    if (!capsule) return;
    
    try {
      const capsuleString = JSON.stringify(capsule, null, 2);
      await Clipboard.setStringAsync(capsuleString);
      
      Alert.alert('Success', 'Capsule copied to clipboard');
    } catch (error) {
      console.error('Error copying capsule:', error);
      Alert.alert('Error', 'Failed to copy capsule');
    }
  };

  return (
    <View style={styles.successModalContainer}>
      <ConfettiCannon
        ref={confettiRef}
        count={150}
        origin={{x: width / 2, y: -20}}
        fadeOut={true}
        autoStart={false}
        explosionSpeed={350}
        fallSpeed={2500}
        colors={['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444']}
      />
      
      <TouchableOpacity 
        style={styles.closeButton} 
        onPress={() => {
          onReset();
          router.push('/gallery');
        }}
      >
        <MaterialIcons name="close" size={24} color="#64748B" />
      </TouchableOpacity>
      
      <View style={styles.successTitleContainer}>
        <MaterialIcons name="check-circle" size={28} color="#10B981" />
        <Text style={styles.successTitle}>Proof Generated</Text>
      </View>
      
      <View style={styles.successContainer}>
        {metadata?.photoUri && (
          <Image source={{ uri: metadata.photoUri }} style={styles.successPhoto} />
        )}
        
        <View style={styles.proofsCard}>
          <Text style={styles.proofsCardTitle}>Verified Claims</Text>
          <View style={styles.proofsList}>
            {capsule.public_claims.time_within_month === "true" && (
              <Text style={styles.proofItem}>
                <MaterialIcons name="schedule" size={14} color="#64748B" />
                {" " + capsule.public_claims.time_claim}
              </Text>
            )}
            {capsule.public_claims.location_in_region === "true" && (
              <Text style={styles.proofItem}>
                <Ionicons name="location-outline" size={14} color="#64748B" />
                {" " + capsule.public_claims.location_claim}
              </Text>
            )}
            {capsule.public_claims.device_trusted === "true" && (
              <Text style={styles.proofItem}>
                <MaterialIcons name="smartphone" size={14} color="#64748B" />
                {" " + capsule.public_claims.device_claim}
              </Text>
            )}
            {capsule.public_claims.photo_authentic === "true" && (
              <Text style={styles.proofItem}>
                <MaterialIcons name="person" size={14} color="#64748B" />
                {" " + capsule.public_claims.authenticity_claim}
              </Text>
            )}
            {capsule.public_claims.image_content_claim && (
              <Text style={styles.proofItem}>
                <MaterialIcons name="image" size={14} color="#64748B" />
                {" " + capsule.public_claims.image_content_claim}
              </Text>
            )}
          </View>
          
      
        </View>
        
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={sharePhoto}>
            <MaterialIcons name="share" size={18} color="#64748B" />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={downloadPhoto}>
            <MaterialIcons name="file-download" size={18} color="#64748B" />
            <Text style={styles.actionButtonText}>Download</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={copyCapsuleToClipboard}>
            <MaterialIcons name="content-copy" size={18} color="#64748B" />
            <Text style={styles.actionButtonText}>Copy Capsule</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  successModalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    zIndex: 9999, // Higher than tab bar z-index
    elevation: 9999, // For Android
  },
  successTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 60,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginLeft: 10,
  },
  successContainer: {
    width: '100%',
    alignItems: 'center',
    maxWidth: 400,
  },
  successPhoto: {
    width: '100%',
    height: 300,
    borderRadius: 16,
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  proofsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.6)',
  },
  proofsCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
  },
  proofsList: {
    width: '100%',
  },
  proofItem: {
    fontSize: 13,
    color: '#1E293B',
    marginBottom: 8,
    paddingVertical: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    gap: 12,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.6)',
  },
  actionButtonText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  ipfsLinkContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(241, 245, 249, 0.7)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.6)',
  },
  ipfsLinkTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  ipfsLink: {
    fontSize: 12,
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
  walrusLinkContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(241, 245, 249, 0.7)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.6)',
  },
  walrusLinkTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  walrusBlobIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walrusBlobIdLabel: {
    fontSize: 12,
    color: '#1E293B',
    marginRight: 8,
  },
  walrusBlobIdText: {
    fontSize: 12,
    color: '#3B82F6',
    textDecorationLine: 'underline',
  },
  walrusCopyButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 10000, // Higher than modal container
  },
});

export default ProofSuccessModal; 