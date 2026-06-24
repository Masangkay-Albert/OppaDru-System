// src/modules/customer-side/pages/FavoritesPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavorites } from '../../../contexts/FavoritesContext';
import { useCart } from '../../../contexts/CartContext';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import type { Product } from '../../../types/product.types';

const ProductImagePlaceholder: React.FC<{ name: string }> = ({ name }) => {
  const firstLetter = name.charAt(0).toUpperCase();
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex flex-col items-center justify-center">
      <div className="text-5xl mb-2 text-gray-500">{firstLetter}</div>
      <p className="text-xs text-gray-500">Image coming soon</p>
    </div>
  );
};

const FavoritesPage: React.FC = () => {
  const navigate = useNavigate();
  const { favorites, toggleFavorite, getOrderCount } = useFavorites();
  const { addToCart } = useCart();

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
      setTimeout(() => {
        btn.textContent = 'Add to Cart';
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarCustomer />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => navigate('/customer')}
            className="flex items-center gap-1 text-gray-500 hover:text-[#2d6a4f] transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Menu</span>
          </button>
          <div className="h-6 w-px bg-gray-300"></div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#2d6a4f]">My Favorites</h1>
            <span className="bg-[#e76f51] text-white text-xs px-2 py-1 rounded-full">
              {favorites.length}
            </span>
          </div>
        </div>

        {favorites.length === 0 ? (
          <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg">
            <div className="text-6xl mb-4 text-gray-400">❤️</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No Favorites Yet</h2>
            <p className="text-gray-500 max-w-sm mx-auto">
              Your favorite items will appear here. Order a product 3 times and it will be automatically added.
            </p>
            <button 
              onClick={() => navigate('/customer')}
              className="mt-6 px-6 py-2 bg-[#2d6a4f] text-white rounded-full font-medium hover:bg-[#1b4d3e] transition"
            >
              Browse Menu
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 p-3 bg-[#d8f3dc] rounded-xl text-sm text-[#2d6a4f] flex items-center gap-2">
              <span>⭐</span>
              <p>Order a product 3 times and it will be automatically added to favorites.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {favorites.map((product) => {
                const orderCount = getOrderCount(product.id);
                return (
                  <div 
                    key={product.id} 
                    className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100"
                  >
                    <div className="relative h-40 w-full">
                      <ProductImagePlaceholder name={product.name} />
                      <button 
                        onClick={() => toggleFavorite(product)}
                        className="absolute top-3 right-3 text-2xl bg-white/90 rounded-full w-9 h-9 flex items-center justify-center shadow-md hover:scale-110 transition"
                      >
                        ❤️
                      </button>
                      {orderCount >= 3 && (
                        <div className="absolute bottom-3 left-3 bg-[#2d6a4f] text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                          <span>⭐</span> Auto-favorite
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4">
                      <h3 className="font-bold text-gray-800 text-lg">{product.name}</h3>
                      <p className="text-gray-500 text-xs mt-1 line-clamp-2">{product.description}</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-2xl font-bold text-[#2d6a4f]">₱{product.price}</span>
                        <span className="text-xs text-gray-400">
                          Ordered: {orderCount} time{orderCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <button 
                        id={`fav-add-${product.id}`}
                        onClick={() => handleAddToCart(product)}
                        className="w-full mt-4 py-2.5 bg-[#e76f51] text-white rounded-lg text-sm font-semibold hover:bg-[#f4a261] transition-all hover:scale-[1.02]"
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage;