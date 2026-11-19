export declare const MODES: string[];
export declare const SIGN_IN_MODES: string[];
export declare const SIGN_IN_MODE_LABEL: { full: string; simple: string };
export type SetupSignIn = { mode: 'full' } | { mode: 'simple'; stay: 'browser' | number };
export declare function parseStay(value: unknown): 'browser' | number | null;
export declare function signInLiteral(setting: SetupSignIn): string;
export declare function describeSignIn(setting: SetupSignIn): string;
export interface SetupContext {
  familyHelpMailbox: Record<string, string | null>;
  familySender: Record<string, string | null>;
  families: readonly string[];
  namesOwner: Record<string, boolean>;
}
export interface SetupAnswersInput {
  name?: string;
  family?: string;
  sender?: string;
  help?: string;
  helpPersonal?: boolean;
  /** 'full' (the default) or 'simple' (auth-kit ADR 0029). */
  signIn?: string;
  /** On Simple: 'every visit' / 'browser', or a number of days (default 30). */
  stay?: string | number;
  /** site.config.ts `tier` (the stay's ceiling: 30 days on Tier 2, 1 on Tier 3). Default 2. */
  tier?: 2 | 3;
  mode?: string;
  domains?: string[] | string;
  requestsAlso?: boolean;
  privacyNoticeUrl?: string | null;
  ownerEmail?: string;
  ownerName?: string | null;
  address?: string | null;
  /** `style:seed:version`, as the picker shows it. */
  backdrop?: string | null;
}
export interface SetupAnswers {
  name: string;
  project: string;
  family: string;
  /** null: the family's shared sender. */
  fromAddress: string | null;
  sender: string;
  /** null: the family's mailbox; an object: a person's own address, acknowledged. */
  replyTo: string | { address: string; personal: true } | null;
  help: string;
  helpPersonal: boolean;
  signIn: SetupSignIn;
  accountCreation: { mode: string; domains?: string[]; requestsAlso?: boolean };
  privacyNoticeUrl: string | null;
  ownerEmail: string;
  ownerName: string | null;
  address: string | null;
  backdrop: { style: string; seed: string; styleVersion: number } | null;
}
export interface OwnerDecision {
  key: 'name' | 'address' | 'backdrop' | 'signIn' | 'stay' | 'mode' | 'ownerEmail';
  flag: string;
  question: string;
  /** Asked only when this holds (the stay: only on Simple). */
  onlyWhen?: (given: Record<string, unknown>) => boolean;
}
export declare const OWNER_DECISIONS: readonly OwnerDecision[];
export declare function openOwnerQuestions(given: Record<string, unknown>): OwnerDecision[];
export declare function addressProblem(value: string): string | null;
export declare function defaultAddress(family: string, project: string): string;
export declare function slugify(name: string): string;
export declare function tsString(value: string): string;
export declare function checkAnswers(raw: SetupAnswersInput, context: SetupContext): { answers: SetupAnswers; problems: string[] };
export declare function helpSettingLiteral(setting: SetupAnswers['replyTo']): string;
export declare function accountCreationLiteral(setting: SetupAnswers['accountCreation']): string;
export declare function replaceConfigLine(text: string, indent: string, key: string, literal: string, typeSuffix?: string): string;
export declare function applyAnswers(text: string, answers: SetupAnswers): string;
export declare function applyPersonaDomain(text: string, project: string): string;
export declare function describeAnswers(answers: SetupAnswers): string[];
