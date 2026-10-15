/** One thing that matches a search (Hestia.Api, Search module, T17). Days are `yyyy-MM-dd`. */
export interface SearchHit {
  id: string;
  module: string;
  /** `transaction`, `document`, `task`, `item`, `person`, `entry`. The icon follows it. */
  kind: string;
  title: string;
  text: string | null;
  day: string | null;
  /** Money in is positive. */
  amount: number | null;
  /** The web route of the thing. */
  link: string | null;
}

export type SearchModuleStatus = 'Complete' | 'Failed';

/** The hits of one module; `total` is all its matches (more than the hits when there are more). */
export interface SearchModuleDto {
  module: string;
  status: SearchModuleStatus;
  total: number;
  hits: SearchHit[];
}

/** The answer of a search: each module in order (Money first), with hits or not. */
export interface SearchDto {
  query: string;
  total: number;
  modules: SearchModuleDto[];
}
