// src/utils/addressParser.ts

import type { ParsedAddressResult } from '../types/address.types';

// Configurable regex patterns
const PATTERNS = {
  block: /(?:Block|Blk)\s*\.?\s*(\d+[A-Z]?|\d+-\d+)/i,
  lot: /(?:Lot|Lt)\s*\.?\s*(\d+[A-Z]?|\d+-\d+)/i,
  phase: /(?:Phase|Ph)\s*\.?\s*(\d+[A-Z]?|\d+-\d+)/i,
  subdivision: /([A-Za-z\s]+)(?:Subdivision|Subd|Village|Homes|Estates?)/i,
  street: /(\d+\s+)?([A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Blvd|Highway|Hwy))/i,
  barangay: /(?:Brgy|Barangay)\.?\s*([^,\d]+?)(?=\d|,|$)/i,
  city: /(Dasmariñas|Imus|Bacoor|General Trias|Silang|Tagaytay|Trece Martires|Carmona|Naic|Tanza)/i,
};

export const parseAddressText = (text: string): ParsedAddressResult => {
  const result: ParsedAddressResult = {
    success: false,
    block: '',
    lot: '',
    phase: '',
    subdivision: '',
    street: '',
    barangay: '',
    city: '',
    confidence: 0,
  };

  let confidence = 0;

  // Extract block
  const blockMatch = text.match(PATTERNS.block);
  if (blockMatch) {
    result.block = `Block ${blockMatch[1]}`;
    confidence += 15;
  }

  // Extract lot
  const lotMatch = text.match(PATTERNS.lot);
  if (lotMatch) {
    result.lot = `Lot ${lotMatch[1]}`;
    confidence += 15;
  }

  // Extract phase
  const phaseMatch = text.match(PATTERNS.phase);
  if (phaseMatch) {
    result.phase = `Phase ${phaseMatch[1]}`;
    confidence += 10;
  }

  // Extract subdivision
  const subdMatch = text.match(PATTERNS.subdivision);
  if (subdMatch) {
    result.subdivision = subdMatch[1]?.trim() || '';
    confidence += 20;
  }

  // Extract street
  const streetMatch = text.match(PATTERNS.street);
  if (streetMatch) {
    result.street = streetMatch[2]?.trim() || '';
    confidence += 10;
  }

  // Extract barangay
  const barangayMatch = text.match(PATTERNS.barangay);
  if (barangayMatch) {
    result.barangay = barangayMatch[1]?.trim() || '';
    confidence += 10;
  }

  // Extract city
  const cityMatch = text.match(PATTERNS.city);
  if (cityMatch) {
    result.city = cityMatch[1];
    confidence += 10;
  }

  result.success = confidence > 30;
  result.confidence = confidence;

  return result;
};

// Format address with block and lot for display
export const formatFullAddress = (address: {
  block?: string;
  lot?: string;
  phase?: string;
  subdivision?: string;
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
}): string => {
  const parts = [];

  if (address.block && address.lot) {
    parts.push(`${address.block} ${address.lot}`);
  } else if (address.block) {
    parts.push(address.block);
  } else if (address.lot) {
    parts.push(address.lot);
  }

  if (address.phase) parts.push(address.phase);
  if (address.subdivision) parts.push(`${address.subdivision} Subdivision`);
  if (address.street) parts.push(address.street);
  if (address.barangay) parts.push(`Brgy. ${address.barangay}`);
  if (address.city) parts.push(address.city);
  if (address.province) parts.push(address.province);

  return parts.join(', ');
};

// Short version para sa driver
export const formatDriverInstructions = (address: {
  block?: string;
  lot?: string;
  phase?: string;
  subdivision?: string;
  landmark?: string;
}): string => {
  const parts = [];

  if (address.block && address.lot) {
    parts.push(`📍 ${address.block} ${address.lot}`);
  }
  if (address.phase) parts.push(`🏘️ ${address.phase}`);
  if (address.subdivision) parts.push(`🏠 ${address.subdivision} Subd.`);
  if (address.landmark) parts.push(`⭐ ${address.landmark}`);

  return parts.join(' → ');
};