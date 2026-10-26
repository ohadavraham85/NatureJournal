/* views/view.ts — shared view contract. */

export interface ViewParams {
  /** form: the report being edited (absent = new report). */
  editId?: string;
  /** form: a new report pre-filled from the species catalog. */
  prefillCategory?: string;
  prefillSpecies?: string;
  prefillTaxonId?: number;
  /** detail: the report to show. */
  viewId?: string;
  /** journal: pre-applied category filter / search text. */
  category?: string;
  search?: string;
  /** settings: which section to open (absent = the section list). */
  section?: string;
  /** settings: a journal code from an invite link, to offer joining. */
  join?: string;
}

export interface View {
  init(el: HTMLElement): void;
  activate(): void | Promise<void>;
  setParams?(params: ViewParams): void;
  /** Called right before navigation switches to a different view. */
  deactivate?(): void;
}
