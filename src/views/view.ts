/* views/view.ts — shared view contract. */

export interface ViewParams {
  /** form: the report being edited (absent = new report). */
  editId?: string;
  /** detail: the report to show. */
  viewId?: string;
  /** journal: pre-applied category filter / search text. */
  category?: string;
  search?: string;
}

export interface View {
  init(el: HTMLElement): void;
  activate(): void | Promise<void>;
  setParams?(params: ViewParams): void;
  /** Called right before navigation switches to a different view. */
  deactivate?(): void;
}
