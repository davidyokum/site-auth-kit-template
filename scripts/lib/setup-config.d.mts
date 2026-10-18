export declare const MODES: string[];
export interface SetupContext {
  familyHelpMailbox: Record<string, string | null>;
  families: readonly string[];
  namesOwner: Record<string, boolean>;
}
export interface SetupAnswersInput {
  name?: string;
  family?: string;
  help?: string;
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
  replyTo: string | null;
  help: string;
  accountCreation: { mode: string; domains?: string[]; requestsAlso?: boolean };
  privacyNoticeUrl: string | null;
  ownerEmail: string;
  ownerName: string | null;
}
export declare function slugify(name: string): string;
export declare function tsString(value: string): string;
export declare function checkAnswers(raw: SetupAnswersInput, context: SetupContext): { answers: SetupAnswers; problems: string[] };
export declare function accountCreationLiteral(setting: SetupAnswers['accountCreation']): string;
export declare function replaceConfigLine(text: string, indent: string, key: string, literal: string, typeSuffix?: string): string;
export declare function applyAnswers(text: string, answers: SetupAnswers): string;
export declare function applyPersonaDomain(text: string, project: string): string;
export declare function describeAnswers(answers: SetupAnswers): string[];
