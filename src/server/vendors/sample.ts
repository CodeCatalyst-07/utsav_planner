import 'server-only';
import { Vendor, VendorSearchQuery, VendorSearchResult, VendorSource } from './source';
import { buildGoogleMapsSearchUrl } from './mapsLinks';

const SAMPLE_NOTE =
  'Sample listing, not a real business. Use the Google Maps link to find real vendors.';

interface CityCategoryData {
  caterer: Array<{ name: string; area: string }>;
  decorator: Array<{ name: string; area: string }>;
  photographer: Array<{ name: string; area: string }>;
  venue: Array<{ name: string; area: string }>;
  entertainment: Array<{ name: string; area: string }>;
  pandit: Array<{ name: string; area: string }>;
}

const cityData: Record<string, Partial<CityCategoryData>> = {
  pune: {
    venue: [
      { name: 'Sample Heritage Lawns Pune A', area: 'Koregaon Park' },
      { name: 'Sample Banquets Pune B', area: 'Baner' },
      { name: 'Sample Royal Courtyard Pune C', area: 'Kalyani Nagar' },
    ],
    caterer: [
      { name: 'Sample Maharashtrian Caterer A', area: 'Sadashiv Peth' },
      { name: 'Sample Royal Feast Caterer B', area: 'Kothrud' },
      { name: 'Sample Gourmet Kitchens C', area: 'Viman Nagar' },
    ],
    decorator: [
      { name: 'Sample Marigold Mandap Decorators A', area: 'Aundh' },
      { name: 'Sample Floral Creations Pune B', area: 'Shivajinagar' },
      { name: 'Sample Ambient Lights Decor C', area: 'Wakad' },
    ],
    photographer: [
      { name: 'Sample Candid Moments Pune A', area: 'Camp' },
      { name: 'Sample Heritage Cinematography B', area: 'Deccan' },
      { name: 'Sample Studio Visuals Pune C', area: 'Magarpatta' },
    ],
    entertainment: [
      { name: 'Sample Pune Dhol Tasha Troupe A', area: 'Swargate' },
      { name: 'Sample Live Acoustic Ensemble B', area: 'FC Road' },
      { name: 'Sample Pune DJ & Sound Pro C', area: 'Kharadi' },
    ],
    pandit: [
      { name: 'Sample Vedic Purohit Sangh Pune A', area: 'Narayan Peth' },
      { name: 'Sample Panchang Vidhi Kendra B', area: 'Parvati' },
      { name: 'Sample Guruji Seva Samiti C', area: 'Sinhagad Road' },
    ],
  },
  mumbai: {
    venue: [
      { name: 'Sample Sea Breeze Banquets Mumbai A', area: 'Juhu' },
      { name: 'Sample Grand Palace Mumbai B', area: 'Bandra' },
      { name: 'Sample Heritage Hall Mumbai C', area: 'Dadar' },
    ],
    caterer: [
      { name: 'Sample Coastal Spice Caterers A', area: 'Prabhadevi' },
      { name: 'Sample Bombay Banquet Kitchen B', area: 'Andheri West' },
      { name: 'Sample Pure Jain Feast Caterer C', area: 'Ghatkopar' },
    ],
    decorator: [
      { name: 'Sample Glamour Floral Studio A', area: 'Santacruz' },
      { name: 'Sample Bollywood Set Decorators B', area: 'Goregaon' },
      { name: 'Sample Traditional Mandap Works C', area: 'Vile Parle' },
    ],
    photographer: [
      { name: 'Sample Marine Drive Studios A', area: 'Colaba' },
      { name: 'Sample Cinematic Frames Mumbai B', area: 'Powai' },
      { name: 'Sample Wedding Reel Artists C', area: 'Chembur' },
    ],
  },
  indore: {
    venue: [
      { name: 'Sample Malwa Heritage Gardens A', area: 'Vijay Nagar' },
      { name: 'Sample Indore Palace Banquets B', area: 'AB Road' },
      { name: 'Sample Society Club Grounds C', area: 'Palasia' },
    ],
    caterer: [
      { name: 'Sample Sarafa Flavour Caterers A', area: 'Chhappan Dukan' },
      { name: 'Sample Royal Malwa Feast B', area: 'Rau' },
      { name: 'Sample Indore Snack Master Caterer C', area: 'Rajwada' },
    ],
    decorator: [
      { name: 'Sample Balloon Fiesta Indore A', area: 'Geeta Bhawan' },
      { name: 'Sample Shubh Mandap Works B', area: 'Sapna Sangeeta' },
      { name: 'Sample Theme Party Crafters C', area: 'Bhawarkua' },
    ],
    photographer: [
      { name: 'Sample Central India Lens A', area: 'New Palasia' },
      { name: 'Sample Indore Kids Candid Co B', area: 'Race Course' },
      { name: 'Sample Malwa Visuals Studio C', area: 'Annapurna' },
    ],
  },
  'delhi ncr': {
    venue: [
      { name: 'Sample Farmhouse Retreat Delhi A', area: 'Chattarpur' },
      { name: 'Sample Grand Ballrooms Gurgaon B', area: 'Golf Course Road' },
      { name: 'Sample Heritage Haveli Noida C', area: 'Sector 62' },
    ],
    caterer: [
      { name: 'Sample Dilli Dawat Caterers A', area: 'Chandni Chowk' },
      { name: 'Sample Royal Mughlai Banquet B', area: 'Hauz Khas' },
      { name: 'Sample North Indian Feast Kitchen C', area: 'Rajouri Garden' },
    ],
    decorator: [
      { name: 'Sample Capital Floral Elegance A', area: 'Sainik Farm' },
      { name: 'Sample Royal Mandap Craft Delhi B', area: 'Defence Colony' },
      { name: 'Sample Grand Lighting Solutions C', area: 'Greater Kailash' },
    ],
    photographer: [
      { name: 'Sample Capital Wedding Reels A', area: 'Connaught Place' },
      { name: 'Sample Old Delhi Vintage Frames B', area: 'Daryaganj' },
      { name: 'Sample Studio Shutter NCR C', area: 'Cyber City' },
    ],
  },
  bengaluru: {
    venue: [
      { name: 'Sample Bengaluru Garden Pavilions A', area: 'Whitefield' },
      { name: 'Sample Bengaluru Palace Hall B', area: 'Sadashivanagar' },
      { name: 'Sample Bengaluru Tech Lawns C', area: 'Electronic City' },
    ],
    caterer: [
      { name: 'Sample South Indian Sadhya Caterer A', area: 'Malleshwaram' },
      { name: 'Sample Mysore Royal Banquets B', area: 'Jayanagar' },
      { name: 'Sample Bangalore Fusion Kitchen C', area: 'Indiranagar' },
    ],
    decorator: [
      { name: 'Sample Eco Foliage & Blooms A', area: 'Koramangala' },
      { name: 'Sample Traditional Jasmine Mandap B', area: 'Basavanagudi' },
      { name: 'Sample Contemporary Lights Studio C', area: 'HSR Layout' },
    ],
    photographer: [
      { name: 'Sample Bengaluru Visual Collective A', area: 'MG Road' },
      { name: 'Sample Silicon City Weddings B', area: 'Bellandur' },
      { name: 'Sample Candid Storytellers C', area: 'JP Nagar' },
    ],
  },
  hyderabad: {
    venue: [
      { name: 'Sample Hyderabad Nizami Banquets A', area: 'Banjara Hills' },
      { name: 'Sample Hyderabad Cyber Lawns B', area: 'Hitec City' },
      { name: 'Sample Hyderabad Heritage Hall C', area: 'Secunderabad' },
    ],
    caterer: [
      { name: 'Sample Dum Biryani Specialists A', area: 'Old City' },
      { name: 'Sample Telangana Spice Kitchen B', area: 'Jubilee Hills' },
      { name: 'Sample Deccani Shahi Dawat C', area: 'Gachibowli' },
    ],
    decorator: [
      { name: 'Sample Royal Nizami Decor A', area: 'Madhapur' },
      { name: 'Sample Floral Fantasy Hyderabad B', area: 'Kondapur' },
      { name: 'Sample Traditional Marigold Works C', area: 'Begumpet' },
    ],
    photographer: [
      { name: 'Sample Charminar Candid Studios A', area: 'Abids' },
      { name: 'Sample Pearl City Cinematography B', area: 'Kukatpally' },
      { name: 'Sample Hyderabad Wedding Arts C', area: 'Somajiguda' },
    ],
  },
  chennai: {
    venue: [
      { name: 'Sample Chennai Coastal Lawns A', area: 'ECR' },
      { name: 'Sample Chennai Grand Mandapam B', area: 'Mylapore' },
      { name: 'Sample Chennai Metro Convention C', area: 'Anna Nagar' },
    ],
    caterer: [
      { name: 'Sample Traditional Chettinad Kitchen A', area: 'T Nagar' },
      { name: 'Sample Madras Filter Kaapi & Sadhya B', area: 'Adyar' },
      { name: 'Sample Coastal Bay Feasts C', area: 'Velachery' },
    ],
    decorator: [
      { name: 'Sample Kanchipuram Silk & Florals A', area: 'Alwarpet' },
      { name: 'Sample South Indian Temple Mandap B', area: 'Triplicane' },
      { name: 'Sample Contemporary Beachside Decor C', area: 'Besant Nagar' },
    ],
    photographer: [
      { name: 'Sample Marina Sunset Studios A', area: 'San Thome' },
      { name: 'Sample Chennai Candid Collective B', area: 'Nungambakkam' },
      { name: 'Sample Tamil Wedding Chronicles C', area: 'Kodambakkam' },
    ],
  },
};

function mapCategoryToKey(categoryId: string): keyof CityCategoryData {
  const cat = categoryId.toLowerCase();
  if (cat.includes('cater') || cat.includes('food')) return 'caterer';
  if (cat.includes('decor') || cat.includes('floral')) return 'decorator';
  if (cat.includes('photo') || cat.includes('video')) return 'photographer';
  if (cat.includes('venue') || cat.includes('hall')) return 'venue';
  if (cat.includes('music') || cat.includes('entertain') || cat.includes('dj'))
    return 'entertainment';
  if (cat.includes('pandit') || cat.includes('ritual') || cat.includes('pooja')) return 'pandit';
  return 'caterer';
}

export class SampleVendorSource implements VendorSource {
  async search(query: VendorSearchQuery): Promise<VendorSearchResult> {
    const cityKey = (query.cityName || 'pune').toLowerCase().trim();
    const catKey = mapCategoryToKey(query.categoryId);

    // Look for matching city and category, or fall back to generic / pune entries
    const cityMatches = cityData[cityKey] || cityData.pune!;
    const categoryEntries = cityMatches[catKey] ||
      cityData.pune![catKey] || [
        { name: `Sample Vendor A (${query.label})`, area: 'Central Area' },
        { name: `Sample Vendor B (${query.label})`, area: 'North District' },
        { name: `Sample Vendor C (${query.label})`, area: 'South District' },
      ];

    const mapsUrl = buildGoogleMapsSearchUrl(query.label, query.cityName);

    const vendors: Vendor[] = categoryEntries.map((item, idx) => ({
      id: `sample_${cityKey}_${catKey}_${idx + 1}`,
      name: item.name,
      area: item.area,
      mapsUrl,
      badge: 'sample',
      note: SAMPLE_NOTE,
    }));

    return {
      source: 'sample',
      vendors,
      mapsUrl,
    };
  }
}
