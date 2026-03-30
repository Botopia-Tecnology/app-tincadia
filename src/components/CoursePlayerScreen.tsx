import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Image, Dimensions, TouchableWithoutFeedback, Alert, FlatList } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { contentService, Course, Module, Lesson } from '../services/content.service';
import { PlayIcon, PauseIcon, SkipForwardIcon, SkipBackwardIcon, FullscreenIcon } from './icons/NavigationIcons';
import { useTheme } from '../contexts/ThemeContext';

interface CoursePlayerScreenProps {
    courseId: string;
    onBack: () => void;
    isPublished?: boolean;
    priceInCents?: number;
    instructor?: string;
}

export function CoursePlayerScreen({ courseId, onBack }: CoursePlayerScreenProps) {
    const { colors, isDark } = useTheme();
    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
    const [expandedModules, setExpandedModules] = useState<string[]>([]);
    const [hasPaidAccess] = useState(false); // TODO: conectar con suscripción real

    // Player State
    const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const videoRef = useRef<Video>(null);
    const [messageText, setMessageText] = React.useState('');
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        fetchCourse();
        return () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, [courseId]);

    const isLessonLocked = useCallback((c: Course, module: Module | { isPaid?: boolean }, lesson: Lesson) => {
        if (lesson?.locked) return true;
        if (lesson?.videoUrl) return false;

        const scope = c.accessScope || 'course';
        const isPreview = lesson?.isFreePreview;
        if (isPreview) return false;
        if (hasPaidAccess) return false;

        if (scope === 'course') return !!c.isPaid;
        if (scope === 'module') return !!module?.isPaid;
        if (scope === 'lesson') return !!lesson?.isPaid;
        return false;
    }, [hasPaidAccess]);

    const fetchCourse = async () => {
        try {
            setLoading(true);
            const data = await contentService.getCourseById(courseId);
            setCourse(data);

            // Seleccionar primera lección accesible
            const modules = data.modules || [];
            let firstModuleId: string | undefined;
            let firstLesson: Lesson | null = null;
            for (const mod of modules) {
                for (const les of mod.lessons || []) {
                    if (!isLessonLocked(data, mod, les)) {
                        firstModuleId = mod.id;
                        firstLesson = les;
                        break;
                    }
                }
                if (firstLesson) break;
            }
            if (firstModuleId) {
                setExpandedModules([firstModuleId]);
                setActiveLesson(firstLesson);
            } else if (modules.length > 0) {
                setExpandedModules([modules[0].id]);
            }
        } catch (error) {
            console.error('Failed to load course details', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleModule = (moduleId: string) => {
        setExpandedModules(prev =>
            prev.includes(moduleId)
                ? prev.filter(id => id !== moduleId)
                : [...prev, moduleId]
        );
    };

    const handleLessonSelect = (module: Module, lesson: Lesson) => {
        if (!course) return;
        if (isLessonLocked(course, module, lesson)) {
            Alert.alert('Contenido bloqueado', 'Debes desbloquear este contenido en la web para continuar.');
            return;
        }
        setActiveLesson(lesson);
        // Reset controls visibility on new video
        resetControlsTimer();
    };

    // --- Custom Player Logic ---

    const resetControlsTimer = () => {
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        setShowControls(true);
        controlsTimeoutRef.current = setTimeout(() => {
            if (status && status.isLoaded && status.isPlaying) {
                setShowControls(false);
            }
        }, 3000);
    };

    const handleVideoPress = () => {
        if (showControls) {
            setShowControls(false);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        } else {
            resetControlsTimer();
        }
    };

    const togglePlayPause = async () => {
        if (!videoRef.current) return;
        if (status?.isLoaded && status.isPlaying) {
            await videoRef.current.pauseAsync();
            resetControlsTimer(); // Keep controls visible safely
        } else {
            await videoRef.current.playAsync();
            resetControlsTimer();
        }
    };

    const skipForward = async () => {
        if (!videoRef.current || !status?.isLoaded) return;
        const newPosition = status.positionMillis + 10000;
        await videoRef.current.setPositionAsync(newPosition);
        resetControlsTimer();
    };

    const skipBackward = async () => {
        if (!videoRef.current || !status?.isLoaded) return;
        const newPosition = Math.max(0, status.positionMillis - 10000);
        await videoRef.current.setPositionAsync(newPosition);
        resetControlsTimer();
    };

    const handleSeek = async (value: number) => {
        if (!videoRef.current || !status?.isLoaded) return;
        await videoRef.current.setPositionAsync(value);
        resetControlsTimer();
    };

    const toggleFullscreen = async () => {
        if (!videoRef.current) return;
        // Basic full screen presentation
        try {
            await videoRef.current.presentFullscreenPlayer();
        } catch (e) {
            console.log("Fullscreen error", e);
        }
    };

    const formatTime = (millis: number) => {
        const totalSeconds = millis / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
            </View>
        );
    }

    if (!course) {
        return (
            <View style={styles.container}>
                <Text>No se encontró el curso.</Text>
                <TouchableOpacity onPress={onBack} style={{ padding: 20 }}>
                    <Text style={{ color: 'blue' }}>Volver</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const isBuffering = status?.isLoaded ? status.isBuffering : false;
    const isPlaying = status?.isLoaded ? status.isPlaying : false;
    const duration = status?.isLoaded ? status.durationMillis || 0 : 0;
    const position = status?.isLoaded ? status.positionMillis : 0;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar style="light" />

            {/* Video Player Section */}
            <View style={styles.videoContainer}>
                {activeLesson && !isLessonLocked(course, { lessons: [] }, activeLesson) && activeLesson?.videoUrl ? (
                    <TouchableWithoutFeedback onPress={handleVideoPress}>
                        <View style={{ width: '100%', height: '100%' }}>
                            <Video
                                ref={videoRef}
                                style={styles.video}
                                source={{ uri: activeLesson.videoUrl }}
                                useNativeControls={false} // Disabled Native Controls
                                resizeMode={ResizeMode.CONTAIN}
                                isLooping={false}
                                onPlaybackStatusUpdate={status => setStatus(() => status)}
                                posterSource={course.thumbnailUrl ? { uri: course.thumbnailUrl } : undefined}
                            />

                            {/* Custom Controls Overlay */}
                            {(showControls || isBuffering) && (
                                <View style={styles.controlsOverlay}>
                                    {/* Top Bar (Back Button) */}
                                    <View style={styles.controlsTop}>
                                        <TouchableOpacity onPress={onBack} style={styles.backButton}>
                                            <Text style={styles.backIcon}>←</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Center Controls (Play/Pause/Skip/Buffer) */}
                                    <View style={styles.controlsCenter}>
                                        {isBuffering ? (
                                            <ActivityIndicator size="large" color="#4CAF50" />
                                        ) : (
                                            <View style={styles.playPauseRow}>
                                                <TouchableOpacity onPress={skipBackward} style={styles.skipButton}>
                                                    <SkipBackwardIcon size={32} color="#FFF" />
                                                </TouchableOpacity>

                                                <TouchableOpacity onPress={togglePlayPause} style={styles.playButtonMain}>
                                                    {isPlaying ? (
                                                        <PauseIcon size={48} color="#FFF" />
                                                    ) : (
                                                        <PlayIcon size={48} color="#FFF" />
                                                    )}
                                                </TouchableOpacity>

                                                <TouchableOpacity onPress={skipForward} style={styles.skipButton}>
                                                    <SkipForwardIcon size={32} color="#FFF" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>

                                    {/* Bottom Bar (Seeker, Time, Fullscreen) */}
                                    <View style={styles.controlsBottom}>
                                        <Text style={styles.timeText}>{formatTime(position)}</Text>
                                        <Slider
                                            style={styles.slider}
                                            minimumValue={0}
                                            maximumValue={duration}
                                            value={position}
                                            onSlidingComplete={handleSeek}
                                            minimumTrackTintColor="#4CAF50"
                                            maximumTrackTintColor="#FFFFFF"
                                            thumbTintColor="#4CAF50"
                                        />
                                        <Text style={styles.timeText}>{formatTime(duration)}</Text>

                                        <TouchableOpacity onPress={toggleFullscreen} style={styles.fullscreenButton}>
                                            <FullscreenIcon size={24} color="#FFF" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    </TouchableWithoutFeedback>
                ) : (
                    <View style={styles.noVideoContainer}>
                        <View style={styles.headerOverlay}>
                            <TouchableOpacity onPress={onBack} style={styles.backButton}>
                                <Text style={styles.backIcon}>←</Text>
                            </TouchableOpacity>
                        </View>
        {course.thumbnailUrl && (
            <Image source={{ uri: course.thumbnailUrl }} style={styles.videoPlaceholderImage} />
        )}
                        <View style={styles.lockOverlay}>
                            <Text style={styles.lockText}>
                                {activeLesson ? 'Esta lección está bloqueada o no tiene video disponible.' : 'Selecciona una lección'}
                            </Text>
                        </View>
                    </View>
                )}
            </View>

            {/* Content List */}
            <ScrollView style={[styles.contentList, { backgroundColor: colors.background }]}>
                <View style={[styles.courseInfo, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.courseTitle, { color: colors.text }]}>{course.title}</Text>
                    {activeLesson && (
                        <Text style={[styles.lessonTitle, { color: colors.primary }]}>
                            Estás viendo: {activeLesson.title}
                        </Text>
                    )}
                </View>

                <View style={styles.playlistContainer}>
                    <Text style={[styles.playlistHeader, { color: colors.textSecondary }]}>Contenido del Curso</Text>

                    {course.modules?.map((module: Module) => (
                        <View key={module.id} style={[styles.moduleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <TouchableOpacity
                                style={[styles.moduleHeader, { backgroundColor: colors.surface }]}
                                onPress={() => toggleModule(module.id)}
                            >
                                <Text style={[styles.moduleTitle, { color: colors.text }]}>{module.title}</Text>
                                <Text style={{ color: colors.textSecondary }}>{expandedModules.includes(module.id) ? '▲' : '▼'}</Text>
                            </TouchableOpacity>

                                    {expandedModules.includes(module.id) && (
                                        <View style={[styles.lessonsContainer, { borderTopColor: colors.border }]}>
                                            {module.lessons?.map((lesson: Lesson) => (
                                                <TouchableOpacity
                                                    key={lesson.id}
                                                    style={[
                                                        styles.lessonItem,
                                                        { borderBottomColor: colors.border },
                                                        activeLesson?.id === lesson.id && {
                                                            backgroundColor: isDark ? 'rgba(76, 175, 80, 0.1)' : '#f0fdf4',
                                                            borderLeftWidth: 4,
                                                            borderLeftColor: colors.primary
                                                        }
                                                    ]}
                                                    onPress={() => handleLessonSelect(module, lesson)}
                                                >
                                                    <Text style={[styles.playIcon, { color: activeLesson?.id === lesson.id ? colors.primary : colors.textSecondary }]}>
                                                        {activeLesson?.id === lesson.id ? '▶' : '•'}
                                                    </Text>
                                                    <Text style={[
                                                        styles.lessonText,
                                                        { color: colors.text },
                                                        activeLesson?.id === lesson.id && { color: colors.primary, fontWeight: '600' }
                                                    ]}>
                                                        {lesson.title}
                                                    </Text>
                                                    {lesson.locked && <Text style={styles.lockBadge}>BLOQUEADO</Text>}
                                                </TouchableOpacity>
                                            ))}
                                            {(!module.lessons || module.lessons.length === 0) && (
                                                <Text style={[styles.emptyModuleText, { color: colors.textMuted }]}>Sin lecciones</Text>
                                            )}
                                        </View>
                                    )}
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    videoContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#000',
        position: 'relative',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    controlsOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'space-between',
        padding: 10,
        zIndex: 100,
    },
    controlsTop: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    controlsCenter: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    playPauseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 30,
    },
    playButtonMain: {
        width: 64,
        height: 64,
        justifyContent: 'center',
        alignItems: 'center',
        // backgroundColor: 'rgba(0,0,0,0.5)',
        // borderRadius: 32,
    },
    skipButton: {
        padding: 10,
    },
    controlsBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    slider: {
        flex: 1,
        marginHorizontal: 10,
        height: 40,
    },
    timeText: {
        color: '#FFF',
        fontSize: 12,
        fontVariant: ['tabular-nums'],
    },
    fullscreenButton: {
        marginLeft: 10,
        padding: 5,
    },
    noVideoContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoPlaceholderImage: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.3,
    },
    lockOverlay: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 20,
        borderRadius: 10,
    },
    lockText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    lockBadge: {
        color: '#facc15',
        fontSize: 12,
        marginLeft: 8,
        fontWeight: '700',
    },
    headerOverlay: {
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
    contentList: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        // marginTop: -10, // Removed to prevent covering video controls
    },
    courseInfo: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    courseTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    lessonTitle: {
        fontSize: 14,
        color: '#4CAF50',
        fontWeight: '500',
    },
    playlistContainer: {
        padding: 20,
    },
    playlistHeader: {
        fontSize: 16,
        fontWeight: '700',
        color: '#666',
        marginBottom: 16,
    },
    moduleCard: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        marginBottom: 12,
        overflow: 'hidden',
    },
    moduleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8fafc',
    },
    moduleTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
        flex: 1,
    },
    lessonsContainer: {
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    lessonItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    activeLessonItem: {
        backgroundColor: '#f0fdf4', // Greenish tint
        borderLeftWidth: 4,
        borderLeftColor: '#4CAF50',
    },
    playIcon: {
        width: 24,
        fontSize: 14,
        color: '#666',
        marginRight: 8,
        textAlign: 'center',
    },
    lessonText: {
        fontSize: 14,
        color: '#444',
        flex: 1,
    },
    activeLessonText: {
        color: '#4CAF50',
        fontWeight: '600',
    },
    emptyModuleText: {
        padding: 12,
        textAlign: 'center',
        color: '#999',
        fontSize: 12,
    },
});
