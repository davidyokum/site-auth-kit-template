export declare const MODES: string[];
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
  mode?: string;
  domains?: string[] | string;
  requestsAlso?: boolean;
  privacyNoticeUrl?: string | null;
  ownerEmail?: string;
  ownerName?: string | null;
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
  accountCreation: { mode: string; domains?: string[]; requestsAlso?: boolean };
  privacyNoticeUrl: string | null;
  ownerEmail: string;
  ownerName: string | null;
}
export declare function slugify(name: string): string;
export declare function tsString(value: string): string;
export declare function checkAnswers(raw: SetupAnswersInput, context: SetupContext): { answers: SetupAnswers; problems: string[] };
export declare function helpSettingLiteral(setting: SetupAnswers['replyTo']): string;
export declare function accountCreationLiteral(setting: SetupAnswers['accountCreation']): string;
export declare function replaceConfigLine(text: string, indent: string, key: string, literal: string, typeSuffix?: string): string;
export declare function applyAnswers(text: string, answers: SetupAnswers): string;
export declare function applyPersonaDomain(text: string, project: string): string;
export declare function describeAnswers(answers: SetupAnswers): string[];
