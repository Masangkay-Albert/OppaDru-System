import type { Category, Addon } from '../types/product.types';
import oppadrulogo from '../assets/oppadrulogo.jpg';

const addonImages: Record<string, string> = import.meta.glob('../assets/Add-Ons/*.jpg', {
  eager: true,
  import: 'default'
});

const getAddonImage = (filename: string): string => {
  const path = `../assets/Add-Ons/${filename}`;
  return addonImages[path] || oppadrulogo;
};

export const categories: Category[] = [
  { id: 'all', name: 'All', icon: '' },
  { id: 'rice-meals', name: 'Rice Meal', icon: '' },
  { id: 'chicken', name: 'Chicken Meal', icon: '' },
  { id: 'snacks', name: 'Snacks', icon: '' },
  { id: 'fruity-soda-milk', name: 'Fruity Soda & Fruity Milk', icon: '' },
  { id: 'noodles', name: 'Noodles', icon: '' },
  { id: 'fresh-lemonade', name: 'Fresh Lemonade', icon: '' },
];

export const addons: Addon[] = [
  { id: 'ao1', name: 'Extra Rice', price: 39, image: getAddonImage('extrarice.jpg') },
  { id: 'ao2', name: 'Kim (Seaweeds)', price: 80, image: getAddonImage('Seaweeds.jpg') },
  { id: 'ao3', name: 'Cheese', price: 68, image: getAddonImage('cheese.jpg') },
  { id: 'ao4', name: 'Kimchi', price: 68, image: getAddonImage('kimchi.jpg') },
  { id: 'ao5', name: 'Pickled Radish', price: 65, image: getAddonImage('pickle.jpg') },
  { id: 'ao6', name: 'Extra Sauce', price: 68, image: getAddonImage('sauce.jpg') },
  { id: 'ao7', name: 'French Fries', price: 165, image: getAddonImage('fries.jpg') },
  { id: 'ao8', name: 'Burning Mayo', price: 75, image: getAddonImage('mayo.jpg') },
  { id: 'ao9', name: 'Honey Mustard', price: 75, image: getAddonImage('mustard.jpg') },
  { id: 'ao10', name: 'Ranch', price: 75, image: getAddonImage('ranch.jpg') },
  { id: 'ao11', name: 'Melted Cheddar Cheese', price: 75, image: getAddonImage('melted-cheddar-cheese.jpg') },
];
