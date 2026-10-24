import oppaLogo from '../assets/oppadrulogo.jpg';

export interface LandingCategory {
  id: string;
  name: string;
  desc: string;
  image: string;
  color: string;
}
/* test */
export const landingCategories: LandingCategory[] = [
  {
    id: 'fresh-lemonade',
    name: 'Non-Coffee',
    desc: 'Refreshing non-coffee drinks',
    image: oppaLogo,
    color: '#eab308',
  },
  {
    id: 'noodles',
    name: 'Noodles',
    desc: 'Spicy Korean-style noodles',
    image: oppaLogo,
    color: '#dc2626',
  },
  {
    id: 'fruity-soda-milk',
    name: 'Fruity Soda',
    desc: 'Cold fruity refreshments',
    image: oppaLogo,
    color: '#db2777',
  },
  {
    id: 'snacks',
    name: 'Snacks',
    desc: 'Perfect anytime bites',
    image: oppaLogo,
    color: '#c2410c',
  },
  {
    id: 'chicken',
    name: 'Chicken Meal',
    desc: 'Crispy Korean fried chicken',
    image: oppaLogo,
    color: '#92400e',
  },
  {
    id: 'rice-meals',
    name: 'Rice Meal',
    desc: 'Busog meals everyday',
    image: oppaLogo,
    color: '#4d7c0f',
  },
];