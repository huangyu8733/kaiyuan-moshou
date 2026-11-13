import type { ContactInfo } from "@/lib/db/schema";
import type { Messages } from "@/i18n/dictionaries/zh";
import { isContactEmpty } from "@/lib/db/queries/settings";

function mailto(value: string): string {
  return value.includes("@") ? `mailto:${value}` : value;
}

function asUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/** 联系信息：值来自后台 settings.contact，标签来自词典。 */
export function ContactPanel({ contact, dict }: { contact: ContactInfo; dict: Messages }) {
  if (isContactEmpty(contact)) return <p className="empty-state">{dict.contact.empty}</p>;

  const rows: Array<{ label: string; value: string; href?: string }> = [];
  if (contact.email) rows.push({ label: dict.contact.email, value: contact.email, href: mailto(contact.email) });
  if (contact.qqGroup) rows.push({ label: dict.contact.qqGroup, value: contact.qqGroup });
  if (contact.wechat) rows.push({ label: dict.contact.wechat, value: contact.wechat });
  if (contact.github) rows.push({ label: dict.contact.github, value: contact.github, href: asUrl(contact.github) });
  if (contact.discord) rows.push({ label: dict.contact.discord, value: contact.discord, href: asUrl(contact.discord) });

  return (
    <div className="contact-list">
      <dl>
        {rows.map((row) => (
          <div className="contact-row" key={row.label}>
            <dt>{row.label}</dt>
            <dd>
              {row.href ? (
                <a href={row.href} target={row.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {contact.note ? <p className="contact-note">{contact.note}</p> : null}
    </div>
  );
}
