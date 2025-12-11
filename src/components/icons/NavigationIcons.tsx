import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
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
      source={require('../../../assets/courses.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
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
      source={require('../../../assets/sos.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

export function ProfileIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Image
      source={require('../../../assets/user.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
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
