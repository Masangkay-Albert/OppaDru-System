import { getProductImage } from './productImages';
import type { Product } from '../services/productService';

const fallbackHeroImage = getProductImage('yangyneom-chicken.jpg');
const preferredProductNames = ['yangnyeom boneless', 'soy garlic boneless', 'classic bbq boneless', 'tteokkboki'];

export const getLandingHeroImage = (products: Product[]): string => {
  if (!products.length) return fallbackHeroImage;

  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const preferredName of preferredProductNames) {
    const product = products.find((candidate) => normalize(candidate.name).includes(preferredName));
    if (product?.image) return product.image;
  }

  return products[0].image || fallbackHeroImage;
};
