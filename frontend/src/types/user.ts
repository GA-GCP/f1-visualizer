export interface UserPreferences {
    favoriteDriver?: string;
    team?: string;
    defaultTelemetryView?: string;
    savedQueries?: string[];
}

export interface UserProfile {
    oktaSubId: string;
    email: string;
    createdAt: string;
    preferences: UserPreferences;
}