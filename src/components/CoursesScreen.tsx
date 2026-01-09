import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Image, FlatList, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { coursesScreenStyles as styles } from '../styles/CoursesScreen.styles';
import { BottomNavigation } from './BottomNavigation';
import { NotificationBell } from './NotificationBell';
import { SearchIcon } from './icons/NavigationIcons';
import { contentService, Course } from '../services/content.service';
import { useCourses } from '../hooks/useCourses';

interface CourseCategory {
    title: string;
    courses: Course[];
}

interface CoursesScreenProps {
    onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile') => void;
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
    const [categories, setCategories] = useState<CourseCategory[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const { courses, isLoading, isSyncing, refresh } = useCourses();
    const [refreshing, setRefreshing] = useState(false);

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



    const renderCourseCard = ({ item: course }: { item: Course }) => (
        <TouchableOpacity
            style={styles.cardContainer}
            onPress={() => onCourseSelect?.(course.id)}
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
                <View style={styles.playOverlay}>
                    <View style={styles.playButton}>
                        <Text style={{ fontSize: 16, marginLeft: 2 }}>▶</Text>
                    </View>
                </View>
            </View>

            <View style={styles.cardContent}>
                <View>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                        {course.title}
                    </Text>
                    <Text style={styles.cardInstructor}>
                        {course.instructor || 'Tincadia'}
                    </Text>
                </View>

                <View style={styles.cardFooter}>
                    <Text style={styles.moduleIcon}>📖</Text>
                    <Text style={styles.moduleText}>
                        {course.modules?.length || 0} Módulos
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>Cursos</Text>
                    {userId && onShowNotifications ? (
                        <NotificationBell
                            userId={userId}
                            onPress={onShowNotifications}
                            color="#333333"
                        />
                    ) : (
                        <View style={styles.notificationButton} />
                    )}
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <SearchIcon size={20} color="#666666" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar cursos"
                        value={searchQuery}
                        onChangeText={handleSearch}
                        placeholderTextColor="#666666"
                    />
                </View>
            </View>

            {/* Content */}
            {isLoading ? (
                <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text style={{ marginTop: 10, color: '#666' }}>Cargando cursos...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
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
                                    <Text style={styles.sectionTitle}>{category.title}</Text>
                                    <View style={styles.courseCountBadge}>
                                        <Text style={styles.courseCountText}>{category.courses.length}</Text>
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
        </SafeAreaView>
    );
}
