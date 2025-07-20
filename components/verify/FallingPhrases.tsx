import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';

const { width, height } = Dimensions.get('window');

interface FallingPhrase {
  id: number;
  phrase: string;
  position: Animated.Value;
  xPosition: number;
  opacity: Animated.Value;
  speed: number;
  startDelay: number;
}

interface FallingPhrasesProps {
  phrases: string[];
  active: boolean;
  startYPosition?: number; // This will be ignored now as we're starting from above screen
}

const FallingPhrases: React.FC<FallingPhrasesProps> = ({ phrases, active, startYPosition = 200 }) => {
  const [fallingPhrases, setFallingPhrases] = useState<FallingPhrase[]>([]);
  const animationsRef = useRef<Animated.CompositeAnimation[]>([]);
  const idCounter = useRef(0);

  // Create falling phrases when component mounts or phrases change
  useEffect(() => {
    if (active && phrases.length > 0) {
      createFallingPhrases();
    }
    
    return () => {
      // Stop all animations when component unmounts
      animationsRef.current.forEach(anim => anim.stop());
    };
  }, [phrases, active]);

  // Create falling phrases with random positions and speeds
  const createFallingPhrases = () => {
    const newPhrases: FallingPhrase[] = [];
    
    // Create a falling phrase for each phrase in the array
    phrases.forEach((phrase, index) => {
      const startDelay = Math.random() * 5000; // Random start delay up to 5 seconds
      const speed = 10000 + Math.random() * 10000; // Random speed between 10-20 seconds (slower)
      const xPosition = Math.random() * (width - 250); // Random horizontal position with spacing
      
      newPhrases.push({
        id: idCounter.current++,
        phrase,
        position: new Animated.Value(-100), // Start above screen
        xPosition,
        opacity: new Animated.Value(0),
        speed,
        startDelay
      });
    });
    
    setFallingPhrases(newPhrases);
    
    // Start animations after a short delay
    setTimeout(() => {
      startAnimations(newPhrases);
    }, 500);
  };

  // Start animations for all phrases
  const startAnimations = (phrases: FallingPhrase[]) => {
    const animations: Animated.CompositeAnimation[] = [];
    
    phrases.forEach(phrase => {
      // Create sequence for each phrase: fade in, fall down, fade out
      const animation = Animated.sequence([
        // Wait for start delay
        Animated.delay(phrase.startDelay),
        
        // Fade in
        Animated.timing(phrase.opacity, {
          toValue: 0.9,
          duration: 1500,
          useNativeDriver: true,
        }),
        
        // Fall down
        Animated.parallel([
          Animated.timing(phrase.position, {
            toValue: height + 200, // Fall well past bottom of screen
            duration: phrase.speed,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          
          // Fade out near the bottom
          Animated.timing(phrase.opacity, {
            toValue: 0,
            duration: phrase.speed,
            delay: phrase.speed * 0.8, // Start fading out at 80% of the way down
            useNativeDriver: true,
          })
        ])
      ]);
      
      // Loop the animation
      animation.start(() => {
        // Reset position and restart when animation completes
        phrase.position.setValue(-100); // Reset to above screen
        phrase.opacity.setValue(0);
        
        // Restart with a new random delay
        const newDelay = Math.random() * 3000;
        setTimeout(() => {
          startAnimations([phrase]);
        }, newDelay);
      });
      
      animations.push(animation);
    });
    
    animationsRef.current = animations;
  };

  if (!active) return null;

  console.log('FallingPhrases active:', active, 'phrases count:', fallingPhrases.length);

  return (
    <View style={styles.container} pointerEvents="none">
      {fallingPhrases.map(phrase => (
        <Animated.View
          key={phrase.id}
          style={[
            styles.phraseContainer,
            {
              transform: [{ translateY: phrase.position }],
              left: phrase.xPosition,
              opacity: phrase.opacity
            }
          ]}
        >
          <Text style={styles.phraseText}>{phrase.phrase}</Text>
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 1,
  },
  phraseContainer: {
    position: 'absolute',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  phraseText: {
    color: '#111111',
    fontWeight: '600',
    fontSize: 16,
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  }
});

export default FallingPhrases; 