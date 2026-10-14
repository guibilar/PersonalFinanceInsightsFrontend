/** A new room, or the new name of a room. Without `sortOrder`, a new room goes last and a room keeps its place. */
export interface RoomInputDto {
  name: string;
  sortOrder?: number | null;
}

/**
 * The details of an item: for `POST /api/home/items`, and for `PUT /api/home/items/{id}`. A `PUT` replaces all of
 * them: a value that is not sent becomes empty (the quantity becomes 1). The links do not change with a `PUT`.
 */
export interface ItemDetailsInputDto {
  name: string;
  roomId: string | null;
  category: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  quantity: number | null;
  /** A day, `yyyy-MM-dd`. */
  purchasedOn: string | null;
  /** The price of one item. */
  purchasePrice: number | null;
  /** The value of one item now. */
  currentValue: number | null;
  warrantyUntil: string | null;
  notes: string | null;
  tags: string[];
}

/** A new link of an item: `Documents.Document`, `Money.Transaction`, or `Tasks.Task`, with the id of the thing. */
export interface ItemLinkInputDto {
  kind: string;
  targetId: string;
}

/** A new item: its details, and links to make at once (for example its purchase). */
export interface CreateItemInputDto extends ItemDetailsInputDto {
  links?: ItemLinkInputDto[];
}

/** `active` includes `expiring` (it ends today or later). `expiring`: from today to 30 days ahead. */
export type WarrantyFilter = 'active' | 'expiring' | 'expired';

/** The filters of the item list (`GET /api/home/items`) and of the export. Empty values are not sent. */
export interface ItemListQuery {
  /** A room id, or `none` for the items without a room. */
  room?: string | null;
  category?: string | null;
  tag?: string | null;
  /** Words in the name, brand, model, serial number, category, notes, or tags. */
  q?: string | null;
  warranty?: WarrantyFilter | null;
  page?: number;
  /** 1 to 100. */
  pageSize?: number;
}
