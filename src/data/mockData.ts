//src/data/mockData.ts
import type { Product, Category, Addon } from '../types/product.types';
import oppadrulogo from '../assets/oppadrulogo.jpg';

export const categories: Category[] = [
  { id: 'all', name: 'All', icon: '' },
  { id: 'rice-meals', name: 'Rice Meal', icon: '' },
  { id: 'chicken', name: 'Chicken Meal', icon: '' },
  { id: 'snacks', name: 'Snacks', icon: '' },
  { id: 'fruity-soda-milk', name: 'Fruity Soda & Fruity Milk', icon: '' },
  { id: 'noodles', name: 'Noodles', icon: '' },
  { id: 'fresh-lemonade', name: 'Fresh Lemonade', icon: '' },
];

export const products: Product[] = [
  // Rice Meal
  { id: 'rm1', name: 'SoyGarlic Chicken With Rice', description: 'Fried chicken glazed with soy garlic sauce, served with rice', price: 198, category: 'rice-meals', image: oppadrulogo, isAvailable: true },
  { id: 'rm2', name: 'Spicy BBQ Chicken With Rice', description: 'Fried chicken coated in spicy BBQ sauce, served with rice', price: 198, category: 'rice-meals', image: oppadrulogo, isAvailable: true },
  { id: 'rm3', name: 'Yangnyeom Chicken With Rice', description: 'Korean-style sweet and spicy yangnyeom chicken with rice', price: 198, category: 'rice-meals', image: oppadrulogo, isAvailable: true },
  { id: 'rm4', name: 'Original Chicken With Rice', description: 'Classic crispy fried chicken served with rice', price: 198, category: 'rice-meals', image: oppadrulogo, isAvailable: true },
  { id: 'rm5', name: 'Yangnyeom Garlic Chicken With Rice', description: 'Yangnyeom chicken with extra garlic kick, served with rice', price: 198, category: 'rice-meals', image: oppadrulogo, isAvailable: true },
  { id: 'rm6', name: 'Teriyaki Chicken With Rice', description: 'Chicken glazed in sweet teriyaki sauce, served with rice', price: 198, category: 'rice-meals', image: oppadrulogo, isAvailable: true },
  { id: 'rm7', name: 'Classic BBQ Chicken With Rice', description: 'Chicken tossed in classic BBQ sauce, served with rice', price: 198, category: 'rice-meals', image: oppadrulogo, isAvailable: true },
  { id: 'rm8', name: 'Spring Onion Chicken With Rice', description: 'Fried chicken topped with spring onions, served with rice', price: 198, category: 'rice-meals', image: oppadrulogo, isAvailable: true },
  { id: 'rm9', name: 'Yangyeom 2.0 Chicken With Rice', description: 'Upgraded yangnyeom recipe, sweeter and spicier, with rice', price: 198, category: 'rice-meals', image: oppadrulogo, isAvailable: true },

  // Chicken (Boneless)
  { id: 'ch1', name: 'Original Boneless Chicken', description: 'Classic crispy boneless fried chicken', price: 415, category: 'chicken', image: oppadrulogo, isAvailable: true },
  { id: 'ch2', name: 'Soy Garlic Boneless Chicken', description: 'Boneless chicken glazed with soy garlic sauce', price: 428, category: 'chicken', image: oppadrulogo, isAvailable: true },
  { id: 'ch3', name: 'Classic BBQ Boneless Chicken', description: 'Boneless chicken tossed in classic BBQ sauce', price: 428, category: 'chicken', image: oppadrulogo, isAvailable: true },
  { id: 'ch4', name: 'Spicy BBQ Boneless Chicken', description: 'Boneless chicken coated in spicy BBQ sauce', price: 438, category: 'chicken', image: oppadrulogo, isAvailable: true },
  { id: 'ch5', name: 'Yangyneom Boneless Chicken', description: 'Korean-style sweet and spicy yangnyeom boneless chicken', price: 438, category: 'chicken', image: oppadrulogo, isAvailable: true },
  { id: 'ch6', name: 'Yangyneom 2.0 Boneless Chicken', description: 'Upgraded yangnyeom recipe, boneless version', price: 438, category: 'chicken', image: oppadrulogo, isAvailable: true },
  { id: 'ch7', name: 'Teriyaki Boneless Chicken', description: 'Boneless chicken glazed in sweet teriyaki sauce', price: 438, category: 'chicken', image: oppadrulogo, isAvailable: true },
  { id: 'ch8', name: 'Yangneom Garlic Boneless Chicken', description: 'Yangnyeom boneless chicken with extra garlic kick', price: 438, category: 'chicken', image: oppadrulogo, isAvailable: true },
  { id: 'ch9', name: 'Spring Onion Boneless Chicken', description: 'Boneless fried chicken topped with spring onions', price: 438, category: 'chicken', image: oppadrulogo, isAvailable: true },

  // Snacks
  { id: 'sn1', name: 'Crispy Chicken Sandwich', description: 'Crispy fried chicken fillet in a soft bun', price: 165, category: 'snacks', image: oppadrulogo, isAvailable: true },
  { id: 'sn2', name: 'Tteokkboki (Ricecake + Fishcake)', description: 'Korean rice cakes and fishcake in spicy sauce', price: 139, category: 'snacks', image: oppadrulogo, isAvailable: true },
  { id: 'sn3', name: 'French Fries', description: 'Crispy golden fries', price: 139, category: 'snacks', image: oppadrulogo, isAvailable: true },

  // Fruity Soda & Fruity Milk
  { id: 'fr1', name: 'Mango Milk', description: 'Creamy mango-flavored milk drink', price: 109, category: 'fruity-soda-milk', image: oppadrulogo, isAvailable: true },
  { id: 'fr2', name: 'Strawberry Soda', description: 'Refreshing strawberry-flavored soda', price: 89, category: 'fruity-soda-milk', image: oppadrulogo, isAvailable: true },
  { id: 'fr3', name: 'Kiwi Soda', description: 'Refreshing kiwi-flavored soda', price: 89, category: 'fruity-soda-milk', image: oppadrulogo, isAvailable: true },
  { id: 'fr4', name: 'Blueberry Soda', description: 'Refreshing blueberry-flavored soda', price: 89, category: 'fruity-soda-milk', image: oppadrulogo, isAvailable: true },
  { id: 'fr5', name: 'Green Apple Soda', description: 'Refreshing green apple-flavored soda', price: 89, category: 'fruity-soda-milk', image: oppadrulogo, isAvailable: true },
  { id: 'fr6', name: 'Strawberry Milk', description: 'Creamy strawberry-flavored milk drink', price: 109, category: 'fruity-soda-milk', image: oppadrulogo, isAvailable: true },
  { id: 'fr7', name: 'Lychee Soda', description: 'Refreshing lychee-flavored soda', price: 89, category: 'fruity-soda-milk', image: oppadrulogo, isAvailable: true },
  { id: 'fr8', name: 'Passion Fruit Soda', description: 'Refreshing passion fruit-flavored soda', price: 89, category: 'fruity-soda-milk', image: oppadrulogo, isAvailable: true },
  { id: 'fr9', name: 'Blueberry Milk', description: 'Creamy blueberry-flavored milk drink', price: 109, category: 'fruity-soda-milk', image: oppadrulogo, isAvailable: true },

  // Noodles
  { id: 'nd1', name: 'Samyang Noodles', description: 'Spicy Korean-style Samyang noodles', price: 229, category: 'noodles', image: oppadrulogo, isAvailable: true },

  // Fresh Lemonade
  { id: 'lm1', name: 'Strawberry Lemonade', description: 'Fresh lemonade with strawberry flavor', price: 119, category: 'fresh-lemonade', image: oppadrulogo, isAvailable: true },
  { id: 'lm2', name: 'Classic Lemon', description: 'Classic fresh lemonade', price: 109, category: 'fresh-lemonade', image: oppadrulogo, isAvailable: true },
  { id: 'lm3', name: 'Lychee Lemon', description: 'Fresh lemonade with lychee flavor', price: 119, category: 'fresh-lemonade', image: oppadrulogo, isAvailable: true },
  { id: 'lm4', name: 'Blueberry Lemon', description: 'Fresh lemonade with blueberry flavor', price: 119, category: 'fresh-lemonade', image: oppadrulogo, isAvailable: true },
  { id: 'lm5', name: 'Green Apple Lemon', description: 'Fresh lemonade with green apple flavor', price: 119, category: 'fresh-lemonade', image: oppadrulogo, isAvailable: true },
  { id: 'lm6', name: 'Kiwi Lemon', description: 'Fresh lemonade with kiwi flavor', price: 119, category: 'fresh-lemonade', image: oppadrulogo, isAvailable: true },
  { id: 'lm7', name: 'Yakult Lemon', description: 'Fresh lemonade mixed with Yakult', price: 119, category: 'fresh-lemonade', image: oppadrulogo, isAvailable: true },
  { id: 'lm8', name: 'Passion Fruit Lemon', description: 'Fresh lemonade with passion fruit flavor', price: 119, category: 'fresh-lemonade', image: oppadrulogo, isAvailable: true },
];

export const addons: Addon[] = [
  { id: 'ao1', name: 'Extra Rice', price: 39, image: oppadrulogo },
  { id: 'ao2', name: 'Kim (Seaweeds)', price: 80, image: oppadrulogo },
  { id: 'ao3', name: 'Cheese', price: 68, image: oppadrulogo },
  { id: 'ao4', name: 'Kimchi', price: 68, image: oppadrulogo },
  { id: 'ao5', name: 'Pickled Radish', price: 65, image: oppadrulogo },
  { id: 'ao6', name: 'Extra Sauce', price: 68, image: oppadrulogo },
  { id: 'ao7', name: 'French Fries', price: 165, image: oppadrulogo },
  { id: 'ao8', name: 'Burning Mayo', price: 75, image: oppadrulogo },
  { id: 'ao9', name: 'Honey Mustard', price: 75, image: oppadrulogo },
  { id: 'ao10', name: 'Ranch', price: 75, image: oppadrulogo },
  { id: 'ao11', name: 'Melted Cheddar Cheese', price: 75, image: oppadrulogo },
];