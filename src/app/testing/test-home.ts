import {
  HomeSummaryDto,
  ItemDto,
  ItemSummaryDto,
  RoomDto,
} from '../core/models/outputs/home-output-dto';
import { PaginatedResult } from '../core/models/outputs/paginated-result-output-dto';

export const ROOM_ID = '0199f1a0-5555-7000-8000-000000000005';
export const OFFICE_ID = '0199f1a0-6666-7000-8000-000000000006';
export const ITEM_ID = '0199f1a0-7777-7000-8000-000000000007';
export const HOME_TODAY = '2026-10-14';

export function testRoom(changes: Partial<RoomDto> = {}): RoomDto {
  return {
    id: ROOM_ID,
    name: 'Kitchen',
    sortOrder: 1,
    itemCount: 1,
    totalValue: 899.99,
    createdAt: '2026-10-10T15:00:00Z',
    updatedAt: '2026-10-10T15:00:00Z',
    ...changes,
  };
}

/** A dishwasher in the kitchen, with a warranty to the end of 2027, without links. */
export function testItem(changes: Partial<ItemDto> = {}): ItemDto {
  return {
    id: ITEM_ID,
    name: 'Dishwasher',
    roomId: ROOM_ID,
    roomName: 'Kitchen',
    category: 'Appliance',
    brand: 'Bosch',
    model: 'SHX78',
    serialNumber: 'FD9901',
    quantity: 1,
    purchasedOn: '2025-11-09',
    purchasePrice: 899.99,
    currentValue: null,
    value: 899.99,
    warrantyUntil: '2027-11-09',
    notes: null,
    tags: [],
    createdAt: '2026-10-10T15:00:00Z',
    updatedAt: '2026-10-10T15:00:00Z',
    links: [],
    documents: [],
    maintenance: [],
    ...changes,
  };
}

export function testItemSummary(changes: Partial<ItemSummaryDto> = {}): ItemSummaryDto {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { documents, maintenance, ...summary } = testItem();
  return { ...summary, ...changes };
}

export function testHomeSummary(changes: Partial<HomeSummaryDto> = {}): HomeSummaryDto {
  return {
    date: HOME_TODAY,
    itemCount: 1,
    totalValue: 899.99,
    rooms: [{ roomId: ROOM_ID, name: 'Kitchen', itemCount: 1, totalValue: 899.99 }],
    warrantiesEnding: 0,
    ...changes,
  };
}

export function testItemPage(items: ItemSummaryDto[], totalCount = items.length) {
  return {
    items,
    page: 1,
    pageSize: 100,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / 100)),
    hasPreviousPage: false,
    hasNextPage: totalCount > 100,
  } satisfies PaginatedResult<ItemSummaryDto>;
}
