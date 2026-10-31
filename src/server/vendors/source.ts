import 'server-only';
import { CityTier } from '@/domain/schemas/profile';

export interface Vendor {
  id: string;
  name: string;
  area?: string;
  mapsUrl: string;
  badge: 'sample' | 'google_maps';
  note?: string;
}

export interface VendorSearchQuery {
  categoryId: string;
  label: string;
  cityName?: string;
  cityTier?: CityTier;
}

export interface VendorSearchResult {
  source: 'sample' | 'places';
  vendors: Vendor[];
  mapsUrl: string;
}

export interface VendorSource {
  search(query: VendorSearchQuery): Promise<VendorSearchResult>;
}
