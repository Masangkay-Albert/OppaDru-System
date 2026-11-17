import assert from 'node:assert/strict';
import test from 'node:test';
import { getDeviceStoreHoursStatus } from '../src/utils/storeHoursClock.ts';

const configuredHours = {
  opening: '11:00 AM',
  last_order: '10:30 PM',
  closing: '11:00 PM',
  timezone: 'Asia/Manila',
};

test('device time reaching store closing marks ordering closed', () => {
  const status = getDeviceStoreHoursStatus(configuredHours, new Date('2026-11-17T15:00:00.000Z'));

  assert.equal(status.state, 'closed');
  assert.equal(status.next_opening_label, 'Opens tomorrow at 11:00 AM');
});

test('device time before closing retains open and last-order states', () => {
  const beforeOpeningStatus = getDeviceStoreHoursStatus(configuredHours, new Date('2026-11-17T02:59:00.000Z'));
  const openingStatus = getDeviceStoreHoursStatus(configuredHours, new Date('2026-11-17T03:00:00.000Z'));
  const openStatus = getDeviceStoreHoursStatus(configuredHours, new Date('2026-11-17T13:00:00.000Z'));
  const lastOrderStatus = getDeviceStoreHoursStatus(configuredHours, new Date('2026-11-17T14:45:00.000Z'));

  assert.equal(beforeOpeningStatus.state, 'closed');
  assert.equal(openingStatus.state, 'open');
  assert.equal(openStatus.state, 'open');
  assert.equal(lastOrderStatus.state, 'last_order_passed');
});
