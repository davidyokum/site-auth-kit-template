export interface BackdropChoiceInput {
  style: string;
  seed: string;
  styleVersion: number;
}
export declare const CONFIG_FILE: string;
export declare const BACKUP_FILE: string;
export declare function validateChoice(value: unknown): BackdropChoiceInput;
export declare function formatBackdrop(choice: BackdropChoiceInput): string;
export declare function replaceBackdrop(source: string, choice: BackdropChoiceInput): { source: string; previous: string; next: string };
export declare function lockChoiceFor(site: { name: string; backdrop: unknown }): BackdropChoiceInput | null;
export declare function writeBackdropChoice(root: string, choice: unknown): Promise<{ previous: string; next: string; backup: string; file: string }>;
export declare function describeChange(result: { previous: string; next: string; backup: string }): string;
