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
    branch: { s: "Şube", p: "Şubeler" },
    dealer: { s: "Bayi", p: "Bayiler" },
    warehouse: { s: "Depo", p: "Depolar" },
    supplier: { s: "Tedarikçi", p: "Tedarikçiler" },
    stockMovement: { s: "Stok Hareketi", p: "Stok Hareketleri" },
    purchaseOrder: { s: "Satınalma Siparişi", p: "Satınalma Siparişleri" },
    purchaseOrderLine: { s: "SS Satırı", p: "SS Satırları" },
    goodsReceipt: { s: "Mal Kabul", p: "Mal Kabulleri" },
    goodsReceiptLine: { s: "Mal Kabul Satırı", p: "Mal Kabul Satırları" },
    ledgerAccount: { s: "Hesap", p: "Hesap Planı" },
    fiscalPeriod: { s: "Mali Dönem", p: "Mali Dönemler" },
    journalEntry: { s: "Yevmiye Fişi", p: "Yevmiye Fişleri" },
    journalLine: { s: "Yevmiye Satırı", p: "Yevmiye Satırları" },
    vendorBill: { s: "Tedarikçi Faturası", p: "Tedarikçi Faturaları" },
    vendorBillLine: { s: "Fatura Satırı (AP)", p: "Fatura Satırları (AP)" },
    billPayment: { s: "Borç Ödemesi", p: "Borç Ödemeleri" },
    stockTransfer: { s: "Stok Transferi", p: "Stok Transferleri" },
    stockAdjustment: { s: "Stok Düzeltme", p: "Stok Düzeltmeleri" },
    labelTemplate: { s: "Etiket Şablonu", p: "Etiket Şablonları" },
    posSession: { s: "Kasa Oturumu", p: "Kasa Oturumları" },
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
    branch: { s: "Filiale", p: "Filialen" },
    dealer: { s: "Händler", p: "Händler" },
    warehouse: { s: "Lager", p: "Läger" },
    supplier: { s: "Lieferant", p: "Lieferanten" },
    stockMovement: { s: "Lagerbewegung", p: "Lagerbewegungen" },
    purchaseOrder: { s: "Bestellung", p: "Bestellungen" },
    purchaseOrderLine: { s: "Bestellposition", p: "Bestellpositionen" },
    goodsReceipt: { s: "Wareneingang", p: "Wareneingänge" },
    goodsReceiptLine: { s: "WE-Position", p: "WE-Positionen" },
    ledgerAccount: { s: "Sachkonto", p: "Kontenplan" },
    fiscalPeriod: { s: "Periode", p: "Perioden" },
    journalEntry: { s: "Buchung", p: "Buchungen" },
    journalLine: { s: "Buchungszeile", p: "Buchungszeilen" },
    vendorBill: { s: "Eingangsrechnung", p: "Eingangsrechnungen" },
    vendorBillLine: { s: "ER-Position", p: "ER-Positionen" },
    billPayment: { s: "Zahlungsausgang", p: "Zahlungsausgänge" },
    stockTransfer: { s: "Umlagerung", p: "Umlagerungen" },
    stockAdjustment: { s: "Bestandskorrektur", p: "Bestandskorrekturen" },
    labelTemplate: { s: "Etikettenvorlage", p: "Etikettenvorlagen" },
    posSession: { s: "Kassensitzung", p: "Kassensitzungen" },
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
    code: "Kod", branchId: "Şube", dealerId: "Bayi", creditLimit: "Kredi Limiti", type: "Tür",
    address: "Adres", managerId: "Yönetici", contactId: "Kişi",
    trackStock: "Stok Takibi", costPrice: "Maliyet Fiyatı", reorderLevel: "Sipariş Eşiği", uom: "Birim",
    barcode: "Barkod", barcodeType: "Barkod Tipi", imageId: "Görsel",
    warehouseId: "Depo", productId: "Ürün", unitCost: "Birim Maliyet", taxNumber: "Vergi No",
    movedAt: "Hareket Tarihi", refType: "Kaynak", ref: "Referans", stockKey: "Stok Anahtarı",
    poId: "Satınalma Siparişi", grnId: "Mal Kabul", supplierId: "Tedarikçi",
    expectedDate: "Beklenen Tarih", receiptDate: "Kabul Tarihi", qtyReceived: "Teslim Alınan",
    debit: "Borç", credit: "Alacak", normalBalance: "Normal Bakiye", subtype: "Alt Tür",
    isPostable: "Kayıt Yapılabilir", memo: "Açıklama", sourceRef: "Kaynak Ref",
    entryId: "Yevmiye Fişi", ledgerAccountId: "Hesap", debitTotal: "Borç Toplamı",
    creditTotal: "Alacak Toplamı", posted: "İşlendi", parentId: "Üst Hesap",
    billId: "Tedarikçi Faturası", billDate: "Fatura Tarihi", fromWarehouseId: "Kaynak Depo",
    toWarehouseId: "Hedef Depo", qtyDelta: "Miktar Değişimi", adjustedAt: "Düzeltme Tarihi",
    reason: "Neden", goodsReceiptId: "Mal Kabul", transferDate: "Transfer Tarihi",
    widthMm: "Genişlik (mm)", heightMm: "Yükseklik (mm)", dpi: "DPI", elements: "Öğeler",
    cashierId: "Kasiyer", openingFloat: "Açılış Kasası", openedAt: "Açılış", closedAt: "Kapanış",
    salesTotal: "Satış Toplamı", cashTotal: "Nakit Satış", expectedCash: "Beklenen Nakit",
    countedCash: "Sayılan Nakit", variance: "Fark",
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
    code: "Code", branchId: "Filiale", dealerId: "Händler", creditLimit: "Kreditlimit", type: "Typ",
    address: "Adresse", managerId: "Manager", contactId: "Kontakt",
    trackStock: "Bestandsführung", costPrice: "Einstandspreis", reorderLevel: "Meldebestand", uom: "Einheit",
    barcode: "Barcode", barcodeType: "Barcode-Typ", imageId: "Bild",
    warehouseId: "Lager", productId: "Produkt", unitCost: "Stückkosten", taxNumber: "Steuernr.",
    movedAt: "Bewegungsdatum", refType: "Quelle", ref: "Referenz", stockKey: "Lagerschlüssel",
    poId: "Bestellung", grnId: "Wareneingang", supplierId: "Lieferant",
    expectedDate: "Erwartetes Datum", receiptDate: "Eingangsdatum", qtyReceived: "Erhalten",
    debit: "Soll", credit: "Haben", normalBalance: "Normalsaldo", subtype: "Untertyp",
    isPostable: "Bebuchbar", memo: "Notiz", sourceRef: "Quellref.",
    entryId: "Buchung", ledgerAccountId: "Konto", debitTotal: "Soll-Summe",
    creditTotal: "Haben-Summe", posted: "Gebucht", parentId: "Übergeordnetes Konto",
    billId: "Eingangsrechnung", billDate: "Rechnungsdatum", fromWarehouseId: "Von Lager",
    toWarehouseId: "Nach Lager", qtyDelta: "Mengenänderung", adjustedAt: "Korrekturdatum",
    reason: "Grund", goodsReceiptId: "Wareneingang", transferDate: "Umlagerungsdatum",
    widthMm: "Breite (mm)", heightMm: "Höhe (mm)", dpi: "DPI", elements: "Elemente",
    cashierId: "Kassierer", openingFloat: "Anfangsbestand", openedAt: "Geöffnet", closedAt: "Geschlossen",
    salesTotal: "Umsatz gesamt", cashTotal: "Barverkauf", expectedCash: "Erwartetes Bargeld",
    countedCash: "Gezähltes Bargeld", variance: "Differenz",
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
    headquarters: "Merkez", branch: "Şube", franchise: "Bayilik",
    receipt: "Giriş", issue: "Çıkış", transfer_out: "Transfer Çıkış", transfer_in: "Transfer Giriş",
    adjustment: "Düzeltme", opening: "Açılış", goodsReceipt: "Mal Kabul", stockTransfer: "Stok Transferi",
    received: "Teslim Alındı", posted: "İşlendi",
    asset: "Varlık", liability: "Yükümlülük", equity: "Özkaynak", revenue: "Gelir", expense: "Gider",
    debit: "Borç", credit: "Alacak", manual: "Manuel", reversal: "Ters Kayıt", closed: "Kapalı",
    code128: "Code 128", ean13: "EAN-13", upc: "UPC-A", qr: "QR Kod",
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
    headquarters: "Zentrale", branch: "Filiale", franchise: "Franchise",
    receipt: "Eingang", issue: "Ausgang", transfer_out: "Transfer aus", transfer_in: "Transfer ein",
    adjustment: "Korrektur", opening: "Eröffnung", goodsReceipt: "Wareneingang", stockTransfer: "Umlagerung",
    received: "Erhalten", posted: "Gebucht",
    asset: "Aktiva", liability: "Passiva", equity: "Eigenkapital", revenue: "Ertrag", expense: "Aufwand",
    debit: "Soll", credit: "Haben", manual: "Manuell", reversal: "Storno", closed: "Geschlossen",
    code128: "Code 128", ean13: "EAN-13", upc: "UPC-A", qr: "QR Code",
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
