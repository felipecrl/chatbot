export type PropertyTransaction = 'venda' | 'aluguel';

export interface PropertySearchFilters {
  transaction?: PropertyTransaction;
  type?: string;
  city?: string;
  neighborhood?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  minArea?: number;
}

export interface Property {
  code: string;
  type: string | null;
  transaction: PropertyTransaction;
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  price: number | null;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  amenities: string[];
  description: string;
  photos: string[];
}
