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
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
    </Svg>
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

