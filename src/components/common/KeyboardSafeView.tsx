
import React, { useState, useEffect } from 'react';
import {
    KeyboardAvoidingView,
    StyleSheet,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    View,
    ViewStyle
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';

interface Props {
    children: React.ReactNode;
    style?: ViewStyle;
    contentContainerStyle?: ViewStyle;
    offset?: number;
    dismissOnPress?: boolean;
    useSafeArea?: boolean;
    edges?: Edge[];
}

/**
 * KeyboardSafeView
 * 
 * Advanced Keyboard Handling:
 * - iOS: Uses stable 'padding' behavior.
 * - Android: Uses Dynamic Behavior Switching.
 *   - When Keyboard Opens: Switches to 'height' to ensure input is visible (overriding native resize).
 *   - When Keyboard Closes: Switches to undefined to let native 'adjustResize' clean up layout.
 *   - This prevents the "sticky gap" bug common in Expo Android apps.
 */
export const KeyboardSafeView = ({
    children,
    style,
    contentContainerStyle,
    offset = 0,
    dismissOnPress = true,
    useSafeArea = true,
    edges = ['top', 'bottom']
}: Props) => {
    // Initial behavior based on platform
    const [behavior, setBehavior] = useState<any>(
        Platform.OS === 'ios' ? 'padding' : undefined
    );

    useEffect(() => {
        // Dynamic switching only needed for Android to fix the Gap Bug
        if (Platform.OS !== 'android') return;

        const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
            // Force 'height' when keyboard is up so input isn't covered
            setBehavior('height');
        });
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
            // Reset to undefined so layout snaps back without a gap
            setBehavior(undefined);
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const content = (
        <KeyboardAvoidingView
            style={[styles.flex, contentContainerStyle]}
            behavior={behavior}
            keyboardVerticalOffset={offset}
            enabled={Platform.OS !== 'ios'} // Disable on iOS to prevent visual bugs
        >
            {children}
        </KeyboardAvoidingView>
    );

    const Wrapper = useSafeArea ? SafeAreaView : View;
    const wrapperProps = useSafeArea ? { edges } : {};

    return (
        <Wrapper style={[styles.flex, style]} {...wrapperProps}>
            {dismissOnPress ? (
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    {content}
                </TouchableWithoutFeedback>
            ) : content}
        </Wrapper>
    );
};

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    }
});
