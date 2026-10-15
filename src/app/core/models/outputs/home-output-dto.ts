/**
 * The Home module of Hestia.Api (`/api/home`): rooms and the items in them. Written by hand from the contracts in
 * HestiaBackend (`Hestia.Modules.Home.Contracts/HomeDtos.cs`). Amounts are numbers in the one app currency (CAD).
 */

/** The link kind of a Home item, for the links of documents and tasks (`Home.Item`). */
export const HOME_ITEM_LINK = 'Home.Item';

/** The link kinds of an item. */
export const ITEM_DOCUMENT_LINK = 'Documents.Document';
export const ITEM_TRANSACTION_LINK = 'Money.Transaction';
export const ITEM_TASK_LINK = 'Tasks.Task';

/** A room, with its item count and the total value of its items. In list order (`sortOrder`). */
export interface RoomDto {
  id: string;
  /** Unique in any letter case, at most 100 characters. */
  name: string;
  sortOrder: number;
  itemCount: number;
  totalValue: number;
  createdAt: string;
  updatedAt: string;
}

/** A link from an item to a document, a transaction, or a task. */
export interface ItemLinkDto {
  id: string;
  /** `Documents.Document`, `Money.Transaction`, or `Tasks.Task`. */
  kind: string;
  targetId: string;
  createdAt: string;
}

/** An item in a list. */
export interface ItemSummaryDto {
  id: string;
  name: string;
  roomId: string | null;
  roomName: string | null;
  category: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  /** 1 or more. */
  quantity: number;
  /** A day, `yyyy-MM-dd`. */
  purchasedOn: string | null;
  /** The price of one item. */
  purchasePrice: number | null;
  /** The value of one item now. */
  currentValue: number | null;
  /** The value of the row: (current value, else purchase price, else 0) × quantity. The totals use it. */
  value: number;
  /** The last day of the warranty, `yyyy-MM-dd`. */
  warrantyUntil: string | null;
  notes: string | null;
  /** In lower case. */
  tags: string[];
  createdAt: string;
  updatedAt: string;
  /** The item's own links, oldest first. */
  links: ItemLinkDto[];
}

/** A document of an item, linked from either side. */
export interface ItemDocumentDto {
  id: string;
  title: string;
  /** For example `Receipt`, `Warranty`, `Manual`. */
  kind: string;
  expiresOn: string | null;
}

/** A task of an item (maintenance), linked from either side. */
export interface ItemTaskDto {
  id: string;
  title: string;
  /** `Open` or `Done`. */
  status: string;
  /** The next due date, `yyyy-MM-dd`. */
  dueOn: string | null;
  repeatEvery: number | null;
  /** `Days`, `Weeks`, `Months`, or `Years`, or null. */
  repeatUnit: string | null;
  lastDoneAt: string | null;
}

/** One item, with its documents (by title) and its maintenance tasks (by due date). */
export interface ItemDto extends ItemSummaryDto {
  documents: ItemDocumentDto[];
  maintenance: ItemTaskDto[];
}

/** A category in use and how many items have it (`GET /api/home/categories`, T89). */
export interface CategoryCountDto {
  name: string;
  count: number;
}

/**
 * One maintenance task of one item (`GET /api/home/maintenance`, T89): an open task linked to the item from either
 * side. A task linked to two items comes twice.
 */
export interface MaintenanceDto {
  taskId: string;
  title: string;
  /** `yyyy-MM-dd`, or null. */
  dueOn: string | null;
  repeatEvery: number | null;
  /** `Days`, `Weeks`, `Months`, or `Years`, for a repeated task. */
  repeatUnit: string | null;
  lastDoneAt: string | null;
  itemId: string;
  itemName: string;
  roomName: string | null;
}

/** The items of one room in the summary. `roomId` and `name` are null for the items without a room. */
export interface RoomCountDto {
  roomId: string | null;
  name: string | null;
  itemCount: number;
  totalValue: number;
}

/** The numbers of the Home page (`GET /api/home/summary`). */
export interface HomeSummaryDto {
  /** Today in the time zone of the server (`Home:TimeZone`), `yyyy-MM-dd`. */
  date: string;
  /** Rows, not the quantity. */
  itemCount: number;
  totalValue: number;
  /** Each room in list order (also an empty one), then the items without a room (only when there are some). */
  rooms: RoomCountDto[];
  /** The warranties that end today or in the next 30 days. */
  warrantiesEnding: number;
}
