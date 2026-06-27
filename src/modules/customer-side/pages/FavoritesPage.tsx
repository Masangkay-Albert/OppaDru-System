import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavorites } from '../../../contexts/FavoritesContext';
import { useCart } from '../../../contexts/CartContext';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import type { Product } from '../../../types/product.types';
import { FiArrowLeft, FiHeart, FiShoppingCart } from 'react-icons/fi';
import { FaHeart } from 'react-icons/fa';

const ProductImagePlaceholder: React.FC<{ name: string }> = ({ name }) => {
  const firstLetter = name.charAt(0).toUpperCase();
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex flex-col items-center justify-center">
      <span className="text-5xl font-light text-gray-500">{firstLetter}</span>
      <p className="text-xs text-gray-500 mt-1">Image coming soon</p>
    </div>
  );
};

const FavoritesPage: React.FC = () => {
  const navigate = useNavigate();
  const { favorites, toggleFavorite, clearFavoriteNotification } = useFavorites();
  const { addToCart } = useCart();

  useEffect(() => {
    clearFavoriteNotification();
  }, []);

  const handleAddToCart = (product: Product) => {
    const cartItem = {
      ...product,
      quantity: 1,
      selectedAddons: [],
      specialInstructions: ''
    };
    addToCart(cartItem);
    const btn = document.getElementById(`fav-add-${product.id}`);
    if (btn) {
      btn.textContent = 'Added!';
      btn.className = 'w-full py-2.5 bg-[#2d6a4f] text-white rounded-xl text-sm font-semibold transition-all';
      setTimeout(() => {
        btn.textContent = 'Add to Cart';
        btn.className = 'w-full py-2.5 bg-gradient-to-r from-[#e76f51] to-[#f4a261] text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2';
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf6ed] via-[#fff5ee] to-[#e8f5e9]">
      <NavbarCustomer />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate('/customer')}
            className="flex items-center gap-2 text-[#7f4f24] hover:text-[#2d6a4f] transition-all duration-300 font-medium text-sm bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm hover:shadow-md"
          >
            <FiArrowLeft className="w-4 h-4" />
            <span>Back to Menu</span>
          </button>
          <div className="h-8 w-px bg-[#e76f51]/20"></div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2d6a4f]">My Favorites</h1>
        </div>

        {favorites.length === 0 ? (
          <div className="text-center py-20 bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-[#e76f51]/10">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <FiHeart className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-gray-700 mb-3">No Favorites Yet</h2>
            <p className="text-gray-500 max-w-sm mx-auto text-sm leading-relaxed">
              You'll see all your favorites here, to make ordering even faster. Just look for the ❤️.
            </p>
            <button 
              onClick={() => navigate('/customer')}
              className="mt-8 px-8 py-3 bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] text-white rounded-full font-semibold hover:shadow-xl transition-all hover:scale-[1.02] text-sm"
            >
              Browse Menu
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {favorites.map((product) => {
              return (
                <div 
                  key={product.id} 
                  className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-200/80 hover:border-[#2d6a4f]/30 flex flex-col h-full group"
                >
                  <div className="relative h-48 w-full bg-gradient-to-br from-gray-100 to-gray-200 flex-shrink-0">
                    <ProductImagePlaceholder name={product.name} />
                    <button 
                      onClick={() => toggleFavorite(product)}
                      className="absolute top-3 right-3 text-2xl bg-white/90 backdrop-blur-sm rounded-full w-9 h-9 flex items-center justify-center shadow-md hover:scale-110 transition-transform duration-300"
                    >
                      <FaHeart className="text-red-500" />
                    </button>
                  </div>
                  
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-gray-800 text-base line-clamp-1">{product.name}</h3>
                    <p className="text-gray-500 text-xs mt-1 line-clamp-2 flex-1">{product.description}</p>
                    
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <span className="text-xl font-extrabold text-[#2d6a4f]">₱{product.price}</span>
                    </div>
                    
                    <button 
                      id={`fav-add-${product.id}`}
                      onClick={() => handleAddToCart(product)}
                      className="w-full mt-4 py-2.5 bg-gradient-to-r from-[#e76f51] to-[#f4a261] text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                    >
                      <FiShoppingCart className="w-4 h-4" />
                      Add to Cart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage;