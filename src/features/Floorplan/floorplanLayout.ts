export interface RoomLayout {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

// Grid-based layout derived from the user's image.
// Coordinates are based on a virtual grid.
// Labels use a {{num}} placeholder for dynamic room numbering.
export const floorplanLayout: RoomLayout[] = [
  // Top Row
  { id: '75B', x: 0, y: 0, w: 1, h: 1, label: '{{num}}75-B' },
  { id: '75A', x: 0, y: 1, w: 1, h: 1, label: '{{num}}75-A' },
  { id: '76B', x: 1, y: 0, w: 1, h: 1, label: '{{num}}76-B' },
  { id: '76A', x: 1, y: 1, w: 1, h: 1, label: '{{num}}76-A' },

  { id: '77A', x: 3, y: 0, w: 1, h: 1, label: '{{num}}77-A' },
  { id: '78A', x: 4, y: 0, w: 1, h: 1, label: '{{num}}78-A' },
  { id: '79A', x: 5, y: 0, w: 1, h: 1, label: '{{num}}79-A' },
  { id: '80A', x: 6, y: 0, w: 1, h: 1, label: '{{num}}80-A' },

  { id: '81B', x: 8, y: 0, w: 1, h: 1, label: '{{num}}81-B' },
  { id: '81A', x: 8, y: 1, w: 1, h: 1, label: '{{num}}81-A' },
  { id: '82B', x: 9, y: 0, w: 1, h: 1, label: '{{num}}82-B' },
  { id: '82A', x: 9, y: 1, w: 1, h: 1, label: '{{num}}82-A' },

  { id: '83A', x: 11, y: 0, w: 1, h: 1, label: '{{num}}83-A' },
  { id: '50A', x: 12, y: 0, w: 1, h: 1, label: '{{num}}50-A' },

  { id: '51B', x: 14, y: 0, w: 1, h: 1, label: '{{num}}51-B' },
  { id: '51A', x: 14, y: 1, w: 1, h: 1, label: '{{num}}51-A' },
  { id: '52B', x: 15, y: 0, w: 1, h: 1, label: '{{num}}52-B' },
  { id: '52A', x: 15, y: 1, w: 1, h: 1, label: '{{num}}52-A' },

  { id: '53A', x: 17, y: 0, w: 1, h: 1, label: '{{num}}53-A' },
  { id: '54A', x: 18, y: 0, w: 1, h: 1, label: '{{num}}54-A' },
  { id: '55A', x: 19, y: 0, w: 1, h: 1, label: '{{num}}55-A' },
  { id: '56A', x: 20, y: 0, w: 1, h: 1, label: '{{num}}56-A' },

  { id: '57B', x: 22, y: 0, w: 1, h: 1, label: '{{num}}57-B' },
  { id: '57A', x: 22, y: 1, w: 1, h: 1, label: '{{num}}57-A' },
  { id: '58B', x: 23, y: 0, w: 1, h: 1, label: '{{num}}58-B' },
  { id: '58A', x: 23, y: 1, w: 1, h: 1, label: '{{num}}58-A' },

  // Bottom Row
  { id: '74A', x: 0, y: 4, w: 1, h: 1, label: '{{num}}74-A' },
  { id: '74B', x: 0, y: 5, w: 1, h: 1, label: '{{num}}74-B' },
  { id: '73A', x: 1, y: 4, w: 1, h: 1, label: '{{num}}73-A' },
  { id: '73B', x: 1, y: 5, w: 1, h: 1, label: '{{num}}73-B' },

  { id: '72A', x: 3, y: 5, w: 1, h: 1, label: '{{num}}72-A' },
  { id: '71A', x: 4, y: 5, w: 1, h: 1, label: '{{num}}71-A' },
  { id: '70A', x: 5, y: 5, w: 1, h: 1, label: '{{num}}70-A' },
  { id: '69A', x: 6, y: 5, w: 1, h: 1, label: '{{num}}69-A' },

  { id: '68A', x: 8, y: 4, w: 1, h: 1, label: '{{num}}68-A' },
  { id: '68B', x: 8, y: 5, w: 1, h: 1, label: '{{num}}68-B' },
  { id: '67A', x: 9, y: 4, w: 1, h: 1, label: '{{num}}67-A' },
  { id: '67B', x: 9, y: 5, w: 1, h: 1, label: '{{num}}67-B' },

  { id: '66A', x: 14, y: 4, w: 1, h: 1, label: '{{num}}66-A' },
  { id: '66B', x: 14, y: 5, w: 1, h: 1, label: '{{num}}66-B' },
  { id: '65A', x: 15, y: 4, w: 1, h: 1, label: '{{num}}65-A' },
  { id: '65B', x: 15, y: 5, w: 1, h: 1, label: '{{num}}65-B' },

  { id: '64A', x: 17, y: 5, w: 1, h: 1, label: '{{num}}64-A' },
  { id: '63A', x: 18, y: 5, w: 1, h: 1, label: '{{num}}63-A' },
  { id: '62A', x: 19, y: 5, w: 1, h: 1, label: '{{num}}62-A' },
  { id: '61A', x: 20, y: 5, w: 1, h: 1, label: '{{num}}61-A' },

  { id: '60A', x: 22, y: 4, w: 1, h: 1, label: '{{num}}60-A' },
  { id: '60B', x: 22, y: 5, w: 1, h: 1, label: '{{num}}60-B' },
  { id: '59A', x: 23, y: 4, w: 1, h: 1, label: '{{num}}59-A' },
  { id: '59B', x: 23, y: 5, w: 1, h: 1, label: '{{num}}59-B' },
];
