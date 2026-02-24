const API_URL = "http://localhost:3001";

export type GameState = {
  turn: number;
  currentPlayer: string | null;
  players: Record<string, any>;
  properties: Record<string, any>;
};

export async function createNewGame(): Promise<{ gameCode: string; state: GameState }> {
  const response = await fetch(`${API_URL}/game`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  
  if (!response.ok) throw new Error("Failed to create game");
  return response.json();
}

export async function loadGameState(gameCode: string): Promise<GameState | null> {
  try {
    const response = await fetch(`${API_URL}/game/${gameCode}`);
    
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Failed to load game");
    
    const data = await response.json();
    return data.state;
  } catch (error) {
    console.error("Error loading game:", error);
    return null;
  }
}

export async function saveGameState(gameCode: string, state: GameState): Promise<void> {
  const response = await fetch(`${API_URL}/game/${gameCode}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state })
  });
  
  if (!response.ok) throw new Error("Failed to save game");
}
