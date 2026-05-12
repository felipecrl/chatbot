import type { Property } from '../properties/property.types';

/** Compact PT-keyed projection of a property, used as a tool result for the LLM. */
export interface PropertyDigest {
  codigo: string;
  tipo: string | null;
  modalidade: Property['transaction'];
  cidade: string | null;
  bairro: string | null;
  endereco: string | null;
  preco: number | null;
  metragem: number | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  amenidades: string[];
  descricao: string;
}

export function toPropertyDigest(property: Property): PropertyDigest {
  return {
    codigo: property.code,
    tipo: property.type,
    modalidade: property.transaction,
    cidade: property.city,
    bairro: property.neighborhood,
    endereco: property.address,
    preco: property.price,
    metragem: property.area,
    quartos: property.bedrooms,
    banheiros: property.bathrooms,
    vagas: property.parkingSpaces,
    amenidades: property.amenities,
    descricao: property.description,
  };
}
