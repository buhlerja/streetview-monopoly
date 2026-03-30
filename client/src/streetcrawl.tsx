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
export type Player = {
    id: string;
    colour: string;
    name: string;
};

export default function Streetcrawl({ gameCode, socket, onExit }: StreetcrawlProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    //const [allPaths, setAllPaths] = useState<Record<string, google.maps.LatLngLiteral[]>>({});
    const [allPaths, setAllPaths] = useState<{
        paths: Record<string, google.maps.LatLngLiteral[]>;
        players: Player[];
    }>({
        paths: {},
        players: []
    });
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [currentPlayer, setCurrentPlayer] = useState<string | null>(null);
    const [hasMoved, setHasMoved] = useState(false);

    const mapRef = useRef<google.maps.Map | null>(null);
    const markerRef = useRef<google.maps.Marker | null>(null);
    const playersMarkersRef = useRef<Record<string, google.maps.Circle>>({});
    const initializedRef = useRef(false);

    // State to store the path a user takes in Street View
    const streetViewPath = useRef<google.maps.LatLngLiteral[]>([]);

    const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);

    const enterStreetView = async (): Promise<void> => {
        if (!isMyTurn) return;// only allow entering Street View on your turn
        if (hasMoved) return;//alredy moved in Street View this turn, prevent re-entry until next turn

        const map = mapRef.current;
        const marker = markerRef.current;

        const googleAvailable = typeof window !== "undefined" && !!(window as any).google?.maps;

        if (!map || !marker || !googleAvailable) {
            console.error("Missing refs:", { map, marker, googleAvailable });
            return;
        }

        // Helper function to find and enter a valid Street View location
        const findAndEnterValidStreetView = async (attempts = 0): Promise<void> => {
            if (attempts > 20) {
                console.error("Failed to find valid Street View after 20 attempts");
                alert("Unable to generate a valid random Street View location. Please try again.");
                return;
            }

            let position = (mapRef as any).lastStreetViewPosition || marker.getPosition();

            if (!position) {
                console.error("No position found");
                return;
            }

            const panorama = map.getStreetView();
            panorama.setPosition(position);
            panorama.setVisible(true);

            // Check if Street View is actually available at this location (and is Google Street View, not user-contributed)
            const streetViewService = new window.google.maps.StreetViewService();
            streetViewService.getPanorama(
                { location: position, radius: 100 },
                async (data, status) => {
                    if (status !== window.google.maps.StreetViewStatus.OK || !data) {
                        console.warn(`No Street View available at ${position.lat}, ${position.lng}, trying new location...`);
                        panorama.setVisible(false);

                        // Generate a new random location and retry
                        const swBounds = { lat: 43.658749, lng: -79.396114 };
                        const neBounds = { lat: 43.667612, lng: -79.394050 };
                        const newLocation = await (window as any).__getRandomLocationWithinBounds?.(swBounds, neBounds) || {
                            lat: 43.658749 + Math.random() * (43.667612 - 43.658749),
                            lng: -79.396114 + Math.random() * (-79.394050 - (-79.396114))
                        };
                        marker.setPosition(newLocation);
                        await findAndEnterValidStreetView(attempts + 1);
                        return;
                    }

                    // Check if it's Google Street View (not user-contributed)
                    const copyright = data.copyright || "";
                    const isGoogleStreetView = typeof copyright === "string"
                        ? copyright.toLowerCase().includes("google")
                        : Array.isArray(copyright)
                            ? copyright.some((text: string) => text.toLowerCase().includes("google"))
                            : false;

                    if (!isGoogleStreetView) {
                        console.warn("Location has user-contributed panorama, trying new location...");
                        panorama.setVisible(false);

                        // Generate a new random location and retry
                        const swBounds = { lat: 43.658749, lng: -79.396114 };
                        const neBounds = { lat: 43.667612, lng: -79.394050 };
                        const newLocation = await (window as any).__getRandomLocationWithinBounds?.(swBounds, neBounds) || {
                            lat: 43.658749 + Math.random() * (43.667612 - 43.658749),
                            lng: -79.396114 + Math.random() * (-79.394050 - (-79.396114))
                        };
                        marker.setPosition(newLocation);
                        await findAndEnterValidStreetView(attempts + 1);
                        return;
                    }

                    // Success! We found a valid Google Street View location
                    // Add position_changed listener to track movement
                    let isFirstPositionChange = true;
                    panorama.addListener("position_changed", () => {
                        // Skip the first position change (initial load)
                        if (isFirstPositionChange) {
                            isFirstPositionChange = false;
                            return;
                        }

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
                }
            );
        };

        await findAndEnterValidStreetView();
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
        /*if (streetViewPath.current.length > 0) {
            // Commented out so that we can draw the path sent from the server.
            // Rather than just our local path, we want to draw everyone's path in real time as they move in street view.
            // new google.maps.Polyline({
            //         map,
            //         path: streetViewPath.current,
            //         strokeColor: "#FF0000",
            //         strokeOpacity: 0.8,
            //         strokeWeight: 4,
            //     });

        }*/
    }

    const handleEndTurn = () => {
        if (!socket) return;

        socket.emit("endTurn", gameCode, (success: boolean, message?: string) => {
            if (!success) {
                alert(message || "Failed to end turn");
            }
        });
    };

    // Use effect for drawing path updates from the server
    // Since we never clear previous polylines performance might degrade. Want to look into a more efficient way
    useEffect(() => {
        if (!mapRef.current) return;

        // Iterate over each player
        allPaths.players.forEach(player => {
            const path = allPaths.paths[player.id]; // use player.id to get path
            if (path && path.length > 0) {
                new google.maps.Polyline({
                    map: mapRef.current!,
                    path,
                    strokeWeight: 3,
                    strokeColor: player.colour // color comes directly from player
                });
            }
        });
    }, [allPaths]);

    // Use effect for updating other players' markers
    useEffect(() => {
        if (!mapRef.current) return;

        const currentPlayerId = (window as any).__socketId || socket?.id;

        // Update or create circles for all players
        allPaths.players.forEach(player => {
            // Skip the current player (they have their own marker)
            if (player.id === currentPlayerId) return;

            const path = allPaths.paths[player.id];
            if (!path || path.length === 0) return;

            // Get the last position in the path
            const lastPosition = path[path.length - 1];

            // Create or update circle for this player
            if (playersMarkersRef.current[player.id]) {
                // Update existing circle position
                playersMarkersRef.current[player.id].setCenter(lastPosition);
            } else {
                // Create new circle for this player
                const circle = new google.maps.Circle({
                    center: lastPosition,
                    radius: 10,
                    map: mapRef.current,
                    fillColor: player.colour,
                    fillOpacity: 0.8,
                    strokeColor: player.colour,
                    strokeWeight: 2,
                    title: player.name
                });
                playersMarkersRef.current[player.id] = circle;
            }
        });

        // Clean up circles for players that are no longer in the game
        Object.keys(playersMarkersRef.current).forEach(playerId => {
            if (!allPaths.players.find(p => p.id === playerId)) {
                playersMarkersRef.current[playerId].setMap(null);
                delete playersMarkersRef.current[playerId];
            }
        });
    }, [allPaths, socket?.id]);

    // Use effect to listen for global path updates from the server
    useEffect(() => {
        if (!socket) return;

        // Store socket ID globally for reference
        (window as any).__socketId = socket.id;

        //socket.emit("joinGame", gameCode); // When component mounts, join the specific game room for path updates
        // Already joined the room in App.tsx, so no need to join again here. Just need to listen for updates.
        socket.on("gamePathsUpdate", ({ paths, players }: { paths: GamePaths; players: Player[] }) => {
            setAllPaths({ paths, players });
        });

        return () => {
            socket.emit("leaveGameRoom", gameCode);
            socket.off("gamePathsUpdate");
        };
    }, [socket, gameCode]);

    useEffect(() => {
        if (!socket) return;
        socket.on("gameState", ({ currentPlayerId }) => {
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


        // Helper function to generate random location within bounds
        const getRandomLocationWithinBounds = (
            swBounds: { lat: number; lng: number },
            neBounds: { lat: number; lng: number }
        ) => {
            const randomLat = swBounds.lat + Math.random() * (neBounds.lat - swBounds.lat);
            const randomLng = swBounds.lng + Math.random() * (neBounds.lng - swBounds.lng);
            return { lat: randomLat, lng: randomLng };
        };

        // Helper function to check if a location has Street View coverage
        const hasStreetViewCoverage = (
            position: { lat: number; lng: number }
        ): Promise<boolean> => {
            return new Promise((resolve) => {
                const streetViewService = new window.google.maps.StreetViewService();
                streetViewService.getPanorama(
                    { location: position, radius: 100 },
                    (data, status) => {
                        // For startup, just check if ANY Street View exists (we'll validate quality when entering)
                        const hasCoverage = status === window.google.maps.StreetViewStatus.OK && !!data;
                        resolve(hasCoverage);
                    }
                );
            });
        };

        // Helper function to find a random location with Street View coverage
        const getRandomLocationWithStreetView = async (
            swBounds: { lat: number; lng: number },
            neBounds: { lat: number; lng: number },
            maxAttempts: number = 30
        ): Promise<{ lat: number; lng: number }> => {
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const randomLocation = getRandomLocationWithinBounds(swBounds, neBounds);
                const hasStreetView = await hasStreetViewCoverage(randomLocation);
                if (hasStreetView) {
                    return randomLocation;
                }
            }
            // Fallback to a known Street View location if all attempts fail
            // return { lat: 43.6706, lng: -79.3865 }; //Bloor and Yonge
            return { lat: 43.664655, lng: -79.395800 }; //Hoskin and Tower Rd
        };

        const initializeMap = async () => {
            if (initializedRef.current) return;
            if (!(window.google && window.google.maps)) return;

            initializedRef.current = true;

            const uoftCenter = { lat: 43.6629, lng: -79.3957 };
            const bloorAndYonge = { lat: 43.6706, lng: -79.3865 };

            // Define game play area bounds (downtown Toronto area)
            const swBounds = { lat: 43.658749, lng: -79.396114 }; // Southwest corner
            const neBounds = { lat: 43.667612, lng: -79.394050 }; // Northeast corner (Bloor Street as north border)

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

            // Generate random starting position with Street View coverage
            let randomStartPosition;
            try {
                randomStartPosition = await getRandomLocationWithStreetView(swBounds, neBounds);
                console.log("Generated starting position:", randomStartPosition);
            } catch (err) {
                console.error("Error generating random location, using fallback:", err);
                randomStartPosition = { lat: 43.664655, lng: -79.395800 }; // Hoskin and Tower Rd
            }

            const marker = new window.google.maps.Marker({
                position: randomStartPosition,
                map,
                title: "Your Starting Position",
            });
            console.log("Marker created at", randomStartPosition);

            // Load persisted session if present
            const session = loadSession();
            if (session) {
                if (session.center) map.setCenter(session.center);
                if (session.zoom) map.setZoom(session.zoom);
                // if (session.markerPosition) marker.setPosition(session.markerPosition);
                if (session.streetViewPath) streetViewPath.current = session.streetViewPath;

                // Store last position so we can use it when entering Street View
                if (session.streetViewPosition) {
                    (mapRef as any).lastStreetViewPosition = session.streetViewPosition;
                }
            } else {
                // No session found, center map on the random starting position
                map.setCenter(randomStartPosition);
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
            script.onload = () => initializeMap().catch(err => console.error("Failed to initialize map:", err));
            script.onerror = () => console.error("Failed to load Google Maps script");
            document.body.appendChild(script);
        } else if (window.google && window.google.maps) {
            initializeMap().catch(err => console.error("Failed to initialize map:", err));
        } else {
            existingScript.addEventListener("load", () => initializeMap().catch(err => console.error("Failed to initialize map:", err)));
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
            // Clean up other players' markers
            Object.values(playersMarkersRef.current).forEach(marker => {
                marker.setMap(null);
            });
            playersMarkersRef.current = {};
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
                        <p>Current Player: {currentPlayer ?? "-"}</p>
                        <p>{hasMoved ? "You've already moved in Street View this turn." : "You can enter Street View to move."}</p>
                        <button disabled={!isMyTurn || hasMoved}>Roll Dice</button>
                        <button>Buy Property</button>
                        <button type="button" onClick={handleExit}>Main Menu</button>
                        <button type="button" onClick={enterStreetView} disabled={!isMyTurn || hasMoved}>Enter Street View</button>
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
