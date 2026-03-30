export type ScreenName =
    | 'chats'
    | 'courses'
    | 'sos'
    | 'profile'
    | 'call'
    | 'course_player'
    | 'course_presentation'
    | 'edit_profile'
    | 'privacy'
    | 'emergency_contacts'
    | 'notifications'
    | 'new_group'
    | 'sos';

export interface NavigationParams {
    courseId?: string;
    conversationId?: string;
    recipientId?: string;
    isGroup?: boolean;
    title?: string;
    roomName?: string;
    username?: string;
    userId?: string;
    [key: string]: unknown;
}

export type NavigateFunction = (screen: ScreenName, params?: NavigationParams) => void;
