import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { contentService, Course } from '../services/content.service';

const COURSES_CACHE_KEY = 'tincadia_courses_cache';
const COURSES_SYNC_KEY = 'tincadia_courses_last_sync';

export function useCourses() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const isSyncingRef = useRef(false);

    const loadLocalCourses = useCallback(async () => {
        try {
            const cached = await AsyncStorage.getItem(COURSES_CACHE_KEY);
            if (cached) {
                setCourses(JSON.parse(cached));
            }
        } catch (error) {
            console.error('Failed to load local courses:', error);
        }
    }, []);

    const syncCourses = useCallback(async () => {
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        setIsSyncing(true);

        try {
            const lastSync = await AsyncStorage.getItem(COURSES_SYNC_KEY);
            const cachedParams = await AsyncStorage.getItem(COURSES_CACHE_KEY);
            let localCourses: Course[] = cachedParams ? JSON.parse(cachedParams) : [];

            console.log('📚 Syncing courses since:', lastSync || 'beginning');

            // Fetch updates
            const updates = await contentService.getAllCourses(lastSync || undefined);

            if (updates.length > 0) {
                console.log('📥 Received', updates.length, 'course updates');

                // Merge updates
                const courseMap = new Map(localCourses.map(c => [c.id, c]));

                updates.forEach(update => {
                    courseMap.set(update.id, update);
                });

                const mergedCourses = Array.from(courseMap.values());

                // Save to storage
                await AsyncStorage.setItem(COURSES_CACHE_KEY, JSON.stringify(mergedCourses));
                await AsyncStorage.setItem(COURSES_SYNC_KEY, new Date().toISOString());

                setCourses(mergedCourses);
            } else if (localCourses.length === 0) {
                // If we have no local data but updates was empty (shouldn't happen if no lastSync, but just in case)
                // Actually if lastSync is null, updates returns all.
                // So if updates is empty and we have no local, then there are no courses.
                setCourses([]);
            } else {
                setCourses(localCourses);
            }

        } catch (error) {
            console.error('Error syncing courses:', error);
        } finally {
            setIsSyncing(false);
            isSyncingRef.current = false;
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLocalCourses().then(() => {
            syncCourses();
        });
    }, [loadLocalCourses, syncCourses]);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            // Force full re-sync by clearing last sync time
            await AsyncStorage.removeItem(COURSES_SYNC_KEY);
            await syncCourses();
        } catch (error) {
            console.error('Refresh failed:', error);
        } finally {
            setIsLoading(false);
        }
    }, [syncCourses]);

    return {
        courses,
        isLoading,
        isSyncing,
        refresh
    };
}
