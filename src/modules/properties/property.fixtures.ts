import { config } from '../../config';
import type { Property, PropertySearchFilters } from './property.types';

/** Sample catalogue used when the Imoview integration is not configured. */
function sampleProperties(): Property[] {
  const city = config.chatbot.companyCity;
  return [
    {
      code: 'AP001',
      type: 'Apartamento',
      transaction: 'venda',
      city,
      neighborhood: 'Savassi',
      address: null,
      price: 450_000,
      area: 75,
      bedrooms: 2,
      bathrooms: 2,
      parkingSpaces: 1,
      amenities: ['Academia', 'Piscina', 'Portaria 24h'],
      description: 'Lindo apartamento em localização privilegiada.',
      photos: [],
    },
    {
      code: 'CS002',
      type: 'Casa',
      transaction: 'venda',
      city,
      neighborhood: 'Buritis',
      address: null,
      price: 680_000,
      area: 180,
      bedrooms: 4,
      bathrooms: 3,
      parkingSpaces: 2,
      amenities: ['Quintal', 'Churrasqueira', 'Piscina'],
      description: 'Casa espaçosa em condomínio fechado.',
      photos: [],
    },
    {
      code: 'AP003',
      type: 'Apartamento',
      transaction: 'aluguel',
      city,
      neighborhood: 'Funcionários',
      address: null,
      price: 2_800,
      area: 60,
      bedrooms: 2,
      bathrooms: 1,
      parkingSpaces: 1,
      amenities: ['Portaria 24h', 'Elevador'],
      description: 'Apartamento para alugar, próximo ao metrô.',
      photos: [],
    },
  ];
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function searchSampleProperties(filters: PropertySearchFilters, limit: number): Property[] {
  return sampleProperties()
    .filter((p) => !filters.transaction || p.transaction === filters.transaction)
    .filter(
      (p) => !filters.type || (p.type ?? '').toLowerCase().includes(filters.type.toLowerCase()),
    )
    .filter(
      (p) =>
        !filters.city ||
        normalizeText(p.city ?? '').includes(normalizeText(filters.city)),
    )
    .filter(
      (p) =>
        !filters.neighborhood ||
        normalizeText(p.neighborhood ?? '').includes(normalizeText(filters.neighborhood)),
    )
    .filter((p) => filters.maxPrice == null || (p.price ?? 0) <= filters.maxPrice)
    .filter((p) => filters.minPrice == null || (p.price ?? 0) >= filters.minPrice)
    .filter((p) => filters.minBedrooms == null || (p.bedrooms ?? 0) >= filters.minBedrooms)
    .filter((p) => filters.minArea == null || (p.area ?? 0) >= filters.minArea)
    .slice(0, limit);
}

export function findSampleProperty(code: string): Property | null {
  return sampleProperties().find((p) => p.code === code) ?? null;
}
