import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Rect } from 'react-native-svg';

interface IconProps {
    size?: number;
    style?: StyleProp<ViewStyle>;
    color?: string;
}

export function MagicPencilIcon({ size = 24, style }: IconProps) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
            <Defs>
                <LinearGradient id="pencilGradient" x1="2" y1="22" x2="22" y2="2">
                    <Stop offset="0%" stopColor="#FFD700" />
                    <Stop offset="50%" stopColor="#FF69B4" />
                    <Stop offset="100%" stopColor="#00BFFF" />
                </LinearGradient>
            </Defs>
            {/* Horizontal lines representing text being corrected */}
            <Path
                d="M2 4h10"
                stroke="url(#pencilGradient)"
                strokeWidth="2"
                strokeLinecap="round"
            />
            <Path
                d="M2 8h7"
                stroke="url(#pencilGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                opacity={0.6}
            />
            {/* Pencil */}
            <Path
                d="M14.06 3.19l3.75 3.75L7.81 16.94H4.06v-3.75L14.06 3.19zM16.47 1.47c.39-.39 1.02-.39 1.41 0l2.34 2.34c.39.39.39 1.02 0 1.41l-1.83 1.83-3.75-3.75 1.83-1.83z"
                fill="url(#pencilGradient)"
            />
            {/* Sparkle effect for "magic" touch */}
            <Path
                d="M19 12l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"
                fill="#FFD700"
                opacity={0.8}
            />
        </Svg>
    );
}

export function CameraIcon({ size = 24, color = '#FF6B6B', style }: IconProps) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
            {/* Camera body */}
            <Rect
                x="2"
                y="6"
                width="15"
                height="12"
                rx="2"
                fill={color}
            />
            {/* Lens */}
            <Circle
                cx="9.5"
                cy="12"
                r="3"
                fill="white"
                opacity={0.9}
            />
            <Circle
                cx="9.5"
                cy="12"
                r="1.5"
                fill={color}
            />
            {/* Video play triangle */}
            <Path
                d="M17 9l5 3-5 3V9z"
                fill={color}
            />
        </Svg>
    );
}

