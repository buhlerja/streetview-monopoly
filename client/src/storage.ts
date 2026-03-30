export type Session = {
    center?: google.maps.LatLngLiteral;
    zoom?: number;
    markerPosition?: google.maps.LatLngLiteral;
    streetViewPath?: google.maps.LatLngLiteral[];
    streetViewPosition?: google.maps.LatLngLiteral;
};

const SESSION_KEY = "svm_session";
const GAME_CODE_KEY = "svm_lastGameCode";

// Save session (persists across browser sessions)
export function saveSession(session: Session) {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch { }
}

export function loadSession(): Session | null {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) as Session : null;
    } catch {
        return null;
    }
}

export function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

// Save game code for restoration
export function saveGameCode(gameCode: string) {
    try {
        localStorage.setItem(GAME_CODE_KEY, gameCode);
    } catch { }
}

export function loadGameCode(): string | null {
    try {
        return localStorage.getItem(GAME_CODE_KEY);
    } catch {
        return null;
    }
}

export function clearGameCode() {
    localStorage.removeItem(GAME_CODE_KEY);
}