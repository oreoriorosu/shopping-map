export interface MapFile {
  id: string;
  name: string;
  blob: Blob;
  fileType?: 'pdf' | 'image';
  createdAt: Date;
  order?: number;
}

export interface Genre {
  id: string;
  name: string;
  color: string;
}

export interface Spot {
  id: string;
  mapId: string;
  name: string;
  pin: { x: number; y: number; page: number };
  hallName?: string;
  location?: string;
  priority?: 'A' | 'B' | 'C' | 'D';
  oshi?: string;
  genreId?: string;
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
