/** A quick note in the Inbox (Hestia.Api, Inbox module, T18). Open while `doneAt` is null. */
export interface InboxItemDto {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  doneAt: string | null;
  /** Where the note went when it was sorted, for example `Task` or `Journal`; null for none. */
  sortedTo: string | null;
}
