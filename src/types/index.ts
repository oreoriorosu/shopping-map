export interface MapFile {
  id: string;
  name: string;
  blob: Blob;
  createdAt: Date;
}

// マップ上のスポット（店舗・エリア）
export interface Spot {
  id: string;
  mapId: string;
  name: string;
  color: string;
  // PDF座標系: 0.0〜1.0の割合、page番号
  pin: { x: number; y: number; page: number };
}

export interface ShoppingItem {
  id: string;
  spotId: string;
  name: string;
  memo: string;
  checked: boolean;
  order: number;
}
