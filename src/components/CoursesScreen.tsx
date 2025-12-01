import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { coursesScreenStyles as styles } from '../styles/CoursesScreen.styles';

interface Course {
    id: string;
    title: string;
    description: string;
    instructor: string;
    level: string;
}

interface CourseCategory {
    title: string;
    courses: Course[];
}

export function CoursesScreen({ onNavigate }: { onNavigate: (screen: 'chats' | 'courses') => void }) {
    const categories: CourseCategory[] = [
        {
            title: 'Desarrollo web',
            courses: [
                {
                    id: '1',
                    title: 'Introducción a la programación',
                    description: 'Aprende la lógica básica de programación iniciando con C++',
                    instructor: 'Profesor Fabian Guerrero',
                    level: 'Nivel Básico',
                },
                {
                    id: '2',
                    title: 'Hola Mundo con C++',
                    description: 'Realiza tu primera interacción programando un ¡Hola Mundo!',
                    instructor: 'Profesor Fabian Guerrero',
                    level: 'Nivel Básico',
                },
                {
                    id: '3',
                    title: 'Programa tu propia Calculadora',
                    description: 'Realiza tu primera interacción programando un ¡Hola Mundo!',
                    instructor: 'Profesor Fabian Guerrero',
                    level: 'Nivel Básico',
                },
            ],
        },
        {
            title: 'Administración de empresas',
            courses: [
                {
                    id: '4',
                    title: 'Introducción a la administración',
                    description: 'Aprende qué es la administración, cómo funcionan las empresas y qué hace un administrador.',
                    instructor: 'Profesor Israel Ramirez',
                    level: 'Nivel Básico',
                },
                {
                    id: '5',
                    title: 'Finanzas básicas',
                    description: 'Aprende Finanzas personales y empresariales, cómo llevar un presupuesto para tu negocio.',
                    instructor: 'Profesor Israel Ramirez',
                    level: 'Nivel Básico',
                },
                {
                    id: '6',
                    title: 'Emprendimiento',
                    description: 'Aprende cómo crear una idea de negocio, validación de ideas y primeros pasos.',
                    instructor: 'Profesor Israel Ramirez',
                    level: 'Nivel Básico',
                },
            ],
        },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => onNavigate('chats')}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Cursos</Text>
                <TouchableOpacity style={styles.notificationButton}>
                    <Text style={styles.notificationIcon}>🔔</Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                {categories.map((category, index) => (
                    <View key={index}>
                        <Text style={styles.sectionTitle}>{category.title}</Text>
                        {category.courses.map((course) => (
                            <TouchableOpacity key={course.id} style={styles.courseCard}>
                                <View style={styles.courseIconContainer} />
                                <View style={styles.courseInfo}>
                                    <Text style={styles.courseTitle}>{course.title}</Text>
                                    <Text style={styles.courseDescription} numberOfLines={2}>
                                        {course.description}
                                    </Text>
                                    <View style={styles.tagsContainer}>
                                        <View style={styles.tag}>
                                            <Text style={styles.tagText}>{course.instructor}</Text>
                                        </View>
                                        <View style={styles.tag}>
                                            <Text style={styles.tagText}>{course.level}</Text>
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                ))}
            </ScrollView>

            {/* Bottom Navigation */}
            <View style={styles.bottomNav}>
                <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('chats')}>
                    <Text style={styles.navIcon}>💬</Text>
                    <Text style={styles.navLabel}>Chats</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.navItem, styles.navItemActive]} onPress={() => onNavigate('courses')}>
                    <Text style={styles.navIcon}>📚</Text>
                    <Text style={[styles.navLabel, styles.navLabelActive]}>Cursos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem}>
                    <Text style={styles.navIcon}>💡</Text>
                    <Text style={styles.navLabel}>SOS</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem}>
                    <Text style={styles.navIcon}>👤</Text>
                    <Text style={styles.navLabel}>Perfil</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem}>
                    <Text style={styles.navIcon}>🤝</Text>
                    <Text style={styles.navLabel}>Más</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
