/** A quick note in the Inbox (Hestia.Api, Inbox module, T18). Open while `doneAt` is null. */
export interface InboxItemDto {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  doneAt: string | null;
  /** Where the note went when it was sorted, for example `Task` or `Journal`; null for none. */
  sortedTo: string | null;
  /** How the note came in: written, or an email to the Inbox mailbox (T102). */
  source?: InboxSource;
  /** The sender of an email note. */
  from?: string | null;
  /** The documents made from the attachments of an email. */
  documentIds?: string[] | null;
}

export type InboxSource = 'Note' | 'Email';
