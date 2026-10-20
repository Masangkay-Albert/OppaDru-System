import React, { useEffect, useState, useMemo } from 'react';
import AdminLayout from '../components/AdminLayout';
import { promoService, type Promo } from '../../../services/promoService';
import { formatCurrency } from '../../../utils/formatters';
import { categories } from '../../../data/mockData';
import {
  Tag, Plus, Search, Edit2, Trash2, CheckCircle2,
  XCircle, AlertCircle, Image as ImageIcon, Sparkles, Percent, DollarSign, RefreshCw
} from 'lucide-react';

export default function AdminPromosPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<number | ''>(10);
  const [minOrderAmount, setMinOrderAmount] = useState<number | ''>(0);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Promo | null>(null);

  const loadPromos = async () => {
    setLoading(true);
    try {
      const data = await promoService.getAllPromos({ status: statusFilter, search });
      setPromos(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPromos();
  }, [statusFilter]);

  const openCreateModal = () => {
    setEditingPromo(null);
    setTitle('');
    setCode('');
    setDescription('');
    setDiscountType('percent');
    setDiscountValue(10);
    setMinOrderAmount(0);
    setMaxDiscountAmount('');
    setStartDate('');
    setEndDate('');
    setIsActive(true);
    setSelectedCategories([]);
    setSelectedProducts([]);
    setImageFile(null);
    setImagePreview(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (promo: Promo) => {
    setEditingPromo(promo);
    setTitle(promo.title);
    setCode(promo.code || '');
    setDescription(promo.description || '');
    setDiscountType(promo.discount_type);
    setDiscountValue(promo.discount_value);
    setMinOrderAmount(promo.min_order_amount ?? 0);
    setMaxDiscountAmount(promo.max_discount_amount ?? '');
    setStartDate(promo.start_date ? promo.start_date.slice(0, 16) : '');
    setEndDate(promo.end_date ? promo.end_date.slice(0, 16) : '');
    setIsActive(promo.is_active);
    setSelectedCategories(promo.applicable_categories || []);
    setSelectedProducts(promo.applicable_products || []);
    setImageFile(null);
    setImagePreview(promo.image_url || null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('Please enter a promo title.');
      return;
    }
    if (discountValue === '' || Number(discountValue) <= 0) {
      setFormError('Discount value must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      if (code.trim()) formData.append('code', code.trim().toUpperCase());
      formData.append('description', description.trim());
      formData.append('discount_type', discountType);
      formData.append('discount_value', String(discountValue));
      formData.append('min_order_amount', String(minOrderAmount || 0));
      if (maxDiscountAmount !== '') formData.append('max_discount_amount', String(maxDiscountAmount));
      if (startDate) formData.append('start_date', startDate);
      if (endDate) formData.append('end_date', endDate);
      formData.append('is_active', isActive ? '1' : '0');
      formData.append('applicable_categories', JSON.stringify(selectedCategories));
      formData.append('applicable_products', JSON.stringify(selectedProducts));

      if (imageFile) {
        formData.append('image', imageFile);
      }

      if (editingPromo) {
        await promoService.updatePromo(editingPromo.id, formData);
      } else {
        await promoService.createPromo(formData);
      }

      setIsModalOpen(false);
      loadPromos();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save promo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await promoService.deletePromo(deleteTarget.id);
      setDeleteTarget(null);
      loadPromos();
    } catch (err: any) {
      alert(err.message || 'Failed to delete promo.');
    }
  };

  const handleToggleActive = async (promo: Promo) => {
    try {
      await promoService.toggleActive(promo.id);
      setPromos(prev =>
        prev.map(p => (p.id === promo.id ? { ...p, is_active: !p.is_active } : p))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to toggle promo.');
    }
  };

  const filteredPromos = useMemo(() => {
    return promos.filter(p => {
      const matchSearch =
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(search.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
      return matchSearch;
    });
  }, [promos, search]);

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[var(--oppa-green)]/10 text-[var(--oppa-green)]">
                <Tag size={22} />
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--oppa-text)]">
                Promos & Discounts
              </h1>
            </div>
            <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">
              Create, schedule, and manage database-driven promotions across Customer and Cashier POS.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadPromos}
              disabled={loading}
              className="p-2.5 rounded-xl border border-[var(--oppa-border)] bg-white text-[var(--oppa-text)] hover:bg-gray-50 transition"
              title="Refresh Promos"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 transition"
            >
              <Plus size={18} />
              Add New Promo
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[var(--oppa-border)] shadow-sm">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {(['all', 'active', 'inactive', 'expired'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                  statusFilter === tab
                    ? 'bg-[var(--oppa-green)] text-white shadow-xs'
                    : 'text-[var(--oppa-text-muted)] hover:bg-gray-100 hover:text-[var(--oppa-text)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative min-w-[260px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search title, code, or description..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--oppa-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)] focus:border-transparent bg-gray-50/50"
            />
          </div>
        </div>

        {/* Promos Table / Grid */}
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white overflow-hidden shadow-sm">
          {loading && promos.length === 0 ? (
            <div className="p-12 text-center text-sm text-[var(--oppa-text-muted)]">
              <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-[var(--oppa-green)]" />
              Loading database promos...
            </div>
          ) : filteredPromos.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <Tag size={24} />
              </div>
              <h3 className="font-semibold text-gray-800">No promos found</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                {search ? `No promotions match "${search}"` : 'Get started by creating your first promotional offer.'}
              </p>
              {!search && (
                <button
                  onClick={openCreateModal}
                  className="mt-4 px-4 py-2 rounded-xl bg-[var(--oppa-green)] text-white text-sm font-semibold hover:opacity-90"
                >
                  Create Promo
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--oppa-border)] bg-[var(--oppa-cream)]/40 text-xs uppercase tracking-wider text-[var(--oppa-text-muted)] font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">Promo Details</th>
                    <th className="py-3.5 px-4">Discount</th>
                    <th className="py-3.5 px-4">Applicable To</th>
                    <th className="py-3.5 px-4">Validity</th>
                    <th className="py-3.5 px-4">Active</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--oppa-border)]">
                  {filteredPromos.map(promo => {
                    const isExpired = promo.is_expired;
                    return (
                      <tr key={promo.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {promo.image_url ? (
                              <img
                                src={promo.image_url}
                                alt={promo.title}
                                className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[var(--oppa-green)] flex items-center justify-center shrink-0 border border-emerald-100">
                                <Sparkles size={20} />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[var(--oppa-text)]">{promo.title}</span>
                                {promo.code && (
                                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold border border-gray-200">
                                    {promo.code}
                                  </span>
                                )}
                              </div>
                              {promo.description && (
                                <p className="text-xs text-[var(--oppa-text-muted)] mt-0.5 max-w-xs line-clamp-1">
                                  {promo.description}
                                </p>
                              )}
                              {promo.times_used !== undefined && promo.times_used > 0 && (
                                <span className="text-[11px] text-gray-400 mt-1 block">
                                  Used {promo.times_used} times
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 font-semibold text-[var(--oppa-green)]">
                          <div className="flex items-center gap-1.5">
                            {promo.discount_type === 'percent' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-bold border border-green-200/60">
                                <Percent size={12} /> {promo.discount_value}% OFF
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/60">
                                ₱{Number(promo.discount_value).toFixed(2)} OFF
                              </span>
                            )}
                          </div>
                          {Number(promo.min_order_amount) > 0 && (
                            <span className="text-[11px] text-gray-500 font-normal block mt-1">
                              Min. order: {formatCurrency(Number(promo.min_order_amount))}
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-xs text-[var(--oppa-text)]">
                          {promo.applicable_categories && promo.applicable_categories.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {promo.applicable_categories.map(c => (
                                <span key={c} className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] capitalize border border-blue-100">
                                  {c.replace('-', ' ')}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-500 italic">All Categories</span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-xs">
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 text-red-600 font-semibold bg-red-50 px-2 py-1 rounded-md">
                              <AlertCircle size={13} /> Expired
                            </span>
                          ) : promo.end_date ? (
                            <div className="space-y-0.5 text-gray-600">
                              <span className="block font-medium">Until {new Date(promo.end_date).toLocaleDateString()}</span>
                              <span className="text-[11px] text-gray-400">
                                {promo.start_date ? `From ${new Date(promo.start_date).toLocaleDateString()}` : 'Ongoing'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-500 font-medium">No Expiration</span>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(promo)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition ${
                              promo.is_active
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {promo.is_active ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                            {promo.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>

                        <td className="py-4 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(promo)}
                              className="p-1.5 rounded-lg text-gray-600 hover:text-[var(--oppa-green)] hover:bg-gray-100 transition"
                              title="Edit promo"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(promo)}
                              className="p-1.5 rounded-lg text-gray-600 hover:text-red-600 hover:bg-red-50 transition"
                              title="Delete promo"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create / Edit Promo Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[var(--oppa-border)]">
              <div className="sticky top-0 bg-white border-b border-[var(--oppa-border)] px-6 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-50 text-[var(--oppa-green)]">
                    <Tag size={20} />
                  </div>
                  <h3 className="font-serif text-xl font-bold text-[var(--oppa-text)]">
                    {editingPromo ? 'Edit Promotion' : 'Create New Promotion'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {formError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle size={18} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                      Promo Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 10% Welcome Treat"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--oppa-border)] text-sm focus:ring-2 focus:ring-[var(--oppa-green)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                      Promo Code (Voucher)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. OPPA10, WEEKEND50"
                      value={code}
                      onChange={e => setCode(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--oppa-border)] text-sm font-mono uppercase focus:ring-2 focus:ring-[var(--oppa-green)] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief description displayed on the banner and promotional sections..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--oppa-border)] text-sm focus:ring-2 focus:ring-[var(--oppa-green)] focus:outline-none"
                  />
                </div>

                {/* Discount Type & Value */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                      Discount Type *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDiscountType('percent')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1 ${
                          discountType === 'percent'
                            ? 'bg-[var(--oppa-green)] text-white border-[var(--oppa-green)]'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <Percent size={13} /> Percent
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('fixed')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1 ${
                          discountType === 'fixed'
                            ? 'bg-[var(--oppa-green)] text-white border-[var(--oppa-green)]'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <DollarSign size={13} /> Fixed (₱)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                      Value {discountType === 'percent' ? '(%)' : '(₱)'} *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      placeholder={discountType === 'percent' ? '15' : '50'}
                      value={discountValue}
                      onChange={e => setDiscountValue(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--oppa-border)] text-sm font-semibold focus:ring-2 focus:ring-[var(--oppa-green)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                      Min. Order Spend (₱)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0"
                      value={minOrderAmount}
                      onChange={e => setMinOrderAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--oppa-border)] text-sm focus:ring-2 focus:ring-[var(--oppa-green)] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Validity Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                      Start Date & Time (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[var(--oppa-border)] text-sm focus:ring-2 focus:ring-[var(--oppa-green)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                      End Date & Time (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[var(--oppa-border)] text-sm focus:ring-2 focus:ring-[var(--oppa-green)] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Applicable Categories */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                    Applicable Categories (Leave empty for All)
                  </label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {categories.filter(c => c.id !== 'all').map(cat => {
                      const isSelected = selectedCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCategory(cat.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                            isSelected
                              ? 'bg-[var(--oppa-green)] text-white border-[var(--oppa-green)] font-semibold'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                    Optional Promo Banner Image
                  </label>
                  <div className="flex items-center gap-4">
                    {imagePreview ? (
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 shrink-0">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(null);
                          }}
                          className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 text-xs hover:bg-black"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 shrink-0">
                        <ImageIcon size={20} />
                        <span className="text-[10px] mt-1">No Image</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Activate Promo Immediately</p>
                    <p className="text-xs text-gray-500">When enabled, this promo will immediately show in the banner and be usable.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="w-5 h-5 accent-[var(--oppa-green)] rounded"
                  />
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--oppa-border)]">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-[var(--oppa-green)] text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 transition flex items-center gap-2"
                  >
                    {isSubmitting && <RefreshCw size={14} className="animate-spin" />}
                    {editingPromo ? 'Save Changes' : 'Create Promo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-[var(--oppa-border)]">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="font-serif text-lg font-bold text-gray-900">
                Delete "{deleteTarget.title}"?
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                Are you sure you want to delete this promotion? This action cannot be undone. Customers will no longer be able to use this promo code.
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 shadow-sm"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

