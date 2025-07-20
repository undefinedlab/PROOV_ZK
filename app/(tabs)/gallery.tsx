import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    FlatList,
    Image,
    StatusBar,
    Dimensions,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PhotoDetailsModal from '../../components/gallery/PhotoDetailsModal';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

interface SavedPhoto {
    id: string;
    timestamp: number;
    photoUri: string;
    metadata: {
        location?: {
            latitude: number;
            longitude: number;
            city?: string;
            country?: string;
            continent?: string;
        };
        deviceInfo: string;
        photoHash: string;
        ipfsCid?: string;
        isVideo?: boolean;
        duration?: number;
    };
    zkCapsule: {
        capsule_id: string;
        public_claims: Record<string, string>;
        proof: any;
        metadata: {
            proof_scheme: string;
            circuit_version: string;
            image_hash: string;
            verification_key: string;
            ipfsCid?: string;
            ipfsUrl?: string;
            created_at: number;
        };
    };
}

export default function GalleryScreen() {
    const [photos, setPhotos] = useState<SavedPhoto[]>([]);
    const [selectedPhoto, setSelectedPhoto] = useState<SavedPhoto | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [loading, setLoading] = useState(true);

    // Load photos when component mounts
    useEffect(() => {
        loadPhotos();
    }, []);

    const loadPhotos = async () => {
        try {
            setLoading(true);
            const photosString = await AsyncStorage.getItem('@zk_verified_photos');
            console.log('Raw photos data:', photosString);
            
            if (photosString) {
                const savedPhotos: SavedPhoto[] = JSON.parse(photosString);
                setPhotos(savedPhotos);
            }
        } catch (error) {
            console.error('Error loading photos:', error);
            Alert.alert('Error', 'Failed to load photos from gallery');
        } finally {
            setLoading(false);
        }
    };

    const getDateLabel = (timestamp: number) => {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { 
                weekday: 'long',
                month: 'long',
                day: 'numeric'
            });
        }
    };

    const groupPhotosByDate = (photos: SavedPhoto[]) => {
        const groups: { [key: string]: SavedPhoto[] } = {};
        
        photos.forEach(photo => {
            const dateLabel = getDateLabel(photo.timestamp);
            if (!groups[dateLabel]) {
                groups[dateLabel] = [];
            }
            groups[dateLabel].push(photo);
        });
        
        return Object.entries(groups).sort(([a], [b]) => {
            // Sort by date, newest first
            const aDate = groups[a][0].timestamp;
            const bDate = groups[b][0].timestamp;
            return bDate - aDate;
        });
    };

    const openPhotoDetails = (photo: SavedPhoto) => {
        setSelectedPhoto(photo);
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setSelectedPhoto(null);
    };

    const sharePhoto = async () => {
        if (!selectedPhoto) return;

        try {
            // Check if sharing is available
            Alert.alert('Sharing', 'Sharing feature temporarily disabled');
        } catch (error) {
            console.error('Error sharing photo:', error);
            Alert.alert('Error', 'Failed to share photo');
        }
    };

    const handleUpdatePhoto = (updatedPhoto: SavedPhoto) => {
        // Update the photo in the photos array
        const updatedPhotos = photos.map(p => 
            p.id === updatedPhoto.id ? updatedPhoto : p
        );
        setPhotos(updatedPhotos);
        setSelectedPhoto(updatedPhoto);
    };

    const deletePhoto = async (photoId: string) => {
        Alert.alert(
            'Delete Photo',
            'Are you sure you want to delete this photo and its ZK proof?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const updatedPhotos = photos.filter(p => p.id !== photoId);
                            await AsyncStorage.setItem('@zk_verified_photos', JSON.stringify(updatedPhotos));
                            setPhotos(updatedPhotos);
                            closeModal();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete photo');
                        }
                    },
                },
            ]
        );
    };

    const renderPhotoItem = ({ item }: { item: SavedPhoto }) => {
        return (
            <TouchableOpacity
                style={styles.photoItem}
                onPress={() => openPhotoDetails(item)}
            >
                <Image 
                    source={{ uri: item.photoUri }} 
                    style={styles.photoThumbnail} 
                />
                {item.metadata.isVideo && (
                    <View style={styles.videoIndicator}>
                        <MaterialIcons name="play-circle-filled" size={24} color="#FFFFFF" />
                    </View>
                )}
                {item.zkCapsule.public_claims.verified === 'true' && (
                    <View style={styles.verifiedBadge}>
                        <MaterialIcons name="verified" size={16} color="#FFFFFF" />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderDateSection = ([dateLabel, photos]: [string, SavedPhoto[]]) => (
        <View style={styles.dateSection} key={dateLabel}>
            <Text style={styles.dateLabel}>{dateLabel}</Text>
            <View style={styles.photosGrid}>
                {photos.map(photo => (
                    <View key={photo.id} style={styles.photoItemContainer}>
                        {renderPhotoItem({ item: photo })}
                    </View>
                ))}
            </View>
        </View>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <MaterialCommunityIcons name="image-multiple" size={80} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Photos Yet</Text>
            <Text style={styles.emptyDescription}>
                Take your first photo with ZK verification using the camera button
            </Text>
        </View>
    );

    // Group photos by date
    const groupedPhotos = groupPhotosByDate(photos);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            
            <View style={styles.content}>
                {photos.length === 0 && !loading ? (
                    renderEmptyState()
                ) : (
                    <FlatList
                        data={groupedPhotos}
                        renderItem={({ item }) => renderDateSection(item)}
                        keyExtractor={([date]) => date}
                        contentContainerStyle={styles.flatlistContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>

            {selectedPhoto && (
                <PhotoDetailsModal
                    visible={modalVisible}
                    photo={selectedPhoto}
                    onClose={closeModal}
                    onShare={sharePhoto}
                    onDelete={() => deletePhoto(selectedPhoto.id)}
                    onUpdatePhoto={handleUpdatePhoto}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(20, 20, 30, 0.95)',
    },
    content: {
        flex: 1,
        paddingHorizontal: 15,
    },
    flatlistContent: {
        paddingTop: 15,
        paddingBottom: 100,
    },
    dateSection: {
        marginBottom: 20,
    },
    dateLabel: {
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 10,
        color: '#FFFFFF',
        paddingLeft: 5,
    },
    photosGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    photoItemContainer: {
        width: '33.33%',
        padding: 3,
    },
    photoItem: {
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#1E293B',
    },
    photoThumbnail: {
        width: '100%',
        aspectRatio: 1,
    },
    videoIndicator: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 15,
        padding: 3,
    },
    verifiedBadge: {
        position: 'absolute',
        top: 5,
        right: 5,
        backgroundColor: '#10B981',
        borderRadius: 10,
        padding: 3,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 20,
        color: '#FFFFFF',
    },
    emptyDescription: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 10,
        color: '#94A3B8',
        maxWidth: 300,
    },
}); 