import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Image, FlatList, TextInput, Alert } from 'react-native';
import { KeyboardSafeView } from './common/KeyboardSafeView';
import { StatusBar } from 'expo-status-bar';
import { coursesScreenStyles as styles } from '../styles/CoursesScreen.styles';
import { BottomNavigation } from './BottomNavigation';
import { NotificationBell } from './NotificationBell';
import { SearchIcon } from './icons/NavigationIcons';
import { contentService, Course } from '../services/content.service';
import { paymentsService } from '../services/payments.service';
import { useCourses } from '../hooks/useCourses';
import { useTheme } from '../contexts/ThemeContext';
import { NavigateFunction } from '../types/navigation.types';

interface CourseCategory {
    title: string;
    courses: Course[];
}

interface CoursesScreenProps {
    onNavigate: NavigateFunction;
    onBack: () => void;
    userId?: string;
    onShowNotifications?: () => void;
    onCourseSelect?: (courseId: string) => void;
}

export function CoursesScreen({
    onNavigate,
    onBack,
    userId,
    onShowNotifications,
    onCourseSelect,
}: CoursesScreenProps) {
    const { colors, isDark } = useTheme();
    const [categories, setCategories] = useState<CourseCategory[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const { courses, isLoading, isSyncing, refresh } = useCourses();
    const [refreshing, setRefreshing] = useState(false);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    // Filter courses based on search query
    const filteredCourses = useMemo(() => {
        if (!searchQuery.trim()) return courses;
        const query = searchQuery.toLowerCase();
        return courses.filter(course =>
            course.title.toLowerCase().includes(query) ||
            (course.instructor && course.instructor.toLowerCase().includes(query))
        );
    }, [courses, searchQuery]);

    useEffect(() => {
        // Group by category
        const groups: Record<string, Course[]> = {};
        filteredCourses.forEach((course: Course) => {
            const catName = course.category?.name || 'Otros';
            if (!groups[catName]) groups[catName] = [];
            groups[catName].push(course);
        });

        // Transform to array
        const result = Object.entries(groups).map(([title, courses]) => ({
            title,
            courses
        }));

        setCategories(result);
    }, [filteredCourses]);

    const handleSearch = (text: string) => {
        setSearchQuery(text);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
    };

    const handleCoursePress = async (course: Course) => {
        if (loadingId) return;
        // Always navigate to presentation first (User Request)
        onNavigate('course_presentation', { courseId: course.id });
    };

    const renderCourseCard = ({ item: course }: { item: Course }) => (
        <TouchableOpacity
            style={[styles.cardContainer, { backgroundColor: colors.card }]}
            onPress={() => handleCoursePress(course)}
            disabled={!!loadingId}
        >
            <View style={styles.cardImageContainer}>
                {course.thumbnailUrl ? (
                    <Image source={{ uri: course.thumbnailUrl }} style={styles.cardImage} />
                ) : (
                    <View style={[styles.cardImage, { backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ fontSize: 40 }}>📚</Text>
                    </View>
                )}
                {/* Play Overlay */}
                <View style={[styles.playOverlay, loadingId === course.id && { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                    {loadingId === course.id ? (
                        <ActivityIndicator color="#fff" size="large" />
                    ) : (
                        <View style={styles.playButton}>
                            <Text style={{ fontSize: 16, marginLeft: 2 }}>▶</Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={styles.cardContent}>
                <View>
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                        {course.title}
                    </Text>
                    <Text style={[styles.cardInstructor, { color: colors.textSecondary }]}>
                        {course.instructor || 'Tincadia'}
                    </Text>
                </View>

                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                    <Text style={styles.moduleIcon}>📖</Text>
                    <Text style={[styles.moduleText, { color: colors.textSecondary }]}>
                        {course.modules?.length || 0} Módulos
                    </Text>
                    {course.isPaid && (
                        <Text style={{ marginLeft: 'auto', fontSize: 12, color: '#f59e0b', fontWeight: 'bold' }}>Premium</Text>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <KeyboardSafeView style={[styles.container, { backgroundColor: colors.background }]} dismissOnPress={false}>
            <StatusBar style={colors.statusBar} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.background }]}>
                <View style={styles.headerTop}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Cursos</Text>
                    {userId && onShowNotifications ? (
                        <NotificationBell
                            userId={userId}
                            onPress={onShowNotifications}
                            color={colors.icon}
                        />
                    ) : (
                        <View style={[styles.notificationButton, { backgroundColor: colors.card }]} />
                    )}
                </View>

                {/* Search Bar */}
                <View style={[styles.searchContainer, { backgroundColor: colors.inputBg }]}>
                    <SearchIcon size={20} color={colors.iconSecondary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Buscar cursos"
                        value={searchQuery}
                        onChangeText={handleSearch}
                        placeholderTextColor={colors.textMuted}
                    />
                </View>
            </View>

            {/* Content */}
            {isLoading ? (
                <View style={[styles.content, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }]}>
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text style={{ marginTop: 10, color: colors.textSecondary }}>Cargando cursos...</Text>
                </View>
            ) : (
                <ScrollView
                    style={[styles.content, { backgroundColor: colors.background }]}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} progressBackgroundColor={colors.card} tintColor={colors.accent} />
                    }
                >
                    {categories.length === 0 ? (
                        <View style={{ padding: 20, alignItems: 'center', marginTop: 100 }}>
                            <Text style={{ color: '#666', fontSize: 16 }}>No hay cursos disponibles por el momento.</Text>
                        </View>
                    ) : (
                        categories.map((category, index) => (
                            <View key={index} style={styles.sectionContainer}>
                                <View style={styles.sectionHeader}>
                                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{category.title}</Text>
                                    <View style={[styles.courseCountBadge, { backgroundColor: colors.surface }]}>
                                        <Text style={[styles.courseCountText, { color: colors.textSecondary }]}>{category.courses.length}</Text>
                                    </View>
                                </View>
                                <FlatList
                                    data={category.courses}
                                    renderItem={renderCourseCard}
                                    keyExtractor={(item) => item.id}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.horizontalList}
                                />
                            </View>
                        ))
                    )}
                </ScrollView>
            )}

            <BottomNavigation currentScreen="courses" onNavigate={onNavigate} />
        </KeyboardSafeView>
    );
}
