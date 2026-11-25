'use client';

import type { ActionResult, FormAction } from 'auth-kit/admin';
import { ActionResultMessage } from 'auth-kit/admin/ui';
import { type ReactNode, useActionState, useState } from 'react';
import type { EmailPreviewSpec } from '@/lib/admin-stores';

export interface SettingsEmailsWorkspaceProps {
  readonly signInHelpNode: ReactNode;
  readonly emails: readonly EmailPreviewSpec[];
  readonly welcomeNote: string | null;
  readonly welcomeVersion: number;
  readonly saveWelcomeAction: FormAction;
  readonly stepUpHref: string;
}

export function SettingsEmailsWorkspace(props: SettingsEmailsWorkspaceProps) {
  const [selectedId, setSelectedId] = useState(props.emails[0]?.id ?? 'invite');
  const [welcomeDraft, setWelcomeDraft] = useState(props.welcomeNote ?? '');
  const [saveState, formAction] = useActionState<ActionResult | null, FormData>(props.saveWelcomeAction, null);

  const selected = props.emails.find((e) => e.id === selectedId) ?? props.emails[0];

  return (
    <div className="admin-surface stack">
      <section className="admin-section-block">
        <h2>Sign-in help address</h2>
        {props.signInHelpNode}
      </section>

      <section className="admin-section-block">
        <h2>Outgoing email studio</h2>
        <p className="admin-muted-note">
          Live preview of every transactional message sent by this site. Previews render directly as semantic DOM with zero raw HTML injection.
        </p>

        <div className="admin-email-studio">
          <div className="admin-email-list" role="tablist" aria-label="Site email templates">
            {props.emails.map((email) => (
              <button
                key={email.id}
                type="button"
                role="tab"
                aria-selected={email.id === selected?.id}
                className={`admin-email-item${email.id === selected?.id ? ' is-active' : ''}`}
                onClick={() => setSelectedId(email.id)}
              >
                <strong>{email.name}</strong>
                <span>{email.trigger}</span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="admin-email-preview">
              <div className="admin-email-meta">
                <div><strong>Subject:</strong> {selected.subject}</div>
                <div className="admin-muted-note">{selected.trigger}</div>
              </div>
              <div className="admin-email-sheet">
                {selected.paragraphs.map((p, i) => (
                  <p key={i}>
                    {selected.editableNote && i === 0 && welcomeDraft.trim().length > 0
                      ? welcomeDraft.trim()
                      : p}
                  </p>
                ))}
                {selected.ctaLabel && (
                  <div className="admin-email-cta">{selected.ctaLabel}</div>
                )}
                <div className="admin-email-footer">{selected.footer}</div>
              </div>

              {selected.editableNote && (
                <form action={formAction} className="admin-panel-section">
                  <input type="hidden" name="expectedVersion" value={String(props.welcomeVersion)} />
                  <label className="admin-field-label">
                    Custom invitation welcome paragraph (optional)
                    <textarea
                      name="note"
                      rows={3}
                      className="admin-sharp-input"
                      placeholder="Leave blank to use the default invitation greeting..."
                      value={welcomeDraft}
                      onChange={(e) => setWelcomeDraft(e.target.value)}
                    />
                  </label>
                  <button type="submit" className="admin-primary-btn">
                    Save welcome paragraph
                  </button>
                  <ActionResultMessage result={saveState} stepUpHref={props.stepUpHref} />
                </form>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
