export type Session = {
    center?: google.maps.LatLngLiteral;
    zoom?: number;
    markerPosition?: google.maps.LatLngLiteral;
    streetViewPath?: google.maps.LatLngLiteral[];
    streetViewPosition?: google.maps.LatLngLiteral;
};

const KEY = "svm_session";

export function saveSession(session: Session) {
    try {
        localStorage.setItem(KEY, JSON.stringify(session));
    } catch { }
}

export function loadSession(): Session | null {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) as Session : null;
    } catch {
        return null;
    }
}

export function clearSession() {
    localStorage.removeItem(KEY);
}

export async function saveGameProgress(gameData: GameState) {
    try {
        await fetch("/api/game/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(gameData),
        });
    } catch (err) {
        console.error("Failed to save to server", err);
    }
}

export async function loadGameProgress(): Promise<GameState | null> {
    try {
        const res = await fetch("/api/game/load");
        return res.ok ? res.json() : null;
    } catch {
        return null;
    }
}