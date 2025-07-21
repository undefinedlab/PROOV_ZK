# Proove 📸

A mobile app for creating cryptographically verified photo proofs using zero-knowledge technology.

## What it does

Proove lets you take photos and generate cryptographic proofs that verify:
- **When** the photo was taken (timestamp)
- **Where** it was taken (location) 
- **What device** was used
- **Who** took it (identity verification)
- **What** the image contains

You can choose which information to reveal publicly while keeping the rest private.

## Features

- 📸 **Photo capture** with metadata extraction
- 🔒 **Privacy controls** - choose what to reveal
- 🛡️ **ZK Proof generation** - cryptographic verification
- 📱 **Mobile-first** - works on iOS and Android
- 🎯 **Simple interface** - essential privacy settings

## Planned Feature: Merkle Tree Security & Triple Verification

> **Note:** The following describes an intended feature that is not yet implemented, but represents the core vision for Proove's security model.

### The Initial Idea

When you use Proove, the app collects important information to prove the authenticity of your photos:
- The photo itself
- The timestamp (when it was taken)
- The location (where it was taken)
- Device details (what device was used)
- User identity (who took it)
- Any other relevant metadata

### How It Would Work

1. **Hashing the Data**
   - Each piece of information is turned into a unique digital fingerprint (a hash).

2. **Building the Merkle Tree**
   - All these hashes are inserted into a Merkle tree—a structure that combines them into a single root hash.
   - If any data changes, the root hash changes, making tampering obvious.

3. **Triple Verification **
   - **At Data Entry:** When data is first added, its hash is checked and placed in the Merkle tree.
   - **Along the Route:** As data moves (e.g., device → storage → network), its hash is continually checked against the Merkle root to ensure integrity.
   - **On Return:** When data or proofs are retrieved, the hash is checked again to confirm nothing has changed.

### Why This Matters
- **Tamper-evidence:** Any change to the data is instantly detectable.
- **Efficient verification:** Only hashes and the Merkle root need to be checked.
- **Privacy:** You can prove your data is included without revealing the data itself.

This approach is designed to make every proof cryptographically sound and verifiable at every stage, even though it is not yet implemented in the current version of Proove.

## Tech Stack

- **Frontend**: React Native, Expo
- **ZK Proofs**: Mopro (mobile zero-knowledge)
- **Storage**: Local device storage
- **UI**: Custom glassmorphic design

## Getting Started

1. Install dependencies: `npm install`
2. Start the app: `npx expo start`
3. Use Expo Go app to scan QR code

## Use Cases

- **Social Media**: Share verified photos
- **Journalism**: Authenticate news photos  
- **Legal**: Create admissible evidence
- **Content Creation**: Prove original work

Built for a more trustworthy digital world.