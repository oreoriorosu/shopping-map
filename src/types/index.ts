export interface MapFile {
  id: string;
  name: string;
  blob: Blob;
  createdAt: Date;
}

export interface Spot {
  id: string;
  mapId: string;
  name: string;
  color: string;
  pin: { x: number; y: number; page: number };
  hallName?: string;
  location?: string;
  priority?: 'A' | 'B' | 'C' | 'D';
  oshi?: string;
  genre?: string;
  image?: Blob;
  visitOrder?: number;
  checked?: boolean;
}

export interface ShoppingItem {
  id: string;
  spotId: string;
  name: string;
  memo: string;
  checked: boolean;
  soldOut: boolean;
  price?: number;
  order: number;
}
