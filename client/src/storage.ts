export type Session = {
    center?: google.maps.LatLngLiteral;
    zoom?: number;
    markerPosition?: google.maps.LatLngLiteral;
    streetViewPath?: google.maps.LatLngLiteral[];
    streetViewPosition?: google.maps.LatLngLiteral;
};

const KEY = "svm_session";

//Save session for refresh
export function saveSession(session: Session) {
    try {
        sessionStorage.setItem(KEY, JSON.stringify(session));
    } catch { }
}

export function loadSession(): Session | null {
    try {
        const raw = sessionStorage.getItem(KEY);
        return raw ? JSON.parse(raw) as Session : null;
    } catch {
        return null;
    }
}

export function clearSession() {
    sessionStorage.removeItem(KEY);
}