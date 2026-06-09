// src/modules/customer-side/pages/FavoritesPage.tsx
import React from 'react';
import { useFavorites } from '../../../contexts/FavoritesContext';
import { useCart } from '../../../contexts/CartContext';
import NavbarCustomer from '../components/navigation/NavbarCustomer';

const FavoritesPage: React.FC = () => {
  const { favorites, toggleFavorite } = useFavorites();
  const { addToCart } = useCart();

  const handleAddToCart = (product: any) => {
    addToCart(product);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavbarCustomer />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">❤️</span>
          <h1 className="text-2xl font-bold text-gray-800">My Favorites</h1>
        </div>

        {favorites.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <div className="text-6xl mb-4">💔</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No Favorites Saved</h2>
            <p className="text-gray-500">
              You'll see all your favorites here, to make ordering even faster.
            </p>
            <p className="text-gray-400 text-sm mt-4">
              Just look for the ❤️ icon on any item to add to favorites!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {favorites.map((product) => (
              <div key={product.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <div className="relative h-32 bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 text-sm">Image</span>
                  <button 
                    onClick={() => toggleFavorite(product)}
                    className="absolute top-2 right-2 text-2xl text-red-500 bg-white/80 rounded-full w-8 h-8 flex items-center justify-center"
                  >
                    ❤️
                  </button>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-800">{product.name}</h3>
                  <p className="text-green-700 font-bold mt-1">₱{product.price}</p>
                  <button 
                    onClick={() => handleAddToCart(product)}
                    className="w-full mt-3 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 transition"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage;