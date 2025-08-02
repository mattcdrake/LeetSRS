export interface Card {
  id: string;
  slug: string;
  name: string;
  createdAt: Date;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Stats {
  // To be defined later
}

export interface Config {
  schemaVersion: string;
}
