import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Image, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { contentService, Course } from '../services/content.service';

interface CoursePlayerScreenProps {
    courseId: string;
    onBack: () => void;
}

export function CoursePlayerScreen({ courseId, onBack }: CoursePlayerScreenProps) {
    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeLesson, setActiveLesson] = useState<any | null>(null);
    const [expandedModules, setExpandedModules] = useState<string[]>([]);

    // Video ref
    const videoRef = useRef<Video>(null);

    useEffect(() => {
        fetchCourse();
    }, [courseId]);

    const fetchCourse = async () => {
        try {
            setLoading(true);
            const data = await contentService.getCourseById(courseId);
            setCourse(data);

            // Auto-select first lesson
            if (data.modules && data.modules.length > 0) {
                setExpandedModules([data.modules[0].id]);
                if (data.modules[0].lessons && data.modules[0].lessons.length > 0) {
                    setActiveLesson(data.modules[0].lessons[0]);
                }
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

    const handleLessonSelect = (lesson: any) => {
        setActiveLesson(lesson);
        // Optional: auto play logic
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

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar style="light" />

            {/* Video Player Section */}
            <View style={styles.videoContainer}>
                {/* Header Overlay */}
                <View style={styles.headerOverlay}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                </View>

                {activeLesson?.videoUrl ? (
                    <Video
                        ref={videoRef}
                        style={styles.video}
                        source={{
                            uri: activeLesson.videoUrl,
                        }}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        isLooping={false}
                        posterSource={course.thumbnailUrl ? { uri: course.thumbnailUrl } : undefined}
                    />
                ) : (
                    <View style={styles.noVideoContainer}>
                        {course.thumbnailUrl && (
                            <Image source={{ uri: course.thumbnailUrl }} style={styles.videoPlaceholderImage} />
                        )}
                        <View style={styles.lockOverlay}>
                            <Text style={styles.lockText}>
                                {activeLesson ? 'Video no disponible' : 'Selecciona una lección'}
                            </Text>
                        </View>
                    </View>
                )}
            </View>

            {/* Content List */}
            <ScrollView style={styles.contentList}>
                <View style={styles.courseInfo}>
                    <Text style={styles.courseTitle}>{course.title}</Text>
                    {activeLesson && (
                        <Text style={styles.lessonTitle}>
                            Estás viendo: {activeLesson.title}
                        </Text>
                    )}
                </View>

                <View style={styles.playlistContainer}>
                    <Text style={styles.playlistHeader}>Contenido del Curso</Text>

                    {course.modules?.map((module: any) => (
                        <View key={module.id} style={styles.moduleCard}>
                            <TouchableOpacity
                                style={styles.moduleHeader}
                                onPress={() => toggleModule(module.id)}
                            >
                                <Text style={styles.moduleTitle}>{module.title}</Text>
                                <Text>{expandedModules.includes(module.id) ? '▲' : '▼'}</Text>
                            </TouchableOpacity>

                            {expandedModules.includes(module.id) && (
                                <View style={styles.lessonsContainer}>
                                    {module.lessons?.map((lesson: any) => (
                                        <TouchableOpacity
                                            key={lesson.id}
                                            style={[
                                                styles.lessonItem,
                                                activeLesson?.id === lesson.id && styles.activeLessonItem
                                            ]}
                                            onPress={() => handleLessonSelect(lesson)}
                                        >
                                            <Text style={styles.playIcon}>
                                                {activeLesson?.id === lesson.id ? '▶' : '•'}
                                            </Text>
                                            <Text style={[
                                                styles.lessonText,
                                                activeLesson?.id === lesson.id && styles.activeLessonText
                                            ]}>
                                                {lesson.title}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                    {(!module.lessons || module.lessons.length === 0) && (
                                        <Text style={styles.emptyModuleText}>Sin lecciones</Text>
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
        marginTop: -10, // Overlap slightly
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
