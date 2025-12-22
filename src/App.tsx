import { useState, useEffect } from 'react';
import './App.css';
import Classic from "./classic.tsx";
import Streetcrawl from "./streetcrawl.tsx";

export default function App() {
  const [screen, setScreen] = useState("menu");

  if (screen === "classic") {
    return <Classic onExit={() => setScreen("menu")} />;
  }
  else if(screen === "streetcrawl") {
    return <Streetcrawl onExit={() => setScreen("menu")} />;
  }

  return (
    <div className="menu-screen">
      <h1>StreetView Monopoly</h1>

      <div className="menu-buttons">
        <button onClick={() => setScreen("classic")}>
          Classic
        </button>

        <button onClick={() => setScreen("streetcrawl")}>
          StreetView Race
        </button>

        <button disabled>
          Multiplayer (Coming Soon)
        </button>
      </div>
    </div>
  );
}
