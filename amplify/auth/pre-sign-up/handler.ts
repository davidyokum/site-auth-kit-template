/** The preSignUp trigger's code: auth-kit's `preSignUpForAccountCreation`, with the site's setting. */
import { preSignUpForAccountCreation } from 'auth-kit/amplify/pre-sign-up';
import { site } from '../../../site.config';

export const handler = preSignUpForAccountCreation({ accountCreation: site.accountCreation });
