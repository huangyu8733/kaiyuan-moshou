import { notFound } from "next/navigation";
import { getDictionary, isLocale } from "@/i18n/config";
import { getContact } from "@/lib/db/queries/settings";
import { ContactPanel } from "@/components/site/ContactPanel";

export const dynamic = "force-dynamic";

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);
  const contact = getContact();

  return (
    <section className="section section--page">
      <h1 className="ow3-heading">{dict.contact.title}</h1>
      <p className="section__lede">{dict.contact.lede}</p>
      <div className="ow3-panel contact-panel">
        <ContactPanel contact={contact} dict={dict} />
      </div>
    </section>
  );
}
