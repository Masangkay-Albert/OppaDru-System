import oppaLogo from '../assets/oppadrulogo.jpg';

// Import Rice Meals
import soygarlicRice from '../assets/RiceMeal/soygarlic-rice.jpg';
import spicybbqRice from '../assets/RiceMeal/spicybbq-rice.jpg';
import yangnyeomRice from '../assets/RiceMeal/yangnyeom-rice.jpg';
import originalRice from '../assets/RiceMeal/original-rice.jpg';
import yangnyeomgarlicRice from '../assets/RiceMeal/yangnyeomgarlic-rice.jpg';
import teriyakiRice from '../assets/RiceMeal/teriyaki-rice.jpg';
import classicbbqRice from '../assets/RiceMeal/classicbbq-rice.jpg';
import springonionRice from '../assets/RiceMeal/springonion-rice.jpg';
import yangyeom20Rice from '../assets/RiceMeal/yangyeom2.0-rice.jpg';

// Import Chicken Meals
import originalChicken from '../assets/ChickenMeal/original-chicken.jpg';
import soygarlicChicken from '../assets/ChickenMeal/soygarlic-chicken.jpg';
import classicbbqChicken from '../assets/ChickenMeal/classicbbq-chicken.jpg';
import spicybbqChicken from '../assets/ChickenMeal/spicybbq-chicken.jpg';
import yangyneomChicken from '../assets/ChickenMeal/yangyneom-chicken.jpg';
import yangyeom20Chicken from '../assets/ChickenMeal/yangyneom2.0-chicken.jpg';
import teriyakiChicken from '../assets/ChickenMeal/teriyaki-chicken.jpg';
import yangneomgarlicChicken from '../assets/ChickenMeal/yangneomgarlic-chicken.jpg';
import springonionChicken from '../assets/ChickenMeal/springonion-chicken.jpg';

// Import Snacks
import crispychickenSandwich from '../assets/Snacks/crispychicken-sandwich.jpg';
import tteokkbokij from '../assets/Snacks/tteokkboki.jpg';
import fries from '../assets/Snacks/fries.jpg';

// Import Soda & Milk
import mangomilk from '../assets/SodaMilk/mangomilk.jpg';
import strawberrySoda from '../assets/SodaMilk/strawberry-soda.jpg';
import kiwiSoda from '../assets/SodaMilk/kiwi-soda.jpg';
import blueberrySoda from '../assets/SodaMilk/blueberry-soda.jpg';
import greenappleSoda from '../assets/SodaMilk/greenapple-soda.jpg';
import strawberryMilk from '../assets/SodaMilk/strawberry-milk.jpg';
import lycheeSoda from '../assets/SodaMilk/lychee-soda.jpg';
import passionfruitSoda from '../assets/SodaMilk/passionfruit-soda.jpg';
import blueberryMilk from '../assets/SodaMilk/blueberry-milk.jpg';

// Import Noodles
import samyang from '../assets/Noodles/samyang.jpg';

// Import Lemonade
import strawberryLemonade from '../assets/Lemonade/strawberry-lemonade.jpg';
import classicLemon from '../assets/Lemonade/classic-lemon.jpg';
import lycheeLemon from '../assets/Lemonade/lychee-lemon.jpg';
import blueberryLemon from '../assets/Lemonade/blueberry-lemon.jpg';
import greenappleLemon from '../assets/Lemonade/greenapple-lemon.jpg';
import kiwiLemon from '../assets/Lemonade/kiwi-lemon.jpg';
import yakultLemon from '../assets/Lemonade/yakult-lemon.jpg';
import passionfruitLemon from '../assets/Lemonade/passionfruit-lemon.jpg';

export const productImages: Record<string, string> = {
    'soygarlic-rice.jpg': soygarlicRice,
    'spicybbq-rice.jpg': spicybbqRice,
    'yangnyeom-rice.jpg': yangnyeomRice,
    'original-rice.jpg': originalRice,
    'yangnyeomgarlic-rice.jpg': yangnyeomgarlicRice,
    'teriyaki-rice.jpg': teriyakiRice,
    'classicbbq-rice.jpg': classicbbqRice,
    'springonion-rice.jpg': springonionRice,
    'yangyeom2.0-rice.jpg': yangyeom20Rice,

    'original-chicken.jpg': originalChicken,
    'soygarlic-chicken.jpg': soygarlicChicken,
    'classicbbq-chicken.jpg': classicbbqChicken,
    'spicybbq-chicken.jpg': spicybbqChicken,
    'yangyneom-chicken.jpg': yangyneomChicken,
    'yangyneom2.0-chicken.jpg': yangyeom20Chicken,
    'teriyaki-chicken.jpg': teriyakiChicken,
    'yangneomgarlic-chicken.jpg': yangneomgarlicChicken,
    'springonion-chicken.jpg': springonionChicken,

    'crispychicken-sandwich.jpg': crispychickenSandwich,
    'tteokkboki.jpg': tteokkbokij,
    'fries.jpg': fries,

    'mangomilk.jpg': mangomilk,
    'strawberry-soda.jpg': strawberrySoda,
    'kiwi-soda.jpg': kiwiSoda,
    'blueberry-soda.jpg': blueberrySoda,
    'greenapple-soda.jpg': greenappleSoda,
    'strawberry-milk.jpg': strawberryMilk,
    'lychee-soda.jpg': lycheeSoda,
    'passionfruit-soda.jpg': passionfruitSoda,
    'blueberry-milk.jpg': blueberryMilk,

    'samyang.jpg': samyang,

    'strawberry-lemonade.jpg': strawberryLemonade,
    'classic-lemon.jpg': classicLemon,
    'lychee-lemon.jpg': lycheeLemon,
    'blueberry-lemon.jpg': blueberryLemon,
    'greenapple-lemon.jpg': greenappleLemon,
    'kiwi-lemon.jpg': kiwiLemon,
    'yakult-lemon.jpg': yakultLemon,
    'passionfruit-lemon.jpg': passionfruitLemon,
};

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://oppadru-system-1.onrender.com/api').replace(/\/api\/?$/, '');

const resolveImageUrl = (imagePath: string): string => {
    // Handle empty or missing images
    if (!imagePath || imagePath === '' || imagePath === '/oppadrulogo.jpg' || imagePath === 'oppadrulogo.jpg') {
        return oppaLogo;
    }

    // Handle absolute URLs and data URIs
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:image') || imagePath.startsWith('blob:')) {
        return imagePath;
    }

    // Handle backend storage paths
    if (imagePath.startsWith('/')) {
        if (imagePath.startsWith('/storage/')) {
            return `${API_BASE_URL}${imagePath}`;
        }
        return oppaLogo;
    }

    const filename = imagePath.split('/').pop() || '';

    if (productImages[filename]) {
        return productImages[filename];
    }

    if (imagePath.startsWith('storage/')) {
        return `${API_BASE_URL}/${imagePath}`;
    }

    return imagePath;
};

export const getProductImage = (imagePath: string): string => resolveImageUrl(imagePath);

export const getAddonImage = (imagePath?: string | null): string => {
    const normalizedPath = imagePath?.trim() || '';
    return resolveImageUrl(normalizedPath);
};