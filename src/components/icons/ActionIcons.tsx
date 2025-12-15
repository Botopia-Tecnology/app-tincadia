import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface IconProps {
    size?: number;
    style?: any;
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
            <Path
                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                fill="url(#pencilGradient)"
            />
            <Path
                d="M17.81 9.94L14.06 6.19 14.06 6.19 3 17.25V21h3.75L17.81 9.94z"
                stroke="#FFFFFF"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.3}
            />
        </Svg>
    );
}
