import React from 'react';
import Svg, { Path, Circle, Rect, Polygon } from 'react-native-svg';
import { Image } from 'react-native';

interface IconProps {
  size?: number;
  color?: string;
}

export function ChatIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
        fill={color}
      />
    </Svg>
  );
}

export function CoursesIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Image
      source={{ uri: 'https://res.cloudinary.com/do1mvhvms/image/upload/v1767650875/educacion_hu8sqk.png' }}
      style={{ width: size, height: size }}
      resizeMode="cover"
    />
  );
}

export function HandshakeIcon({ size = 24, color = '#000000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M16.01 10.99l-2.01-2.01c-.19-.19-.44-.29-.7-.29-.27 0-.52.11-.71.29l-3.01 3.01c-.18.18-.29.43-.29.7 0 .27.11.52.29.71l2.01 2.01c.19.19.44.29.7.29.27 0 .52-.11.71-.29l3.01-3.01c.18-.18.29-.43.29-.7 0-.27-.11-.52-.29-.71zM8.71 16.29l-2.01-2.01c-.19-.19-.29-.44-.29-.7 0-.27.11-.52.29-.71l3.01-3.01c.18-.18.43-.29.7-.29.27 0 .52.11.71.29l2.01 2.01-4.42 4.42z" />
      <Path d="M21.54 9.88l-2.06-2.06c-.78-.78-2.05-.78-2.83 0L9.66 14.81c-.39.39-.39 1.02 0 1.41l2.06 2.06c.39.39 1.02.39 1.41 0l6.99-6.99c.78-.78.78-2.05 0-2.83z" opacity=".3" />
      <Path d="M12.42 16.93l6.99-6.99c.39-.39.39-1.02 0-1.41l-2.06-2.06c-.39-.39-1.02-.39-1.41 0l-6.99 6.99c-.39.39-.39 1.02 0 1.41l2.06 2.06c.39.39 1.02.39 1.41 0z" />
    </Svg>
  );
}

export function SOSIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Image
      source={{ uri: 'https://res.cloudinary.com/do1mvhvms/image/upload/v1767650799/ghyqs2fshx30bsbj1m3i_akaakx.png' }}
      style={{ width: size, height: size }}
      resizeMode="cover"
    />
  );
}

export function ProfileIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Image
      source={{ uri: 'https://res.cloudinary.com/dzi2p0pqa/image/upload/v1767366296/eypdcpyqef9wubgxukcs.png' }}
      style={{ width: size, height: size }}
      resizeMode="cover"
    />
  );
}

export function MoreIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="5" r="2" fill={color} />
      <Circle cx="12" cy="12" r="2" fill={color} />
      <Circle cx="12" cy="19" r="2" fill={color} />
    </Svg>
  );
}

export function BackArrowIcon({ size = 24, color = '#000000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"
        fill={color}
      />
    </Svg>
  );
}

export function VideoCallIcon({ size = 24, color = '#000000' }: IconProps) {
  return (
    <Image
      source={require('../../../assets/videocall.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

export function VoiceIcon({ size = 16, color = '#666666' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
        fill={color}
      />
      <Path
        d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
        fill={color}
      />
    </Svg>
  );
}

export function PhotoIcon({ size = 16, color = '#666666' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
        fill={color}
      />
    </Svg>
  );
}

export function CheckIcon({ size = 14, color = '#4CAF50' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
        fill={color}
      />
    </Svg>
  );
}

export function SearchIcon({ size = 20, color = '#999999' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
        fill={color}
      />
    </Svg>
  );
}

export function AccountIcon({ size = 24, color = '#000000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
        fill={color}
      />
    </Svg>
  );
}

export function PrivacyIcon({ size = 24, color = '#000000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"
        fill={color}
      />
    </Svg>
  );
}

export function HelpIcon({ size = 24, color = '#000000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"
        fill={color}
      />
    </Svg>
  );
}

export function InviteIcon({ size = 24, color = '#000000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
        fill={color}
      />
    </Svg>
  );
}

export function NotificationIcon({ size = 24, color = '#000000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"
        fill={color}
      />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 24, color = '#000000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"
        fill={color}
      />
    </Svg>
  );
}

export function CameraIcon({ size = 24, color = '#666666' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15.2c1.767 0 3.2-1.433 3.2-3.2S13.767 8.8 12 8.8 8.8 10.233 8.8 12s1.433 3.2 3.2 3.2zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"
        fill={color}
      />
    </Svg>
  );
}

export function MicrophoneIcon({ size = 24, color = '#666666' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15a.998.998 0 00-.98-.85c-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"
        fill={color}
      />
    </Svg>
  );
}

export function SendIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
        fill={color}
      />
    </Svg>
  );
}

export function PlusIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
        fill={color}
      />
    </Svg>
  );
}

export function PhoneIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-2.2 2.2a15.17 15.17 0 01-6.59-6.59l2.2-2.21c.28-.26.36-.65.25-1.01A11.36 11.36 0 01 8.59 3.91c0-.55-.45-1-1-1H4.39c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.21c0-.55-.45-1-1-1z"
        fill={color}
      />
    </Svg>
  );
}

export function PencilIcon({ size = 24, color = '#000000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
        fill={color}
      />
    </Svg>
  );
}

// Media Control Icons

export function PlayIcon({ size = 48, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 5v14l11-7z" fill={color} />
    </Svg>
  );
}

export function PauseIcon({ size = 48, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill={color} />
    </Svg>
  );
}

export function SkipForwardIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" fill={color} />
    </Svg>
  );
}

export function SkipBackwardIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" fill={color} />
    </Svg>
  );
}

export function FullscreenIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill={color} />
    </Svg>
  );
}

// Biometric Authentication Icons

/**
 * Official Apple Face ID icon
 * Based on Apple's SF Symbols guidelines
 */
export function FaceIdIcon({ size = 40, color = '#007AFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Outer frame corners */}
      <Path
        d="M6 2H4C2.9 2 2 2.9 2 4V6"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18 2H20C21.1 2 22 2.9 22 4V6"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 22H4C2.9 22 2 21.1 2 20V18"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18 22H20C21.1 22 22 21.1 22 20V18"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Face features */}
      {/* Eyes */}
      <Path
        d="M9 9V10"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <Path
        d="M15 9V10"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Nose */}
      <Path
        d="M12 10V13H11"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Smile */}
      <Path
        d="M8.5 15.5C9.17 16.5 10.5 17.5 12 17.5C13.5 17.5 14.83 16.5 15.5 15.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Fingerprint icon for Android authentication
 */
export function FingerprintIcon({ size = 40, color = '#25D366' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28zM3.5 9.72c-.1 0-.2-.03-.29-.09-.23-.16-.28-.47-.12-.7.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25.16.22.11.54-.12.7-.23.16-.54.11-.7-.12-.9-1.26-2.04-2.25-3.39-2.94-2.87-1.47-6.54-1.47-9.4.01-1.36.7-2.5 1.7-3.4 2.96-.08.14-.23.21-.39.21zm6.25 12.07c-.13 0-.26-.05-.35-.15-.87-.87-1.34-1.43-2.01-2.64-.69-1.23-1.05-2.73-1.05-4.34 0-2.97 2.54-5.39 5.66-5.39s5.66 2.42 5.66 5.39c0 .28-.22.5-.5.5s-.5-.22-.5-.5c0-2.42-2.09-4.39-4.66-4.39-2.57 0-4.66 1.97-4.66 4.39 0 1.44.32 2.77.93 3.85.64 1.15 1.08 1.64 1.85 2.42.19.2.19.51 0 .71-.11.1-.24.15-.37.15zm7.17-1.85c-1.19 0-2.24-.3-3.1-.89-1.49-1.01-2.38-2.65-2.38-4.39 0-.28.22-.5.5-.5s.5.22.5.5c0 1.41.72 2.74 1.94 3.56.71.48 1.54.71 2.54.71.24 0 .64-.03 1.04-.1.27-.05.53.13.58.41.05.27-.13.53-.41.58-.57.11-1.07.12-1.21.12zM14.91 22c-.04 0-.09-.01-.13-.02-1.59-.44-2.63-1.03-3.72-2.1-1.4-1.39-2.17-3.24-2.17-5.22 0-1.62 1.38-2.94 3.08-2.94 1.7 0 3.08 1.32 3.08 2.94 0 1.07.93 1.94 2.08 1.94s2.08-.87 2.08-1.94c0-3.77-3.25-6.83-7.25-6.83-2.84 0-5.44 1.58-6.61 4.03-.39.81-.59 1.76-.59 2.8 0 .78.07 2.01.67 3.61.1.26-.03.55-.29.64-.26.1-.55-.04-.64-.29-.49-1.31-.73-2.61-.73-3.96 0-1.2.23-2.29.68-3.24 1.33-2.79 4.28-4.6 7.51-4.6 4.55 0 8.25 3.51 8.25 7.83 0 1.62-1.38 2.94-3.08 2.94s-3.08-1.32-3.08-2.94c0-1.07-.93-1.94-2.08-1.94s-2.08.87-2.08 1.94c0 1.71.66 3.31 1.87 4.51.95.94 1.86 1.46 3.27 1.85.27.07.42.35.35.61-.05.23-.26.38-.47.38z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * Emergency Contact icon - Person with heart
 * For emergency contacts section in profile
 */
export function EmergencyContactIcon({ size = 20, color = '#FF3B30' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Person silhouette */}
      <Circle cx="9" cy="7" r="4" fill={color} />
      <Path
        d="M9 13c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z"
        fill={color}
      />
      {/* Heart */}
      <Path
        d="M19.5 10c-1.24 0-2.25.66-2.5 1.5-.25-.84-1.26-1.5-2.5-1.5-1.49 0-2.5 1.17-2.5 2.5 0 2.27 3.33 4.5 5 5.5 1.67-1 5-3.23 5-5.5 0-1.33-1.01-2.5-2.5-2.5z"
        fill={color}
      />
    </Svg>
  );
}

export function SyncIcon({ size = 24, color = '#000000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"
        fill={color}
      />
    </Svg>
  );
}


