import { products } from './mockData'; 
import oppaLogo from '../assets/oppadrulogo.jpg';

export interface LandingCategory {
  id: string;
  name: string;
  desc: string;
  image: string;
  color: string;
}

const getCategoryImage = (categoryId: string): string => {
  const found = products.find((p) => p.category === categoryId);
  return found ? found.image : oppaLogo;
};

export const landingCategories: LandingCategory[] = [
  {
    id: 'fresh-lemonade',
    name: 'Fresh Lemonade',
    desc: 'Refreshing citrus drinks',
    image: getCategoryImage('fresh-lemonade'),
    color: '#eab308',
  },
  {
    id: 'noodles',
    name: 'Noodles',
    desc: 'Spicy Korean-style noodles',
    image: getCategoryImage('noodles'),
    color: '#dc2626',
  },
  {
    id: 'fruity-soda-milk',
    name: 'Fruity Soda & Fruity Milk',
    desc: 'Cold fruity refreshments',
    image: getCategoryImage('fruity-soda-milk'),
    color: '#db2777',
  },
  {
    id: 'snacks',
    name: 'Snacks',
    desc: 'Perfect anytime bites',
    image: getCategoryImage('snacks'),
    color: '#c2410c',
  },
  {
    id: 'chicken',
    name: 'Chicken Meal',
    desc: 'Crispy Korean fried chicken',
    image: getCategoryImage('chicken'),
    color: '#92400e',
  },
  {
    id: 'rice-meals',
    name: 'Rice Meal',
    desc: 'Busog meals everyday',
    image: getCategoryImage('rice-meals'),
    color: '#4d7c0f',
  },
];