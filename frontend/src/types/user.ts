export interface UserPreferences {
    favoriteDriver?: string;
    team?: string;
    defaultTelemetryView?: string;
    savedQueries?: string[];
}

export interface UserProfile {
    authSubId: string;
    email: string;
    createdAt: { seconds: number; nanos: number } | string;
    preferences: UserPreferences;
}