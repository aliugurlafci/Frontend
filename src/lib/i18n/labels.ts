/**
 * Metadata label translations (entities, fields, enum values).
 *
 * EN is the source of truth (the metadata `label`/`pluralLabel`/option labels),
 * so only TR and DE are tabulated here. Every helper falls back to the English
 * metadata label, so untranslated keys degrade gracefully rather than breaking.
 */
import type { EntityDef, FieldDef } from "@/lib/metadata/types";
import type { Locale } from "./config";

type Pair = { s: string; p: string };

/** Entity singular/plural per locale, keyed by entity name. */
const ENTITY: Record<"tr" | "de", Record<string, Pair>> = {
  tr: {
    lead: { s: "Aday", p: "Adaylar" },
    account: { s: "Hesap", p: "Hesaplar" },
    contact: { s: "Kişi", p: "Kişiler" },
    deal: { s: "Fırsat", p: "Fırsatlar" },
    task: { s: "Görev", p: "Görevler" },
    proposal: { s: "Teklif", p: "Teklifler" },
    estimation: { s: "Tahmin", p: "Tahminler" },
    contract: { s: "Sözleşme", p: "Sözleşmeler" },
    salesOrder: { s: "Satış Siparişi", p: "Satış Siparişleri" },
    quote: { s: "Teklif", p: "Teklifler" },
    quoteLine: { s: "Teklif Satırı", p: "Teklif Satırları" },
    invoice: { s: "Fatura", p: "Faturalar" },
    invoiceLine: { s: "Fatura Satırı", p: "Fatura Satırları" },
    project: { s: "Proje", p: "Projeler" },
    milestone: { s: "Kilometre Taşı", p: "Kilometre Taşları" },
    timesheet: { s: "Zaman Çizelgesi", p: "Zaman Çizelgeleri" },
    campaign: { s: "Kampanya", p: "Kampanyalar" },
    ticket: { s: "Destek Talebi", p: "Destek Talepleri" },
    department: { s: "Departman", p: "Departmanlar" },
    employee: { s: "Çalışan", p: "Personel" },
    product: { s: "Ürün", p: "Ürünler" },
    currency: { s: "Para Birimi", p: "Para Birimleri" },
    taxRate: { s: "Vergi Oranı", p: "Vergi Oranları" },
    payment: { s: "Ödeme", p: "Ödemeler" },
    recurringPlan: { s: "Tekrarlayan Plan", p: "Tekrarlayan Planlar" },
    note: { s: "Not", p: "Notlar" },
    todo: { s: "Yapılacak", p: "Yapılacaklar" },
    call: { s: "Arama", p: "Aramalar" },
    post: { s: "Gönderi", p: "Sosyal Akış" },
    file: { s: "Dosya", p: "Dosyalar" },
    chatMessage: { s: "Mesaj", p: "Mesajlar" },
    position: { s: "Pozisyon", p: "Pozisyonlar" },
    user: { s: "Kullanıcı", p: "Kullanıcılar" },
  },
  de: {
    lead: { s: "Lead", p: "Leads" },
    account: { s: "Konto", p: "Konten" },
    contact: { s: "Kontakt", p: "Kontakte" },
    deal: { s: "Geschäft", p: "Geschäfte" },
    task: { s: "Aufgabe", p: "Aufgaben" },
    proposal: { s: "Angebot", p: "Angebote" },
    estimation: { s: "Schätzung", p: "Schätzungen" },
    contract: { s: "Vertrag", p: "Verträge" },
    salesOrder: { s: "Auftrag", p: "Aufträge" },
    quote: { s: "Angebot", p: "Angebote" },
    quoteLine: { s: "Angebotsposition", p: "Angebotspositionen" },
    invoice: { s: "Rechnung", p: "Rechnungen" },
    invoiceLine: { s: "Rechnungsposition", p: "Rechnungspositionen" },
    project: { s: "Projekt", p: "Projekte" },
    milestone: { s: "Meilenstein", p: "Meilensteine" },
    timesheet: { s: "Zeiterfassung", p: "Zeiterfassungen" },
    campaign: { s: "Kampagne", p: "Kampagnen" },
    ticket: { s: "Ticket", p: "Tickets" },
    department: { s: "Abteilung", p: "Abteilungen" },
    employee: { s: "Mitarbeiter", p: "Personal" },
    product: { s: "Produkt", p: "Produkte" },
    currency: { s: "Währung", p: "Währungen" },
    taxRate: { s: "Steuersatz", p: "Steuersätze" },
    payment: { s: "Zahlung", p: "Zahlungen" },
    recurringPlan: { s: "Abo-Plan", p: "Abo-Pläne" },
    note: { s: "Notiz", p: "Notizen" },
    todo: { s: "Aufgabe", p: "To-Dos" },
    call: { s: "Anruf", p: "Anrufe" },
    post: { s: "Beitrag", p: "Social Feed" },
    file: { s: "Datei", p: "Dateien" },
    chatMessage: { s: "Nachricht", p: "Nachrichten" },
    position: { s: "Position", p: "Positionen" },
    user: { s: "Benutzer", p: "Benutzer" },
  },
};

/** Field labels by field name (shared across entities). */
const FIELD: Record<"tr" | "de", Record<string, string>> = {
  tr: {
    name: "Ad", firstName: "Ad", lastName: "Soyad", email: "E-posta", phone: "Telefon",
    title: "Başlık", company: "Şirket", status: "Durum", source: "Kaynak", stage: "Aşama",
    amount: "Tutar", probability: "Olasılık", closeDate: "Kapanış Tarihi", dueDate: "Son Tarih",
    notes: "Notlar", subject: "Konu", description: "Açıklama", currencyCode: "Para Birimi",
    taxRate: "Vergi Oranı", unitPrice: "Birim Fiyat", qty: "Adet", lineTotal: "Satır Toplamı",
    subtotal: "Ara Toplam", taxTotal: "Vergi Toplamı", total: "Toplam", issueDate: "Düzenleme Tarihi",
    validUntil: "Geçerlilik", paidAt: "Ödeme Tarihi", method: "Yöntem", accountId: "Hesap",
    dealId: "Fırsat", projectId: "Proje", invoiceId: "Fatura", quoteId: "Teklif",
    departmentId: "Departman", owner: "Sahip", active: "Aktif", industry: "Sektör", website: "Web Sitesi",
    annualRevenue: "Yıllık Gelir", employees: "Çalışan Sayısı", sku: "Stok Kodu", budget: "Bütçe",
    progress: "İlerleme", startDate: "Başlangıç", endDate: "Bitiş", priority: "Öncelik",
    assignee: "Atanan", channel: "Kanal", sent: "Gönderilen", head: "Yönetici", headcount: "Kişi Sayısı",
    number: "Numara", balance: "Bakiye", amountPaid: "Ödenen", frequency: "Sıklık", nextRun: "Sonraki Çalışma",
    role: "Rol", screens: "Ekranlar", positionId: "Pozisyon", displayName: "Ad", peer: "Kişi", body: "İçerik",
    folder: "Klasör", sizeKb: "Boyut (KB)", unread: "Okunmadı", sender: "Gönderen/Alıcı",
    region: "Bölge", rate: "Oran", date: "Tarih", hours: "Saat", billable: "Faturalanabilir",
    estimatedValue: "Tahmini Değer", expiryDate: "Son Geçerlilik", orderDate: "Sipariş Tarihi", value: "Değer",
  },
  de: {
    name: "Name", firstName: "Vorname", lastName: "Nachname", email: "E-Mail", phone: "Telefon",
    title: "Titel", company: "Firma", status: "Status", source: "Quelle", stage: "Phase",
    amount: "Betrag", probability: "Wahrscheinlichkeit", closeDate: "Abschlussdatum", dueDate: "Fällig am",
    notes: "Notizen", subject: "Betreff", description: "Beschreibung", currencyCode: "Währung",
    taxRate: "Steuersatz", unitPrice: "Stückpreis", qty: "Menge", lineTotal: "Positionssumme",
    subtotal: "Zwischensumme", taxTotal: "Steuer", total: "Gesamt", issueDate: "Rechnungsdatum",
    validUntil: "Gültig bis", paidAt: "Bezahlt am", method: "Methode", accountId: "Konto",
    dealId: "Geschäft", projectId: "Projekt", invoiceId: "Rechnung", quoteId: "Angebot",
    departmentId: "Abteilung", owner: "Inhaber", active: "Aktiv", industry: "Branche", website: "Website",
    annualRevenue: "Jahresumsatz", employees: "Mitarbeiter", sku: "Artikelnr.", budget: "Budget",
    progress: "Fortschritt", startDate: "Beginn", endDate: "Ende", priority: "Priorität",
    assignee: "Zugewiesen", channel: "Kanal", sent: "Gesendet", head: "Leitung", headcount: "Personalzahl",
    number: "Nummer", balance: "Saldo", amountPaid: "Bezahlt", frequency: "Häufigkeit", nextRun: "Nächster Lauf",
    role: "Rolle", screens: "Bildschirme", positionId: "Position", displayName: "Name", peer: "Kontakt", body: "Inhalt",
    folder: "Ordner", sizeKb: "Größe (KB)", unread: "Ungelesen", sender: "Von/An",
    region: "Region", rate: "Satz", date: "Datum", hours: "Stunden", billable: "Abrechenbar",
    estimatedValue: "Geschätzter Wert", expiryDate: "Ablaufdatum", orderDate: "Bestelldatum", value: "Wert",
  },
};

/** Entity-specific field overrides (`entity.field`) where a shared name is ambiguous. */
const FIELD_OVERRIDE: Record<"tr" | "de", Record<string, string>> = {
  tr: { "employee.title": "İş Unvanı" },
  de: { "employee.title": "Position" },
};

/** Enum option labels by value (shared across entities). */
const ENUM: Record<"tr" | "de", Record<string, string>> = {
  tr: {
    active: "Aktif", inactive: "Pasif", on_leave: "İzinde",
    lead: "Aday", qualified: "Nitelikli", proposal: "Teklif", negotiation: "Pazarlık", won: "Kazanıldı", lost: "Kaybedildi",
    new: "Yeni", working: "Çalışılıyor", converted: "Dönüştürüldü",
    open: "Açık", done: "Tamamlandı", draft: "Taslak", sent: "Gönderildi", accepted: "Kabul Edildi",
    paid: "Ödendi", partial: "Kısmi", overdue: "Gecikmiş", void: "İptal",
    pending: "Beklemede", confirmed: "Onaylandı", completed: "Tamamlandı", cancelled: "İptal Edildi",
    running: "Devam Ediyor", scheduled: "Planlandı", planning: "Planlama", in_progress: "Devam Ediyor",
    high: "Yüksek", medium: "Orta", low: "Düşük", urgent: "Acil", resolved: "Çözüldü",
    email: "E-posta", social: "Sosyal", sms: "SMS", whatsapp: "WhatsApp", web: "Web", referral: "Tavsiye",
    bank: "Banka", card: "Kart", cash: "Nakit",
    monthly: "Aylık", weekly: "Haftalık", quarterly: "Üç Aylık", yearly: "Yıllık",
    admin: "Yönetici", sales_manager: "Satış Müdürü", sales_rep: "Satış Temsilcisi", accountant: "Muhasebeci",
    technology: "Teknoloji", healthcare: "Sağlık", manufacturing: "Üretim", finance: "Finans",
  },
  de: {
    active: "Aktiv", inactive: "Inaktiv", on_leave: "Beurlaubt",
    lead: "Lead", qualified: "Qualifiziert", proposal: "Angebot", negotiation: "Verhandlung", won: "Gewonnen", lost: "Verloren",
    new: "Neu", working: "In Bearbeitung", converted: "Konvertiert",
    open: "Offen", done: "Erledigt", draft: "Entwurf", sent: "Gesendet", accepted: "Angenommen",
    paid: "Bezahlt", partial: "Teilweise", overdue: "Überfällig", void: "Storniert",
    pending: "Ausstehend", confirmed: "Bestätigt", completed: "Abgeschlossen", cancelled: "Storniert",
    running: "Läuft", scheduled: "Geplant", planning: "Planung", in_progress: "In Bearbeitung",
    high: "Hoch", medium: "Mittel", low: "Niedrig", urgent: "Dringend", resolved: "Gelöst",
    email: "E-Mail", social: "Social", sms: "SMS", whatsapp: "WhatsApp", web: "Web", referral: "Empfehlung",
    bank: "Bank", card: "Karte", cash: "Bar",
    monthly: "Monatlich", weekly: "Wöchentlich", quarterly: "Vierteljährlich", yearly: "Jährlich",
    admin: "Administrator", sales_manager: "Vertriebsleiter", sales_rep: "Vertriebsmitarbeiter", accountant: "Buchhalter",
    technology: "Technologie", healthcare: "Gesundheit", manufacturing: "Fertigung", finance: "Finanzen",
  },
};

/** Localized entity label (singular or plural), falling back to the metadata label. */
export function entityLabel(def: EntityDef, locale: Locale, opts?: { plural?: boolean }): string {
  const plural = opts?.plural ?? false;
  if (locale === "en") return plural ? def.pluralLabel : def.label;
  const pair = ENTITY[locale]?.[def.name];
  if (pair) return plural ? pair.p : pair.s;
  return plural ? def.pluralLabel : def.label;
}

/** Localized field label, falling back to the metadata label. */
export function fieldLabel(field: FieldDef, locale: Locale, entityName?: string): string {
  if (locale === "en") return field.label;
  if (entityName) {
    const override = FIELD_OVERRIDE[locale]?.[`${entityName}.${field.name}`];
    if (override) return override;
  }
  return FIELD[locale]?.[field.name] ?? field.label;
}

/** Localized enum option label, falling back to the option's English label. */
export function enumLabel(field: FieldDef, value: string | null | undefined, locale: Locale): string {
  const raw = value == null ? "" : String(value);
  const english = field.options?.find((o) => o.value === raw)?.label ?? raw;
  if (locale === "en" || !raw) return english;
  return ENUM[locale]?.[raw] ?? english;
}
