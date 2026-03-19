import { useState, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import "./App.css";
import { loadSession, saveSession } from "./storage";

type StreetcrawlProps = {
    gameCode: string;
    socket?: Socket | null;
    onExit?: () => void;
};

interface LatLngPoint {
    lat: number;
    lng: number;
}

export type GamePaths = Record<string, LatLngPoint[]>;

export default function Streetcrawl({ gameCode, socket, onExit }: StreetcrawlProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [allPaths, setAllPaths] = useState<Record<string, google.maps.LatLngLiteral[]>>({});
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [currentPlayer, setCurrentPlayer] = useState<string | null>(null);
    const [hasMoved, setHasMoved] = useState(false);

    const mapRef = useRef<google.maps.Map | null>(null);
    const markerRef = useRef<google.maps.Marker | null>(null);
    const initializedRef = useRef(false);

    // State to store the path a user takes in Street View
    const streetViewPath = useRef<google.maps.LatLngLiteral[]>([]);

    const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);

    const enterStreetView = (): void => {
        if (!isMyTurn) return;// only allow entering Street View on your turn
        if (hasMoved)  return;//alredy moved in Street View this turn, prevent re-entry until next turn

        const map = mapRef.current;
        const marker = markerRef.current;

        const googleAvailable = typeof window !== "undefined" && !!(window as any).google?.maps;

        if (!map || !marker || !googleAvailable) {
            console.error("Missing refs:", { map, marker, googleAvailable });
            return;
        }

        const position = (mapRef as any).lastStreetViewPosition || marker.getPosition();

        if (!position) {
            console.error("No position found");
            return;
        }

        const panorama = map.getStreetView();
        panorama.setPosition(position);
        panorama.setVisible(true);

        // Add position_changed listener to track movement
        panorama.addListener("position_changed", () => {
            const newPos = panorama.getPosition();
            if (newPos) {
                const latLng = { lat: newPos.lat(), lng: newPos.lng() };
                streetViewPath.current.push(latLng);

                // Store last position
                (mapRef as any).lastStreetViewPosition = latLng;

                if (hasMoved) return;// already moved, no need to emit again until next turn
                setHasMoved(true); // mark that we've moved at least once this turn

                // Emit position update to server so other players can see movement in real-time
                if (socket) {
                    socket.emit("updatePath", {
                        gameCode,
                        pathPoint: latLng,
                    });
                }

                const center = map.getCenter();
                saveSession({
                    center: center ? { lat: center.lat(), lng: center.lng() } : undefined,
                    zoom: map.getZoom() ?? undefined,
                    markerPosition: marker.getPosition()
                        ? { lat: marker.getPosition()!.lat(), lng: marker.getPosition()!.lng() }
                        : undefined,
                    streetViewPath: streetViewPath.current,
                    streetViewPosition: latLng,
                });
            }
        });
    };

    const handleExit = () => {
        onExit?.();
    };

    const handleStreetViewClose = () => {
        const map = mapRef.current;
        const marker = markerRef.current;
        if (!map || !marker) return;

        const panorama = map.getStreetView();

        // Save current position before hiding
        const currentPos = panorama.getPosition();
        if (currentPos) {
            const latLng = { lat: currentPos.lat(), lng: currentPos.lng() };
            (mapRef as any).lastStreetViewPosition = latLng;

            // Update marker to current Street View position
            marker.setPosition(latLng);
        }

        panorama.setVisible(false);

        // Draw the path on the map
        if (streetViewPath.current.length > 0) {
            // Commented out so that we can draw the path sent from the server.
            // Rather than just our local path, we want to draw everyone's path in real time as they move in street view.
            // new google.maps.Polyline({
            //         map,
            //         path: streetViewPath.current,
            //         strokeColor: "#FF0000",
            //         strokeOpacity: 0.8,
            //         strokeWeight: 4,
            //     });

        }
    }

    const handleEndTurn = () => {
        if (!socket) return;

        socket.emit("endTurn", gameCode,(success: boolean, message?: string) => {
            if (!success) {
                alert(message || "Failed to end turn");
            }
        });
    };

    // Use effect for drawing path updates from the server
    // Since we never clear previous polylines performance might degrade. Want to look into a more efficient way
    useEffect(() => {
        if (!mapRef.current) return;

        Object.entries(allPaths).forEach(([, path]) => {
            if (path.length > 0) {
                new google.maps.Polyline({
                    map: mapRef.current!,
                    path,
                    strokeWeight: 3
                });
            }
        });
    }, [allPaths]);

    // Use effect to listen for global path updates from the server
    useEffect(() => {
        if (!socket) return;

        //socket.emit("joinGame", gameCode); // When component mounts, join the specific game room for path updates
        // Already joined the room in App.tsx, so no need to join again here. Just need to listen for updates.
        socket.on("gamePathsUpdate", (paths: GamePaths) => {
            setAllPaths(paths);
        });

        return () => {
            socket.emit("leaveGameRoom", gameCode);
            socket.off("gamePathsUpdate");
        };
    }, [socket, gameCode]);

    useEffect(() => {
        if (!socket) return;
        socket.on("gameState", ({currentPlayerId}) => {
            setCurrentPlayer(currentPlayerId);
            const myTurn = currentPlayerId === socket.id;
            setIsMyTurn(myTurn);
            if (!myTurn) {
                setHasMoved(false); // reset move state when it's not your turn
            }
        });
        return () => {
            socket.off("gameState");
        };
    }, [socket]);


    useEffect(() => {
        const apiKey = import.meta.env.VITE_API_KEY;

        const existingScript = document.querySelector(
            'script[src*="maps.googleapis.com/maps/api/js"]'
        );


        const initializeMap = () => {
            if (initializedRef.current) return;
            if (!(window.google && window.google.maps)) return;

            initializedRef.current = true;

            const uoftCenter = { lat: 43.6629, lng: -79.3957 };
            //const bloorAndYonge = { lat: 43.6706, lng: -79.3865 };

            const mapElement = document.getElementById("map");

            if (!mapElement) {
                console.error("Map element not found");
                return;
            }

            const map = new window.google.maps.Map(mapElement, {
                center: uoftCenter,
                zoom: 16,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
            });

            // Initialize Street View panorama
            const panoramaElement = document.getElementById("panorama");
            if (panoramaElement) {
                panoramaRef.current = new window.google.maps.StreetViewPanorama(panoramaElement, {
                    position: uoftCenter,
                    visible: false,
                });
            }

            const marker = new window.google.maps.Marker({
                position: { lat: 43.6603, lng: -79.3839 },
                map,
                title: "Yonge and College",
            });

            // Load persisted session if present
            const session = loadSession();
            if (session) {
                if (session.center) map.setCenter(session.center);
                if (session.zoom) map.setZoom(session.zoom);
                if (session.markerPosition) marker.setPosition(session.markerPosition);
                if (session.streetViewPath) streetViewPath.current = session.streetViewPath;

                // Store last position so we can use it when entering Street View
                if (session.streetViewPosition) {
                    (mapRef as any).lastStreetViewPosition = session.streetViewPosition;
                }
            }

            // Persist helper
            const persist = () => {
                const center = map.getCenter();
                saveSession({
                    center: center ? { lat: center.lat(), lng: center.lng() } : undefined,
                    zoom: map.getZoom() ?? undefined,
                    markerPosition: marker.getPosition()
                        ? { lat: marker.getPosition()!.lat(), lng: marker.getPosition()!.lng() }
                        : undefined,
                    streetViewPath: streetViewPath.current.length ? streetViewPath.current : undefined,
                });
            };

            // Save on relevant events and on unload
            const centerListener = map.addListener("center_changed", () => persist());
            const zoomListener = map.addListener("zoom_changed", () => persist());

            window.addEventListener("beforeunload", persist);

            // store refs
            mapRef.current = map;
            markerRef.current = marker;

            // cleanup listeners when map is removed (handled in effect cleanup below)
            // keep references so cleanup can remove them if needed
            (mapRef.current as any).__svm_listeners = { centerListener, zoomListener };
        };

        if (!existingScript) {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
            script.async = true;
            script.onload = initializeMap;
            script.onerror = () => console.error("Failed to load Google Maps script");
            document.body.appendChild(script);
        } else if (window.google && window.google.maps) {
            initializeMap();
        } else {
            existingScript.addEventListener("load", initializeMap);
        }

        return () => {
            if (mapRef.current) {
                const pano = mapRef.current.getStreetView();
                pano.setVisible(false);
                window.google?.maps?.event?.clearInstanceListeners(pano);
                window.google?.maps?.event?.clearInstanceListeners(mapRef.current);

                // remove added listeners and persist final state
                const listeners = (mapRef.current as any).__svm_listeners;
                if (listeners) {
                    if (listeners.centerListener) listeners.centerListener.remove();
                    if (listeners.zoomListener) listeners.zoomListener.remove();
                }
            }
            if (markerRef.current) {
                window.google?.maps?.event?.clearInstanceListeners(markerRef.current);
            }
            // persist final session
            if (mapRef.current) {
                const center = mapRef.current.getCenter();
                saveSession({
                    center: center ? { lat: center.lat(), lng: center.lng() } : undefined,
                    zoom: mapRef.current.getZoom() ?? undefined,
                    markerPosition: markerRef.current && markerRef.current.getPosition()
                        ? { lat: markerRef.current!.getPosition()!.lat(), lng: markerRef.current!.getPosition()!.lng() }
                        : undefined,
                    streetViewPath: streetViewPath.current.length ? streetViewPath.current : undefined,
                });
            }

            window.removeEventListener("beforeunload", () => { });
            mapRef.current = null;
            markerRef.current = null;
        };
    }, []);

    return (
        <div className="app-container">
            <div className={`sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
                <button className="toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                    {sidebarOpen ? "Collapse" : "Expand"}
                </button>

                {sidebarOpen && (
                    <div className="sidebar-buttons">
                        <h2>Game Code: {gameCode}</h2>
                        <p>{isMyTurn ? "It's your turn!" : "Waiting for other players..."}</p>
                        <p>Current Player: {currentPlayer ??"-"}</p>
                        <p>{hasMoved ? "You've already moved in Street View this turn." : "You can enter Street View to move."}</p>
                        <button disabled={!isMyTurn || hasMoved}>Roll Dice</button>
                        <button>Buy Property</button>
                        <button type="button" onClick={handleExit}>Main Menu</button>
                        <button type="button" onClick={enterStreetView}disabled={!isMyTurn || hasMoved}>Enter Street View</button>
                        <button type="button" onClick={handleStreetViewClose}>Exit Street View</button>
                        <button type="button" onClick={handleEndTurn} disabled={!isMyTurn}>End Turn</button>
                    </div>
                )}
            </div>

            <div className="map-area">
                <div
                    id="map"
                    style={{ width: "100%", height: "100%" }}
                />
                <div
                    id="panorama"
                    style={{ width: "100%", height: "100%", display: "none" }}
                />
            </div>
        </div>
    );
}
