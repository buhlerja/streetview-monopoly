export type Player = {
  id: string;
  lat: number | null;
  lng: number | null;
};

export type Room = {
  players: Record<string, Player>;
};

export const rooms: Record<string, Room> = {};
