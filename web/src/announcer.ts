// Announcement maker: original PA-style scripts, chimes and voices. Recreations only — no official recordings or logos.
export type Lang = "en" | "pl" | "es" | "el" | "de" | "fr" | "it" | "pt" | "nl" | "cs" | "hu" | "tr" | "sv" | "da" | "no" | "fi" | "is";
export type AnnType = "boarding" | "final" | "gatechange" | "delay" | "cancel" | "passenger" | "baggage" | "welcome" | "security";
export type ProfileId = "man" | "lhr" | "lgw" | "uk" | "ie" | "pl" | "lpa" | "es" | "fgr" | "el" | "fra" | "de" | "fr" | "it" | "pt" | "nl" | "be" | "chde" | "chfr" | "at" | "cs" | "hu" | "tr" | "cy" | "mt" | "is" | "sv" | "da" | "no" | "fi" | "us" | "en";

export type Note = { f: number; t: number; d: number; v?: number; type?: OscillatorType };
export type Airport = { iata: string; name: string; group: string; profile: ProfileId };
export type Fields = { airline: string; flight: string; dest: string; gate: string; newGate: string; delay: string; passenger: string; belt: string; from: string; airport: string };
export type Line = { lang: Lang; label: string; text: string; speak: string };
export type Profile = { id: ProfileId; langs: Lang[]; enLocale: "en-GB" | "en-US" | "en-IE"; chime: Note[] };

export const LANG_NAME: Record<Lang, string> = { en: "English", pl: "Polish", es: "Spanish", el: "Greek", de: "German", fr: "French", it: "Italian", pt: "Portuguese", nl: "Dutch", cs: "Czech", hu: "Hungarian", tr: "Turkish", sv: "Swedish", da: "Danish", no: "Norwegian", fi: "Finnish", is: "Icelandic" };
export const LANG_TAG: Record<Lang, string> = { en: "en-GB", pl: "pl-PL", es: "es-ES", el: "el-GR", de: "de-DE", fr: "fr-FR", it: "it-IT", pt: "pt-PT", nl: "nl-NL", cs: "cs-CZ", hu: "hu-HU", tr: "tr-TR", sv: "sv-SE", da: "da-DK", no: "nb-NO", fi: "fi-FI", is: "is-IS" };
export const ANN_TYPES: { id: AnnType; name: string }[] = [
  { id: "boarding", name: "Boarding" }, { id: "final", name: "Final call" }, { id: "gatechange", name: "Gate change" },
  { id: "delay", name: "Delay" }, { id: "cancel", name: "Cancelled" }, { id: "passenger", name: "Passenger call" },
  { id: "baggage", name: "Baggage" }, { id: "welcome", name: "Welcome" }, { id: "security", name: "Security" },
];

const ding = (notes: Note[]): Note[] => notes;

export const PROFILES: Record<ProfileId, Profile> = {
  man:  { id: "man",  langs: ["en"], enLocale: "en-GB", chime: ding([{ f: 784, t: 0, d: .42, v: .22 }, { f: 659, t: .48, d: .55, v: .2 }, { f: 784, t: 1.2, d: .28, v: .1 }, { f: 659, t: 1.52, d: .4, v: .09 }]) },
  lhr:  { id: "lhr",  langs: ["en"], enLocale: "en-GB", chime: ding([{ f: 440, t: 0, d: .22, v: .2, type: "triangle" }, { f: 440, t: .32, d: .22, v: .2, type: "triangle" }, { f: 523, t: .64, d: .4, v: .22, type: "triangle" }]) },
  lgw:  { id: "lgw",  langs: ["en"], enLocale: "en-GB", chime: ding([{ f: 698, t: 0, d: .3, v: .2 }, { f: 587, t: .36, d: .45, v: .2 }]) },
  uk:   { id: "uk",   langs: ["en"], enLocale: "en-GB", chime: ding([{ f: 880, t: 0, d: .28, v: .2 }, { f: 659, t: .34, d: .4, v: .18 }]) },
  ie:   { id: "ie",   langs: ["en"], enLocale: "en-IE", chime: ding([{ f: 740, t: 0, d: .3, v: .2 }, { f: 554, t: .38, d: .48, v: .18 }]) },
  pl:   { id: "pl",   langs: ["pl", "en"], enLocale: "en-GB", chime: ding([{ f: 523, t: 0, d: .22, v: .2 }, { f: 659, t: .28, d: .22, v: .2 }, { f: 784, t: .56, d: .22, v: .2 }, { f: 330, t: .95, d: .55, v: .16 }]) },
  lpa:  { id: "lpa",  langs: ["es", "en"], enLocale: "en-GB", chime: ding([{ f: 349, t: 0, d: .55, v: .2 }, { f: 262, t: .7, d: .7, v: .18 }]) },
  es:   { id: "es",   langs: ["es", "en"], enLocale: "en-GB", chime: ding([{ f: 392, t: 0, d: .4, v: .2 }, { f: 294, t: .5, d: .55, v: .18 }]) },
  fgr:  { id: "fgr",  langs: ["el", "en"], enLocale: "en-GB", chime: ding([{ f: 494, t: 0, d: .28, v: .2, type: "triangle" }, { f: 392, t: .36, d: .32, v: .2, type: "triangle" }, { f: 740, t: .85, d: .18, v: .16 }]) },
  el:   { id: "el",   langs: ["el", "en"], enLocale: "en-GB", chime: ding([{ f: 523, t: 0, d: .32, v: .2 }, { f: 392, t: .42, d: .5, v: .18 }]) },
  fra:  { id: "fra",  langs: ["de", "en"], enLocale: "en-GB", chime: ding([{ f: 659, t: 0, d: .28, v: .2 }, { f: 587, t: .36, d: .28, v: .2 }, { f: 523, t: .72, d: .28, v: .2 }, { f: 392, t: 1.08, d: .55, v: .18 }]) },
  de:   { id: "de",   langs: ["de", "en"], enLocale: "en-GB", chime: ding([{ f: 587, t: 0, d: .3, v: .2 }, { f: 440, t: .4, d: .5, v: .18 }]) },
  fr:   { id: "fr",   langs: ["fr", "en"], enLocale: "en-GB", chime: ding([{ f: 622, t: 0, d: .28, v: .2 }, { f: 466, t: .36, d: .28, v: .2 }, { f: 311, t: .8, d: .5, v: .18 }]) },
  it:   { id: "it",   langs: ["it", "en"], enLocale: "en-GB", chime: ding([{ f: 523, t: 0, d: .28, v: .2 }, { f: 659, t: .34, d: .28, v: .2 }, { f: 784, t: .68, d: .4, v: .18 }]) },
  pt:   { id: "pt",   langs: ["pt", "en"], enLocale: "en-GB", chime: ding([{ f: 415, t: 0, d: .36, v: .2 }, { f: 311, t: .46, d: .55, v: .18 }]) },
  nl:   { id: "nl",   langs: ["nl", "en"], enLocale: "en-GB", chime: ding([{ f: 988, t: 0, d: .2, v: .18 }, { f: 784, t: .26, d: .22, v: .18 }, { f: 659, t: .54, d: .4, v: .18 }]) },
  be:   { id: "be",   langs: ["fr", "nl", "en"], enLocale: "en-GB", chime: ding([{ f: 698, t: 0, d: .24, v: .2 }, { f: 698, t: .32, d: .24, v: .2 }, { f: 523, t: .68, d: .45, v: .18 }]) },
  chde: { id: "chde", langs: ["de", "en"], enLocale: "en-GB", chime: ding([{ f: 880, t: 0, d: .2, v: .18 }, { f: 660, t: .28, d: .2, v: .18 }, { f: 440, t: .56, d: .45, v: .16 }]) },
  chfr: { id: "chfr", langs: ["fr", "en"], enLocale: "en-GB", chime: ding([{ f: 830, t: 0, d: .22, v: .18 }, { f: 622, t: .3, d: .45, v: .16 }]) },
  at:   { id: "at",   langs: ["de", "en"], enLocale: "en-GB", chime: ding([{ f: 554, t: 0, d: .3, v: .2 }, { f: 415, t: .4, d: .5, v: .18 }]) },
  cs:   { id: "cs",   langs: ["cs", "en"], enLocale: "en-GB", chime: ding([{ f: 494, t: 0, d: .26, v: .2 }, { f: 622, t: .32, d: .26, v: .2 }, { f: 370, t: .7, d: .45, v: .16 }]) },
  hu:   { id: "hu",   langs: ["hu", "en"], enLocale: "en-GB", chime: ding([{ f: 587, t: 0, d: .25, v: .2 }, { f: 740, t: .32, d: .25, v: .2 }, { f: 392, t: .7, d: .5, v: .16 }]) },
  tr:   { id: "tr",   langs: ["tr", "en"], enLocale: "en-GB", chime: ding([{ f: 349, t: 0, d: .28, v: .2 }, { f: 440, t: .34, d: .28, v: .2 }, { f: 523, t: .68, d: .45, v: .18 }]) },
  cy:   { id: "cy",   langs: ["el", "en"], enLocale: "en-GB", chime: ding([{ f: 466, t: 0, d: .3, v: .2 }, { f: 349, t: .4, d: .5, v: .18 }]) },
  mt:   { id: "mt",   langs: ["en"], enLocale: "en-GB", chime: ding([{ f: 784, t: 0, d: .32, v: .2 }, { f: 523, t: .4, d: .5, v: .18 }]) },
  is:   { id: "is",   langs: ["is", "en"], enLocale: "en-GB", chime: ding([{ f: 392, t: 0, d: .4, v: .2 }, { f: 294, t: .5, d: .6, v: .16 }]) },
  sv:   { id: "sv",   langs: ["sv", "en"], enLocale: "en-GB", chime: ding([{ f: 523, t: 0, d: .22, v: .2 }, { f: 523, t: .3, d: .22, v: .18 }, { f: 392, t: .64, d: .45, v: .16 }]) },
  da:   { id: "da",   langs: ["da", "en"], enLocale: "en-GB", chime: ding([{ f: 587, t: 0, d: .28, v: .2 }, { f: 440, t: .36, d: .48, v: .18 }]) },
  no:   { id: "no",   langs: ["no", "en"], enLocale: "en-GB", chime: ding([{ f: 659, t: 0, d: .26, v: .2 }, { f: 494, t: .34, d: .48, v: .18 }]) },
  fi:   { id: "fi",   langs: ["fi", "en"], enLocale: "en-GB", chime: ding([{ f: 440, t: 0, d: .35, v: .2 }, { f: 330, t: .45, d: .55, v: .18 }]) },
  us:   { id: "us",   langs: ["en"], enLocale: "en-US", chime: ding([{ f: 880, t: 0, d: .2, v: .2 }, { f: 880, t: .28, d: .2, v: .18 }, { f: 659, t: .56, d: .4, v: .18 }]) },
  en:   { id: "en",   langs: ["en"], enLocale: "en-GB", chime: ding([{ f: 660, t: 0, d: .3, v: .2 }, { f: 520, t: .38, d: .45, v: .18 }]) },
};

const FGR = new Set(["SKG", "CFU", "CHQ", "EFL", "KVA", "JMK", "JSI", "JTR", "KGS", "MJT", "PVK", "RHO", "SMI", "ZTH"]);
const A = (iata: string, name: string, group: string, profile: ProfileId): Airport => ({ iata, name, group, profile });

export const AIRPORTS: Airport[] = [
  A("MAN", "Manchester", "United Kingdom", "man"), A("LHR", "Heathrow", "United Kingdom", "lhr"), A("LGW", "Gatwick", "United Kingdom", "lgw"),
  A("STN", "Stansted", "United Kingdom", "uk"), A("LTN", "Luton", "United Kingdom", "uk"), A("LCY", "London City", "United Kingdom", "uk"),
  A("SEN", "Southend", "United Kingdom", "uk"), A("EMA", "East Midlands", "United Kingdom", "uk"), A("BHX", "Birmingham", "United Kingdom", "uk"),
  A("EDI", "Edinburgh", "United Kingdom", "uk"), A("GLA", "Glasgow", "United Kingdom", "uk"), A("BRS", "Bristol", "United Kingdom", "uk"),
  A("LPL", "Liverpool", "United Kingdom", "uk"), A("NCL", "Newcastle", "United Kingdom", "uk"), A("LBA", "Leeds Bradford", "United Kingdom", "uk"),
  A("BFS", "Belfast International", "United Kingdom", "uk"), A("BHD", "Belfast City", "United Kingdom", "uk"), A("ABZ", "Aberdeen", "United Kingdom", "uk"),
  A("SOU", "Southampton", "United Kingdom", "uk"), A("INV", "Inverness", "United Kingdom", "uk"), A("NQY", "Newquay", "United Kingdom", "uk"),
  A("DUB", "Dublin", "Ireland", "ie"), A("ORK", "Cork", "Ireland", "ie"), A("SNN", "Shannon", "Ireland", "ie"),
  A("KRK", "Kraków", "Poland", "pl"), A("WAW", "Warsaw Chopin", "Poland", "pl"), A("WMI", "Warsaw Modlin", "Poland", "pl"),
  A("GDN", "Gdańsk", "Poland", "pl"), A("WRO", "Wrocław", "Poland", "pl"), A("KTW", "Katowice", "Poland", "pl"),
  A("POZ", "Poznań", "Poland", "pl"), A("RZE", "Rzeszów", "Poland", "pl"), A("SZZ", "Szczecin", "Poland", "pl"), A("BZG", "Bydgoszcz", "Poland", "pl"),
  A("LPA", "Gran Canaria", "Spain", "lpa"), A("ACE", "Lanzarote", "Spain", "es"), A("FUE", "Fuerteventura", "Spain", "es"),
  A("TFS", "Tenerife South", "Spain", "es"), A("MAD", "Madrid", "Spain", "es"), A("BCN", "Barcelona", "Spain", "es"),
  A("AGP", "Málaga", "Spain", "es"), A("ALC", "Alicante", "Spain", "es"), A("PMI", "Mallorca", "Spain", "es"),
  A("VLC", "Valencia", "Spain", "es"), A("SVQ", "Seville", "Spain", "es"), A("BIO", "Bilbao", "Spain", "es"), A("GRO", "Girona", "Spain", "es"),
  A("SKG", "Thessaloniki", "Greece", "fgr"), A("CFU", "Corfu", "Greece", "fgr"), A("CHQ", "Chania", "Greece", "fgr"),
  A("HER", "Heraklion", "Greece", "el"), A("ZTH", "Zakynthos", "Greece", "fgr"), A("KGS", "Kos", "Greece", "fgr"),
  A("RHO", "Rhodes", "Greece", "fgr"), A("JMK", "Mykonos", "Greece", "fgr"), A("JTR", "Santorini", "Greece", "fgr"),
  A("JSI", "Skiathos", "Greece", "fgr"), A("PVK", "Preveza", "Greece", "fgr"), A("EFL", "Kefalonia", "Greece", "fgr"),
  A("SMI", "Samos", "Greece", "fgr"), A("KVA", "Kavala", "Greece", "fgr"), A("MJT", "Mytilene", "Greece", "fgr"),
  A("AOK", "Karpathos", "Greece", "el"), A("ATH", "Athens", "Greece", "el"),
  A("FRA", "Frankfurt", "Germany", "fra"), A("MUC", "Munich", "Germany", "de"), A("BER", "Berlin", "Germany", "de"),
  A("DUS", "Düsseldorf", "Germany", "de"), A("HAM", "Hamburg", "Germany", "de"), A("CGN", "Cologne", "Germany", "de"),
  A("STR", "Stuttgart", "Germany", "de"), A("HAJ", "Hanover", "Germany", "de"), A("NUE", "Nuremberg", "Germany", "de"),
  A("LEJ", "Leipzig", "Germany", "de"), A("DTM", "Dortmund", "Germany", "de"), A("HHN", "Frankfurt-Hahn", "Germany", "de"),
  A("CDG", "Paris Charles de Gaulle", "France", "fr"), A("ORY", "Paris Orly", "France", "fr"), A("NCE", "Nice", "France", "fr"),
  A("LYS", "Lyon", "France", "fr"), A("MRS", "Marseille", "France", "fr"), A("TLS", "Toulouse", "France", "fr"), A("NTE", "Nantes", "France", "fr"), A("BVA", "Beauvais", "France", "fr"),
  A("FCO", "Rome Fiumicino", "Italy", "it"), A("CIA", "Rome Ciampino", "Italy", "it"), A("MXP", "Milan Malpensa", "Italy", "it"),
  A("LIN", "Milan Linate", "Italy", "it"), A("BGY", "Milan Bergamo", "Italy", "it"), A("VCE", "Venice", "Italy", "it"),
  A("BLQ", "Bologna", "Italy", "it"), A("PSA", "Pisa", "Italy", "it"), A("NAP", "Naples", "Italy", "it"), A("CTA", "Catania", "Italy", "it"),
  A("PMO", "Palermo", "Italy", "it"), A("BRI", "Bari", "Italy", "it"), A("TRN", "Turin", "Italy", "it"), A("FLR", "Florence", "Italy", "it"),
  A("LIS", "Lisbon", "Portugal", "pt"), A("OPO", "Porto", "Portugal", "pt"), A("FAO", "Faro", "Portugal", "pt"), A("FNC", "Madeira", "Portugal", "pt"),
  A("AMS", "Amsterdam", "Netherlands & Belgium", "nl"), A("EIN", "Eindhoven", "Netherlands & Belgium", "nl"), A("RTM", "Rotterdam", "Netherlands & Belgium", "nl"),
  A("BRU", "Brussels", "Netherlands & Belgium", "be"), A("CRL", "Charleroi", "Netherlands & Belgium", "be"),
  A("ZRH", "Zurich", "Switzerland & Austria", "chde"), A("GVA", "Geneva", "Switzerland & Austria", "chfr"),
  A("VIE", "Vienna", "Switzerland & Austria", "at"), A("INN", "Innsbruck", "Switzerland & Austria", "at"),
  A("PRG", "Prague", "Central Europe", "cs"), A("BUD", "Budapest", "Central Europe", "hu"),
  A("CPH", "Copenhagen", "Nordics", "da"), A("BLL", "Billund", "Nordics", "da"), A("OSL", "Oslo", "Nordics", "no"),
  A("BGO", "Bergen", "Nordics", "no"), A("ARN", "Stockholm", "Nordics", "sv"), A("GOT", "Gothenburg", "Nordics", "sv"),
  A("HEL", "Helsinki", "Nordics", "fi"), A("KEF", "Keflavík", "Nordics", "is"),
  A("IST", "Istanbul", "Mediterranean", "tr"), A("SAW", "Istanbul Sabiha Gökçen", "Mediterranean", "tr"),
  A("AYT", "Antalya", "Mediterranean", "tr"), A("ADB", "İzmir", "Mediterranean", "tr"), A("DLM", "Dalaman", "Mediterranean", "tr"),
  A("LCA", "Larnaca", "Mediterranean", "cy"), A("PFO", "Paphos", "Mediterranean", "cy"), A("MLA", "Malta", "Mediterranean", "mt"),
  A("JFK", "New York JFK", "Long haul", "us"), A("EWR", "Newark", "Long haul", "us"), A("BOS", "Boston", "Long haul", "us"),
  A("MIA", "Miami", "Long haul", "us"), A("MCO", "Orlando", "Long haul", "us"), A("LAX", "Los Angeles", "Long haul", "us"),
  A("SFO", "San Francisco", "Long haul", "us"), A("ORD", "Chicago", "Long haul", "us"),
  A("DXB", "Dubai", "Long haul", "en"), A("AUH", "Abu Dhabi", "Long haul", "en"), A("DOH", "Doha", "Long haul", "en"),
];

export const FEATURED = ["MAN", "KRK", "LPA", "SKG", "FRA", "LHR", "LGW"];
export const airportOf = (iata: string) => AIRPORTS.find(a => a.iata === iata) || AIRPORTS[0];
export const profileOf = (iata: string) => PROFILES[airportOf(iata).profile];
export const isFraportGreece = (iata: string) => FGR.has(iata);

export const fmtFlight = (raw: string) => {
  const s = raw.replace(/\s+/g, "").toUpperCase();
  const m = s.match(/^([A-Z]{3}(?=\d)|[A-Z0-9]{2})(\d.*)$/);
  return m ? `${m[1]} ${m[2]}` : s || raw.trim().toUpperCase();
};
export const spokenCode = (s: string) => s.replace(/\s+/g, "").split("").join(" ");
export const spokenGate = (s: string) => s.replace(/([A-Za-z]+)(\d)/, "$1 $2").replace(/(\d)([A-Za-z])/, "$1 $2");

const al = (f: Fields, lang: Lang) => {
  const fl = f.flight || "the flight";
  if (lang === "en") return f.airline ? `${f.airline} flight ${fl}` : `flight ${fl}`;
  if (lang === "pl") return f.airline ? `linii ${f.airline}, lot ${fl}` : `lot ${fl}`;
  if (lang === "es") return f.airline ? `vuelo ${fl} de ${f.airline}` : `vuelo ${fl}`;
  if (lang === "el") return f.airline ? `πτήσης ${fl} της ${f.airline}` : `πτήσης ${fl}`;
  if (lang === "de") return f.airline ? `Fluges ${fl} der ${f.airline}` : `Fluges ${fl}`;
  if (lang === "fr") return f.airline ? `vol ${fl} de ${f.airline}` : `vol ${fl}`;
  if (lang === "it") return f.airline ? `volo ${fl} di ${f.airline}` : `volo ${fl}`;
  if (lang === "pt") return f.airline ? `voo ${fl} da ${f.airline}` : `voo ${fl}`;
  if (lang === "nl") return f.airline ? `vlucht ${fl} van ${f.airline}` : `vlucht ${fl}`;
  if (lang === "cs") return f.airline ? `letu ${fl} společnosti ${f.airline}` : `letu ${fl}`;
  if (lang === "hu") return f.airline ? `${f.airline} ${fl} járatára` : `${fl} járatára`;
  if (lang === "tr") return f.airline ? `${f.airline} ${fl} sefer sayılı` : `${fl} sefer sayılı`;
  if (lang === "sv") return f.airline ? `flyg ${fl} med ${f.airline}` : `flyg ${fl}`;
  if (lang === "da") return f.airline ? `fly ${fl} fra ${f.airline}` : `fly ${fl}`;
  if (lang === "no") return f.airline ? `fly ${fl} med ${f.airline}` : `fly ${fl}`;
  if (lang === "fi") return f.airline ? `lennon ${fl} (${f.airline})` : `lennon ${fl}`;
  if (lang === "is") return f.airline ? `flugs ${fl} með ${f.airline}` : `flugs ${fl}`;
  return fl;
};

type Writer = (f: Fields) => string;
const T: Record<AnnType, Record<Lang, Writer>> = {
  boarding: {
    en: f => `Ladies and gentlemen, this is a boarding call for ${al(f, "en")} to ${f.dest}. Would all passengers please make their way to gate ${f.gate}, where boarding is now in progress.`,
    pl: f => `Szanowni Państwo, informujemy, że rozpoczyna się boarding do samolotu ${al(f, "pl")} do ${f.dest}. Prosimy wszystkich pasażerów o udanie się do bramki ${f.gate}.`,
    es: f => `Señoras y señores, se inicia el embarque del ${al(f, "es")} con destino a ${f.dest}. Por favor, diríjanse a la puerta ${f.gate}.`,
    el: f => `Κυρίες και κύριοι, ξεκινά η επιβίβαση της ${al(f, "el")} με προορισμό ${f.dest}. Παρακαλούνται οι επιβάτες να μεταβούν στην πύλη ${f.gate}.`,
    de: f => `Meine Damen und Herren, wir bitten die Fluggäste des ${al(f, "de")} nach ${f.dest}, sich zum Gate ${f.gate} zu begeben. Das Boarding hat begonnen.`,
    fr: f => `Mesdames et messieurs, l'embarquement du ${al(f, "fr")} à destination de ${f.dest} a commencé. Veuillez vous diriger vers la porte ${f.gate}.`,
    it: f => `Signore e signori, è iniziato l'imbarco del ${al(f, "it")} per ${f.dest}. Si pregano i passeggeri di recarsi al gate ${f.gate}.`,
    pt: f => `Senhoras e senhores, está a iniciar-se o embarque do ${al(f, "pt")} com destino a ${f.dest}. Por favor, dirijam-se à porta ${f.gate}.`,
    nl: f => `Dames en heren, de boarding van ${al(f, "nl")} naar ${f.dest} is begonnen. Gelieve u te begeven naar gate ${f.gate}.`,
    cs: f => `Vážené dámy a pánové, začíná nástup do ${al(f, "cs")} do destinace ${f.dest}. Prosíme cestující, aby se dostavili k odletové bráně ${f.gate}.`,
    hu: f => `Tisztelt utasaink, megkezdődött a beszállás a ${al(f, "hu")}, melynek célállomása ${f.dest}. Kérjük az utasokat, fáradjanak a ${f.gate} kapuhoz.`,
    tr: f => `Sayın yolcularımız, ${f.dest} hattı ${al(f, "tr")} uçağımızın boarding işlemleri başlamıştır. Lütfen ${f.gate} numaralı kapıya geçiniz.`,
    sv: f => `Mina damer och herrar, boarding för ${al(f, "sv")} till ${f.dest} har börjat. Vänligen gå till gate ${f.gate}.`,
    da: f => `Mine damer og herrer, boarding til ${al(f, "da")} til ${f.dest} er begyndt. De bedes venligst gå til gate ${f.gate}.`,
    no: f => `Mine damer og herrer, boarding til ${al(f, "no")} til ${f.dest} er i gang. Vennligst gå til gate ${f.gate}.`,
    fi: f => `Hyvät matkustajat, ${al(f, "fi")} boarding määränpäähän ${f.dest} on alkanut. Olkaa hyvä ja siirtykää portille ${f.gate}.`,
    is: f => `Aðfararorð, brottför ${al(f, "is")} til ${f.dest} er hafin. Vinsamlegast farið að hliði ${f.gate}.`,
  },
  final: {
    en: f => `This is a final call for ${al(f, "en")} to ${f.dest}. Would any remaining passengers please go immediately to gate ${f.gate}. The aircraft is ready to depart.`,
    pl: f => `To ostatnie wezwanie pasażerów ${al(f, "pl")} do ${f.dest}. Prosimy pozostałych pasażerów o niezwłoczne udanie się do bramki ${f.gate}.`,
    es: f => `Última llamada para el ${al(f, "es")} con destino a ${f.dest}. Los pasajeros que aún no hayan embarcado, diríjanse inmediatamente a la puerta ${f.gate}.`,
    el: f => `Τελευταία κλήση για την ${al(f, "el")} με προορισμό ${f.dest}. Οι επιβάτες που δεν έχουν επιβιβαστεί παρακαλούνται να μεταβούν αμέσως στην πύλη ${f.gate}.`,
    de: f => `Letzter Aufruf für den ${al(f, "de")} nach ${f.dest}. Wir bitten die noch nicht eingestiegenen Fluggäste, sich unverzüglich zum Gate ${f.gate} zu begeben.`,
    fr: f => `Dernier appel pour le ${al(f, "fr")} à destination de ${f.dest}. Les passagers n'ayant pas encore embarqué sont priés de se rendre immédiatement à la porte ${f.gate}.`,
    it: f => `Ultima chiamata per il ${al(f, "it")} per ${f.dest}. I passeggeri che non hanno ancora imbarcato sono pregati di recarsi immediatamente al gate ${f.gate}.`,
    pt: f => `Última chamada para o ${al(f, "pt")} com destino a ${f.dest}. Os passageiros que ainda não embarcaram devem dirigir-se imediatamente à porta ${f.gate}.`,
    nl: f => `Dit is de laatste oproep voor ${al(f, "nl")} naar ${f.dest}. Overgebleven passagiers worden verzocht onmiddellijk naar gate ${f.gate} te gaan.`,
    cs: f => `Poslední výzva pro cestující ${al(f, "cs")} do ${f.dest}. Prosíme zbývající cestující, aby se neprodleně dostavili k bráně ${f.gate}.`,
    hu: f => `Utolsó felszólítás a ${al(f, "hu")} utasainak, célállomás ${f.dest}. Kérjük a még be nem szállt utasokat, haladéktalanul fáradjanak a ${f.gate} kapuhoz.`,
    tr: f => `${f.dest} hattı ${al(f, "tr")} uçağımız için son çağrıdır. Henüz biniş yapmayan yolcularımızın derhal ${f.gate} numaralı kapıya gelmelerini rica ederiz.`,
    sv: f => `Sista anrop för ${al(f, "sv")} till ${f.dest}. Kvarvarande passagerare ombeds gå omedelbart till gate ${f.gate}.`,
    da: f => `Sidste kald til ${al(f, "da")} til ${f.dest}. Resterende passagerer bedes gå med det samme til gate ${f.gate}.`,
    no: f => `Siste innkalling for ${al(f, "no")} til ${f.dest}. Gjenværende passasjerer bes gå umiddelbart til gate ${f.gate}.`,
    fi: f => `Viimeinen kutsu: ${al(f, "fi")} määränpäähän ${f.dest}. Vielä koneeseen siirtymättömiä matkustajia pyydetään menemään heti portille ${f.gate}.`,
    is: f => `Síðasta kallað er á farþega ${al(f, "is")} til ${f.dest}. Vinsamlegast farið strax að hliði ${f.gate}.`,
  },
  gatechange: {
    en: f => `This is a passenger announcement. ${al(f, "en")} to ${f.dest} will now depart from gate ${f.newGate}. Passengers who were waiting at gate ${f.gate} should make their way to gate ${f.newGate}.`,
    pl: f => `Informujemy o zmianie bramki. ${al(f, "pl").replace(/^linii/, "Lot linii").replace(/^lot /, "Lot ")} do ${f.dest} odleci z bramki ${f.newGate}. Pasażerowie oczekujący przy bramce ${f.gate} proszeni są o udanie się do bramki ${f.newGate}.`,
    es: f => `Cambio de puerta. El ${al(f, "es")} con destino a ${f.dest} saldrá ahora por la puerta ${f.newGate}. Los pasajeros que esperaban en la puerta ${f.gate} deben dirigirse a la puerta ${f.newGate}.`,
    el: f => `Ανακοίνωση αλλαγής πύλης. Η ${al(f, "el")} με προορισμό ${f.dest} θα αναχωρήσει από την πύλη ${f.newGate}. Οι επιβάτες που βρίσκονται στην πύλη ${f.gate} παρακαλούνται να μεταβούν στην πύλη ${f.newGate}.`,
    de: f => `Dies ist eine Gateänderung. Der ${al(f, "de")} nach ${f.dest} wird nun ab Gate ${f.newGate} abfliegen. Fluggäste, die am Gate ${f.gate} warten, werden gebeten, sich zum Gate ${f.newGate} zu begeben.`,
    fr: f => `Changement de porte. Le ${al(f, "fr")} à destination de ${f.dest} partira désormais de la porte ${f.newGate}. Les passagers qui attendaient à la porte ${f.gate} sont priés de se rendre à la porte ${f.newGate}.`,
    it: f => `Cambio gate. Il ${al(f, "it")} per ${f.dest} partirà ora dal gate ${f.newGate}. I passeggeri in attesa al gate ${f.gate} sono pregati di recarsi al gate ${f.newGate}.`,
    pt: f => `Alteração de porta. O ${al(f, "pt")} com destino a ${f.dest} partirá agora da porta ${f.newGate}. Os passageiros que aguardavam na porta ${f.gate} devem dirigir-se à porta ${f.newGate}.`,
    nl: f => `Gatewijziging. ${al(f, "nl")} naar ${f.dest} vertrekt nu van gate ${f.newGate}. Passagiers die bij gate ${f.gate} wachtten, worden verzocht naar gate ${f.newGate} te gaan.`,
    cs: f => `Změna odletové brány. ${al(f, "cs").replace(/^letu/, "Let")} do ${f.dest} odletí z brány ${f.newGate}. Cestující čekající u brány ${f.gate} jsou žádáni, aby se dostavili k bráně ${f.newGate}.`,
    hu: f => `Kapuváltozás. A ${al(f, "hu")} ${f.dest} célállomással a ${f.newGate} kapuról indul. A ${f.gate} kapunál várakozó utasokat kérjük, fáradjanak a ${f.newGate} kapuhoz.`,
    tr: f => `Kapı değişikliği. ${f.dest} hattı ${al(f, "tr")} uçağımız artık ${f.newGate} numaralı kapıdan hareket edecektir. ${f.gate} kapısında bekleyen yolcularımızın ${f.newGate} numaralı kapıya geçmelerini rica ederiz.`,
    sv: f => `Gatebyte. ${al(f, "sv")} till ${f.dest} avgår nu från gate ${f.newGate}. Passagerare som väntade vid gate ${f.gate} ombeds gå till gate ${f.newGate}.`,
    da: f => `Gateændring. ${al(f, "da")} til ${f.dest} afgår nu fra gate ${f.newGate}. Passagerer der ventede ved gate ${f.gate} bedes gå til gate ${f.newGate}.`,
    no: f => `Gateendring. ${al(f, "no")} til ${f.dest} går nå fra gate ${f.newGate}. Passasjerer som ventet ved gate ${f.gate} bes gå til gate ${f.newGate}.`,
    fi: f => `Portin muutos. ${al(f, "fi")} määränpäähän ${f.dest} lähtee nyt portilta ${f.newGate}. Portilla ${f.gate} odottavia matkustajia pyydetään siirtymään portille ${f.newGate}.`,
    is: f => `Hliðabreyting. ${al(f, "is")} til ${f.dest} fer nú frá hliði ${f.newGate}. Farþegar sem biðu við hlið ${f.gate} eru beðnir um að fara að hliði ${f.newGate}.`,
  },
  delay: {
    en: f => `We regret to announce that ${al(f, "en")} to ${f.dest} is delayed by approximately ${f.delay} minutes. Please watch the departure boards for further information.`,
    pl: f => `Z przykrością informujemy, że ${al(f, "pl")} do ${f.dest} jest opóźniony o około ${f.delay} minut. Prosimy o śledzenie tablic odlotów.`,
    es: f => `Lamentamos informar de que el ${al(f, "es")} con destino a ${f.dest} tiene un retraso de aproximadamente ${f.delay} minutos. Consulten las pantallas de salidas para más información.`,
    el: f => `Λυπούμαστε που ανακοινώνουμε ότι η ${al(f, "el")} με προορισμό ${f.dest} έχει καθυστέρηση περίπου ${f.delay} λεπτών. Παρακαλούμε παρακολουθείτε τους πίνακες αναχωρήσεων.`,
    de: f => `Wir bedauern, mitteilen zu müssen, dass der ${al(f, "de")} nach ${f.dest} sich um etwa ${f.delay} Minuten verspätet. Bitte beachten Sie die Anzeigetafeln.`,
    fr: f => `Nous sommes au regret de vous informer que le ${al(f, "fr")} à destination de ${f.dest} est retardé d'environ ${f.delay} minutes. Veuillez consulter les écrans des départs.`,
    it: f => `Siamo spiacenti di informare che il ${al(f, "it")} per ${f.dest} è in ritardo di circa ${f.delay} minuti. Si prega di consultare i tabelloni delle partenze.`,
    pt: f => `Lamentamos informar que o ${al(f, "pt")} com destino a ${f.dest} tem um atraso de cerca de ${f.delay} minutos. Consultem os painéis de partidas.`,
    nl: f => `Wij moeten helaas mededelen dat ${al(f, "nl")} naar ${f.dest} ongeveer ${f.delay} minuten vertraagd is. Raadpleeg de vertrekborden voor meer informatie.`,
    cs: f => `S lítostí oznamujeme, že ${al(f, "cs")} do ${f.dest} má zpoždění přibližně ${f.delay} minut. Sledujte prosím odletovou tabuli.`,
    hu: f => `Sajnálattal közöljük, hogy a ${al(f, "hu")} ${f.dest} felé körülbelül ${f.delay} percet késik. Kérjük, kísérjék figyelemmel a kijelzőket.`,
    tr: f => `${f.dest} hattı ${al(f, "tr")} uçağımız yaklaşık ${f.delay} dakika gecikmelidir. Lütfen kalkış ekranlarını takip ediniz.`,
    sv: f => `Vi beklagar att meddela att ${al(f, "sv")} till ${f.dest} är försenat med cirka ${f.delay} minuter. Följ avgångstavlorna för mer information.`,
    da: f => `Vi beklager at måtte meddele, at ${al(f, "da")} til ${f.dest} er forsinket med cirka ${f.delay} minutter. Følg venligst afgangstavlerne.`,
    no: f => `Vi beklager å måtte meddele at ${al(f, "no")} til ${f.dest} er forsinket med om lag ${f.delay} minutter. Følg avgangstavlene for mer informasjon.`,
    fi: f => `Valitettavasti ${al(f, "fi")} määränpäähän ${f.dest} on noin ${f.delay} minuuttia myöhässä. Seuratkaa lähtötauluja.`,
    is: f => `Því miður er ${al(f, "is")} til ${f.dest} seinkað um u.þ.b. ${f.delay} mínútur. Vinsamlegast fylgist með brottfara visunum.`,
  },
  cancel: {
    en: f => `We regret to announce that ${al(f, "en")} to ${f.dest} has been cancelled. Passengers are asked to contact the airline desk for assistance.`,
    pl: f => `Z przykrością informujemy, że ${al(f, "pl")} do ${f.dest} został odwołany. Prosimy pasażerów o zgłoszenie się do stanowiska linii lotniczej.`,
    es: f => `Lamentamos informar de que el ${al(f, "es")} con destino a ${f.dest} ha sido cancelado. Los pasajeros deben dirigirse al mostrador de la compañía.`,
    el: f => `Λυπούμαστε που ανακοινώνουμε ότι η ${al(f, "el")} με προορισμό ${f.dest} ακυρώθηκε. Παρακαλούνται οι επιβάτες να επικοινωνήσουν με το γραφείο της αεροπορικής εταιρείας.`,
    de: f => `Wir bedauern, mitteilen zu müssen, dass der ${al(f, "de")} nach ${f.dest} entfallen ist. Bitte wenden Sie sich an den Schalter der Fluggesellschaft.`,
    fr: f => `Nous sommes au regret de vous informer que le ${al(f, "fr")} à destination de ${f.dest} a été annulé. Les passagers sont priés de se présenter au comptoir de la compagnie.`,
    it: f => `Siamo spiacenti di informare che il ${al(f, "it")} per ${f.dest} è stato cancellato. I passeggeri sono pregati di rivolgersi al banco della compagnia.`,
    pt: f => `Lamentamos informar que o ${al(f, "pt")} com destino a ${f.dest} foi cancelado. Os passageiros devem dirigir-se ao balcão da companhia.`,
    nl: f => `Wij moeten helaas mededelen dat ${al(f, "nl")} naar ${f.dest} is geannuleerd. Passagiers worden verzocht contact op te nemen met de airlinebalie.`,
    cs: f => `S lítostí oznamujeme, že ${al(f, "cs")} do ${f.dest} byl zrušen. Cestující jsou žádáni, aby se dostavili na přepážku letecké společnosti.`,
    hu: f => `Sajnálattal közöljük, hogy a ${al(f, "hu")} ${f.dest} felé törlésre került. Kérjük az utasokat, keressék fel a légitársaság pultját.`,
    tr: f => `${f.dest} hattı ${al(f, "tr")} uçağımız iptal edilmiştir. Yolcularımızın havayolu gişesine başvurmalarını rica ederiz.`,
    sv: f => `Vi beklagar att meddela att ${al(f, "sv")} till ${f.dest} har ställts in. Passagerare ombeds kontakta flygbolagets disk.`,
    da: f => `Vi beklager at måtte meddele, at ${al(f, "da")} til ${f.dest} er aflyst. Passagerer bedes henvende sig i flyselskabets skranke.`,
    no: f => `Vi beklager å måtte meddele at ${al(f, "no")} til ${f.dest} er innstilt. Passasjerer bes kontakte flyselskapets skranke.`,
    fi: f => `Valitettavasti ${al(f, "fi")} määränpäähän ${f.dest} on peruttu. Matkustajia pyydetään ottamaan yhteyttä lentoyhtiön tiskille.`,
    is: f => `Því miður hefur ${al(f, "is")} til ${f.dest} verið aflýst. Farþegar eru beðnir um að snúa sér til afgreiðslu flugfélagsins.`,
  },
  passenger: {
    en: f => `This is a last call for passenger ${f.passenger}, travelling on ${al(f, "en")} to ${f.dest}. Please proceed immediately to gate ${f.gate}.`,
    pl: f => `Ostatnie wezwanie pasażera ${f.passenger}, podróżującego ${al(f, "pl")} do ${f.dest}. Prosimy o niezwłoczne udanie się do bramki ${f.gate}.`,
    es: f => `Última llamada para el pasajero ${f.passenger}, que viaja en el ${al(f, "es")} con destino a ${f.dest}. Diríjase inmediatamente a la puerta ${f.gate}.`,
    el: f => `Τελευταία κλήση για τον επιβάτη ${f.passenger}, που ταξιδεύει με την ${al(f, "el")} με προορισμό ${f.dest}. Παρακαλείται να μεταβεί αμέσως στην πύλη ${f.gate}.`,
    de: f => `Letzter Aufruf für den Fluggast ${f.passenger}, der mit dem ${al(f, "de")} nach ${f.dest} reist. Bitte begeben Sie sich unverzüglich zum Gate ${f.gate}.`,
    fr: f => `Dernier appel pour le passager ${f.passenger}, voyageant sur le ${al(f, "fr")} à destination de ${f.dest}. Veuillez vous rendre immédiatement à la porte ${f.gate}.`,
    it: f => `Ultima chiamata per il passeggero ${f.passenger}, in partenza con il ${al(f, "it")} per ${f.dest}. Si prega di recarsi immediatamente al gate ${f.gate}.`,
    pt: f => `Última chamada para o passageiro ${f.passenger}, que viaja no ${al(f, "pt")} com destino a ${f.dest}. Dirija-se imediatamente à porta ${f.gate}.`,
    nl: f => `Laatste oproep voor passagier ${f.passenger}, reizend met ${al(f, "nl")} naar ${f.dest}. Ga onmiddellijk naar gate ${f.gate}.`,
    cs: f => `Poslední výzva pro cestujícího ${f.passenger}, který cestuje ${al(f, "cs")} do ${f.dest}. Dostavte se neprodleně k bráně ${f.gate}.`,
    hu: f => `Utolsó felszólítás ${f.passenger} utasnak, aki a ${al(f, "hu")} utazik ${f.dest} felé. Kérjük, haladéktalanul fáradjon a ${f.gate} kapuhoz.`,
    tr: f => `${f.dest} hattı ${al(f, "tr")} uçağımızla seyahat eden ${f.passenger} adlı yolcumuz için son çağrıdır. Lütfen derhal ${f.gate} numaralı kapıya geliniz.`,
    sv: f => `Sista anrop för passagerare ${f.passenger}, som reser med ${al(f, "sv")} till ${f.dest}. Gå omedelbart till gate ${f.gate}.`,
    da: f => `Sidste kald til passager ${f.passenger}, som rejser med ${al(f, "da")} til ${f.dest}. Gå med det samme til gate ${f.gate}.`,
    no: f => `Siste innkalling for passasjer ${f.passenger}, som reiser med ${al(f, "no")} til ${f.dest}. Gå umiddelbart til gate ${f.gate}.`,
    fi: f => `Viimeinen kutsu matkustajalle ${f.passenger}, joka matkustaa ${al(f, "fi")} määränpäähän ${f.dest}. Siirtykää heti portille ${f.gate}.`,
    is: f => `Síðasta kallað er á farþega ${f.passenger}, sem ferðast með ${al(f, "is")} til ${f.dest}. Vinsamlegast farið strax að hliði ${f.gate}.`,
  },
  baggage: {
    en: f => `Baggage from ${al(f, "en")} from ${f.from} is now available on belt ${f.belt} in the baggage reclaim hall.`,
    pl: f => `Bagaż z ${al(f, "pl")} z ${f.from} jest już dostępny na taśmie ${f.belt} w hali odbioru bagażu.`,
    es: f => `El equipaje del ${al(f, "es")} procedente de ${f.from} ya está disponible en la cinta ${f.belt} de la sala de recogida de equipajes.`,
    el: f => `Οι αποσκευές της ${al(f, "el")} από ${f.from} είναι διαθέσιμες στον ιμάντα ${f.belt} στην αίθουσα παραλαβής αποσκευών.`,
    de: f => `Das Gepäck des ${al(f, "de")} aus ${f.from} ist jetzt auf Band ${f.belt} in der Gepäckausgabe bereit.`,
    fr: f => `Les bagages du ${al(f, "fr")} en provenance de ${f.from} sont disponibles sur le tapis ${f.belt} dans la salle de livraison des bagages.`,
    it: f => `I bagagli del ${al(f, "it")} proveniente da ${f.from} sono disponibili sul nastro ${f.belt} nella sala ritiro bagagli.`,
    pt: f => `A bagagem do ${al(f, "pt")} proveniente de ${f.from} está disponível na passadeira ${f.belt} na sala de recolha de bagagem.`,
    nl: f => `Bagage van ${al(f, "nl")} uit ${f.from} is nu beschikbaar op band ${f.belt} in de bagagehal.`,
    cs: f => `Zavazadla z ${al(f, "cs")} z ${f.from} jsou již k dispozici na pásu ${f.belt} v hale výdeje zavazadel.`,
    hu: f => `A ${f.from} felől érkező ${al(f, "hu")} poggyásza a ${f.belt} szalagon átvehető a poggyászkiadóban.`,
    tr: f => `${f.from} kalkışlı ${al(f, "tr")} uçağımızın bagajları ${f.belt} numaralı bantta teslim alınabilir.`,
    sv: f => `Bagage från ${al(f, "sv")} från ${f.from} finns nu på band ${f.belt} i bagagehallen.`,
    da: f => `Bagage fra ${al(f, "da")} fra ${f.from} er nu fremme på bånd ${f.belt} i bagagehallen.`,
    no: f => `Bagasje fra ${al(f, "no")} fra ${f.from} er nå tilgjengelig på bånd ${f.belt} i bagasjehallen.`,
    fi: f => `${al(f, "fi")} matkatavarat lähtöpaikasta ${f.from} ovat nyt hihnalla ${f.belt} matkatavara-aulassa.`,
    is: f => `Farangur ${al(f, "is")} frá ${f.from} er nú til reiðu á færibandi ${f.belt} í farangursmóttöku.`,
  },
  welcome: {
    en: f => `Ladies and gentlemen, welcome to ${f.airport}. ${al(f, "en")} from ${f.from} has now arrived. We wish you a pleasant onward journey.`,
    pl: f => `Witamy w porcie lotniczym ${f.airport}. ${al(f, "pl").replace(/^linii/, "Lot linii").replace(/^lot /, "Lot ")} z ${f.from} właśnie wylądował. Życzymy miłego pobytu.`,
    es: f => `Señoras y señores, bienvenidos a ${f.airport}. El ${al(f, "es")} procedente de ${f.from} acaba de llegar. Les deseamos una feliz estancia.`,
    el: f => `Καλώς ήρθατε στο αεροδρόμιο ${f.airport}. Η ${al(f, "el")} από ${f.from} μόλις αφίχθη. Σας ευχόμαστε καλό ταξίδι στη συνέχεια.`,
    de: f => `Meine Damen und Herren, willkommen in ${f.airport}. Der ${al(f, "de")} aus ${f.from} ist soeben angekommen. Wir wünschen Ihnen einen angenehmen Aufenthalt.`,
    fr: f => `Mesdames et messieurs, bienvenue à ${f.airport}. Le ${al(f, "fr")} en provenance de ${f.from} vient d'arriver. Nous vous souhaitons un agréable séjour.`,
    it: f => `Signore e signori, benvenuti a ${f.airport}. Il ${al(f, "it")} proveniente da ${f.from} è appena arrivato. Vi auguriamo un piacevole soggiorno.`,
    pt: f => `Senhoras e senhores, bem-vindos a ${f.airport}. O ${al(f, "pt")} proveniente de ${f.from} acabou de chegar. Desejamos-lhe uma agradável estadia.`,
    nl: f => `Dames en heren, welkom op ${f.airport}. ${al(f, "nl")} uit ${f.from} is zojuist gearriveerd. Wij wensen u een prettig verblijf.`,
    cs: f => `Vítejte na letišti ${f.airport}. ${al(f, "cs").replace(/^letu/, "Let")} z ${f.from} právě přiletěl. Přejeme vám příjemný pobyt.`,
    hu: f => `Tisztelt utasaink, üdvözöljük ${f.airport} repülőterén. A ${f.from} felől érkező ${al(f, "hu")} landolt. Kellemes időtöltést kívánunk.`,
    tr: f => `${f.airport} Havalimanı'na hoş geldiniz. ${f.from} kalkışlı ${al(f, "tr")} uçağımız inmiştir. İyi günler dileriz.`,
    sv: f => `Mina damer och herrar, välkomna till ${f.airport}. ${al(f, "sv")} från ${f.from} har nu anlänt. Vi önskar er en trevlig fortsatt resa.`,
    da: f => `Mine damer og herrer, velkommen til ${f.airport}. ${al(f, "da")} fra ${f.from} er nu ankommet. Vi ønsker Dem en god videre rejse.`,
    no: f => `Mine damer og herrer, velkommen til ${f.airport}. ${al(f, "no")} fra ${f.from} har nå ankommet. Vi ønsker dere en hyggelig videre reise.`,
    fi: f => `Tervetuloa lentoasemalle ${f.airport}. ${al(f, "fi")} lähtöpaikasta ${f.from} on saapunut. Toivotamme miellyttävää matkan jatkoa.`,
    is: f => `Velkomin á ${f.airport}. ${al(f, "is")} frá ${f.from} er nýlent. Við óskum yður góðrar dvöl.`,
  },
  security: {
    en: _f => `This is a security announcement. Please keep your baggage with you at all times. Any unattended bags may be removed and destroyed. Thank you for your co-operation.`,
    pl: _f => `Komunikat dotyczący bezpieczeństwa. Prosimy o niepozostawianie bagażu bez opieki. Bagaż pozostawiony bez opieki może zostać usunięty i zniszczony. Dziękujemy za współpracę.`,
    es: _f => `Anuncio de seguridad. No dejen su equipaje desatendido en ningún momento. El equipaje sin atender podrá ser retirado y destruido. Gracias por su colaboración.`,
    el: _f => `Ανακοίνωση ασφαλείας. Παρακαλούμε μην αφήνετε τις αποσκευές σας χωρίς επίβλεψη. Οι αφύλακτες αποσκευές ενδέχεται να αφαιρεθούν και να καταστραφούν. Σας ευχαριστούμε.`,
    de: _f => `Dies ist eine Sicherheitsdurchsage. Bitte lassen Sie Ihr Gepäck niemals unbeaufsichtigt. Unbeaufsichtigtes Gepäck kann entfernt und zerstört werden. Vielen Dank für Ihre Mithilfe.`,
    fr: _f => `Ceci est une annonce de sécurité. Ne laissez jamais vos bagages sans surveillance. Tout bagage non surveillé pourra être retiré et détruit. Merci de votre coopération.`,
    it: _f => `Annuncio di sicurezza. Si prega di non lasciare i bagagli incustoditi. I bagagli lasciati incustoditi potranno essere rimossi e distrutti. Grazie per la collaborazione.`,
    pt: _f => `Anúncio de segurança. Não deixem a bagagem desacompanhada. A bagagem deixada sem vigilância poderá ser removida e destruída. Obrigado pela colaboração.`,
    nl: _f => `Dit is een veiligheidsaankondiging. Laat uw bagage nooit onbeheerd achter. Onbeheerde bagage kan worden verwijderd en vernietigd. Dank u voor uw medewerking.`,
    cs: _f => `Bezpečnostní hlášení. Nenechávejte svá zavazadla bez dozoru. Bez dozoru zanechaná zavazadla mohou být odstraněna a zničena. Děkujeme za spolupráci.`,
    hu: _f => `Biztonsági közlemény. Kérjük, poggyászukat soha ne hagyják őrizetlenül. Az őrizetlenül hagyott csomagokat eltávolíthatják és megsemmisíthetik. Köszönjük együttműködésüket.`,
    tr: _f => `Güvenlik anonsu. Lütfen bagajlarınızı hiçbir zaman gözetimsiz bırakmayınız. Sahipsiz bagajlar alınabilir ve imha edilebilir. İş birliğiniz için teşekkür ederiz.`,
    sv: _f => `Detta är ett säkerhetsmeddelande. Lämna inte ditt bagage obevakat. Obevakat bagage kan avlägsnas och förstöras. Tack för din medverkan.`,
    da: _f => `Dette er en sikkerhedsmeddelelse. Efterlad aldrig Deres bagage uden opsyn. Bagage uden opsyn kan blive fjernet og destrueret. Tak for Deres samarbejde.`,
    no: _f => `Dette er en sikkerhetsmelding. Ikke la bagasjen din være uten tilsyn. Bagasje uten tilsyn kan bli fjernet og destruert. Takk for samarbeidet.`,
    fi: _f => `Tämä on turvatiedote. Älkää jättäkö matkatavaroitanne valvomatta. Valvomattomat matkatavarat voidaan poistaa ja tuhota. Kiitos yhteistyöstä.`,
    is: _f => `Þetta er öryggistilkynning. Skiljið ekki farangur eftir án eftirlits. Farangri án eftirlits má fjarlægja og eyða. Þökkum samstarfið.`,
  },
};

export const defaultFields = (): Fields => ({ airline: "Ryanair", flight: "FR 2134", dest: "Fuerteventura", gate: "32", newGate: "B12", delay: "30", passenger: "Alex Kowalski", belt: "4", from: "Manchester", airport: "Manchester" });

export function buildScript(iata: string, type: AnnType, fields: Fields): Line[] {
  const apt = airportOf(iata);
  const p = PROFILES[apt.profile];
  const f: Fields = { ...defaultFields(), ...fields, airport: fields.airport || apt.name, flight: fmtFlight(fields.flight || "") };
  return p.langs.map(lang => {
    const text = T[type][lang](f);
    const speak = text
      .replace(f.flight, spokenCode(f.flight))
      .replace(new RegExp(`gate ${escapeRe(f.gate)}`, "gi"), `gate ${spokenGate(f.gate)}`)
      .replace(new RegExp(`bramki ${escapeRe(f.gate)}`, "gi"), `bramki ${spokenGate(f.gate)}`)
      .replace(new RegExp(`puerta ${escapeRe(f.gate)}`, "gi"), `puerta ${spokenGate(f.gate)}`);
    return { lang, label: LANG_NAME[lang], text, speak };
  });
}
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const chimeDuration = (notes: Note[]) => Math.max(0, ...notes.map(n => n.t + n.d)) + 0.28;

const VOICE_TAGS: Record<Lang, string[]> = {
  en: ["en-GB", "en-UK", "en-IE", "en-AU", "en-US", "en"],
  pl: ["pl-PL", "pl"], es: ["es-ES", "es-IC", "es-MX", "es"], el: ["el-GR", "el"],
  de: ["de-DE", "de-AT", "de-CH", "de"], fr: ["fr-FR", "fr-BE", "fr-CH", "fr"], it: ["it-IT", "it"],
  pt: ["pt-PT", "pt-BR", "pt"], nl: ["nl-NL", "nl-BE", "nl"], cs: ["cs-CZ", "cs"], hu: ["hu-HU", "hu"],
  tr: ["tr-TR", "tr"], sv: ["sv-SE", "sv"], da: ["da-DK", "da"], no: ["nb-NO", "nn-NO", "no-NO", "no"],
  fi: ["fi-FI", "fi"], is: ["is-IS", "is"],
};

export function pickVoice(voices: SpeechSynthesisVoice[], lang: Lang, enLocale: Profile["enLocale"] = "en-GB"): SpeechSynthesisVoice | null {
  const tags = lang === "en" ? [enLocale, ...VOICE_TAGS.en.filter(t => t !== enLocale)] : VOICE_TAGS[lang];
  const list = voices.map(v => ({ v, l: (v.lang || "").toLowerCase().replace("_", "-"), n: (v.name || "").toLowerCase() }));
  const prefer = (hits: typeof list) => {
    const scored = hits.map(h => {
      let s = (h.v.localService ? 2 : 0) + (h.v.default ? 0.3 : 0);
      if (lang === "en" && enLocale === "en-GB" && /uk|britain|british|daniel|serena|arthur|martha|eddie|kate|malcolm/.test(h.n)) s += 3;
      if (lang === "en" && enLocale === "en-US" && /us|american|samantha|aaron|allison|nicky/.test(h.n)) s += 3;
      if (lang === "en" && enLocale === "en-IE" && /ireland|irish|moira/.test(h.n)) s += 3;
      return { ...h, s };
    });
    scored.sort((a, b) => b.s - a.s);
    return scored[0]?.v || null;
  };
  for (const tag of tags) {
    const t = tag.toLowerCase();
    const exact = list.filter(x => x.l === t);
    if (exact.length) return prefer(exact);
  }
  for (const tag of tags) {
    const t = tag.toLowerCase().split("-")[0];
    const pre = list.filter(x => x.l === t || x.l.startsWith(t + "-"));
    if (pre.length) return prefer(pre);
  }
  return null;
}

export async function waitForVoices(speech: SpeechSynthesis, ms = 1800): Promise<SpeechSynthesisVoice[]> {
  const grab = () => { try { return (speech.getVoices?.() || []).slice(); } catch { return []; } };
  if (grab().length) return grab();
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; try { speech.removeEventListener?.("voiceschanged", on); } catch {} resolve(grab()); };
    const on = () => { if (grab().length) finish(); };
    try { speech.addEventListener?.("voiceschanged", on); } catch {}
    try { (speech as any).onvoiceschanged = on; } catch {}
    const t0 = Date.now();
    const tick = () => { if (grab().length || Date.now() - t0 > ms) finish(); else setTimeout(tick, 80); };
    tick();
  });
}

export type PlayCtl = { stopped: boolean; osc: { stop: (t?: number) => void }[]; audio?: HTMLAudioElement | null };
export const makeCtl = (): PlayCtl => ({ stopped: false, osc: [], audio: null });

export function stopPlayback(ctl: PlayCtl, speech?: SpeechSynthesis | null) {
  ctl.stopped = true;
  try { speech?.cancel(); } catch {}
  for (const o of ctl.osc) { try { o.stop(); } catch {} }
  ctl.osc = [];
  const a = ctl.audio;
  if (a) {
    try { a.pause(); a.currentTime = 0; } catch {}
  }
}

export const WAV_RATE = 24000;

/** Render notes to 16-bit mono PCM WAV bytes (44-byte header) and the float peak before normalisation. */
export function renderWav(notes: Note[], sampleRate = WAV_RATE, peakTarget = 0.72): { bytes: Uint8Array; peak: number; rawPeak: number; sampleRate: number } {
  const seconds = Math.max(chimeDuration(notes), 0.08);
  const n = Math.max(1, Math.ceil(seconds * sampleRate));
  const samples = new Float32Array(n);
  for (const note of notes) {
    const start = Math.floor(Math.max(0, note.t) * sampleRate);
    const len = Math.floor(Math.max(note.d, 0.05) * sampleRate);
    const vol = note.v ?? 0.55;
    const tri = note.type === "triangle";
    const attack = Math.min(0.018, Math.max(note.d * 0.15, 0.005));
    const remain = Math.max(note.d - attack, 0.02);
    const tau = remain / Math.log(Math.max(vol, 0.002) / 0.001);
    for (let i = 0; i < len && start + i < n; i++) {
      const tm = i / sampleRate;
      const phase = 2 * Math.PI * note.f * tm;
      const s = tri ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase);
      const env = tm < attack ? vol * (tm / attack) : vol * Math.exp(-(tm - attack) / tau);
      samples[start + i] += s * env;
    }
  }
  let rawPeak = 0;
  for (let i = 0; i < n; i++) rawPeak = Math.max(rawPeak, Math.abs(samples[i]));
  const gain = rawPeak > 0 ? peakTarget / rawPeak : 0;
  const pcm = new Int16Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, samples[i] * gain));
    peak = Math.max(peak, Math.abs(x));
    pcm[i] = x < 0 ? x * 0x8000 : x * 0x7fff;
  }
  const dataSize = pcm.length * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + dataSize, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, dataSize, true);
  new Uint8Array(buf, 44).set(new Uint8Array(pcm.buffer, pcm.byteOffset, dataSize));
  return { bytes: new Uint8Array(buf), peak, rawPeak, sampleRate };
}

export function chimeWav(notes: Note[], sampleRate = WAV_RATE): Blob {
  const { bytes } = renderWav(notes, sampleRate);
  return new Blob([bytes.buffer as ArrayBuffer], { type: "audio/wav" });
}

export function encodeDataUri(bytes: Uint8Array): string {
  let bin = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
  }
  const b64 = typeof btoa === "function" ? btoa(bin) : (globalThis as any).Buffer.from(bytes).toString("base64");
  return "data:audio/wav;base64," + b64;
}

export function chimeDataUri(notes: Note[]): string {
  return encodeDataUri(renderWav(notes).bytes);
}

export const BEEP_NOTES: Note[] = [{ f: 880, t: 0, d: 0.45, v: 0.7 }];
export const beepDataUri = () => chimeDataUri(BEEP_NOTES);
export const chimeSrc = (profile: Profile) => `/announce/chime-${profile.id}.wav`;
export const BEEP_SRC = "/announce/beep.wav";

export function playChime(ctx: AudioContext, notes: Note[], ctl?: PlayCtl) {
  try {
    const now = ctx.currentTime;
    for (const n of notes) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = n.type || "sine";
      o.frequency.value = n.f;
      const t0 = now + n.t;
      const vol = Math.max(n.v ?? 0.35, 0.28);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.018);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + Math.max(n.d, 0.05));
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0 + n.d + 0.05);
      ctl?.osc.push(o);
    }
  } catch {}
  return chimeDuration(notes);
}

export function setAudioSession(): string {
  try {
    const s = typeof navigator !== "undefined" ? (navigator as any).audioSession : null;
    if (!s) return "not supported";
    try { s.type = "playback"; } catch (e: any) { return `supported, setting playback threw ${e?.name || e}${s.type ? ` (type=${s.type})` : ""}`; }
    return `supported, type=${s.type || "playback"}`;
  } catch (e: any) {
    return `error: ${e?.name || e}`;
  }
}

export function iosInfo(ua = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  const ios = /iPhone|iPad|iPod/i.test(ua);
  const m = ua.match(/OS (\d+)[._](\d+)/);
  let standalone = false;
  try {
    standalone = !!(typeof navigator !== "undefined" && ((navigator as any).standalone || (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches)));
  } catch {}
  return { ios, version: m ? `${m[1]}.${m[2]}` : ios ? "unknown" : "not iOS", standalone, ua: ua || "(none)" };
}

/** Keep utterance objects alive — WebKit can drop speech if they are garbage-collected. */
export const heldUtterances: SpeechSynthesisUtterance[] = [];
export function holdUtterance(u: SpeechSynthesisUtterance) {
  heldUtterances.push(u);
  if (heldUtterances.length > 40) heldUtterances.splice(0, heldUtterances.length - 20);
}

function startHtmlAudio(audio: HTMLAudioElement, src: string): Promise<void> | void {
  try { audio.setAttribute?.("playsinline", "true"); } catch {}
  try { (audio as any).playsInline = true; } catch {}
  try { audio.preload = "auto"; } catch {}
  audio.src = src;
  try { audio.currentTime = 0; } catch {}
  return audio.play?.();
}

export type PlayHooks = {
  speech?: SpeechSynthesis | null;
  ctx?: AudioContext | null;
  ctl: PlayCtl;
  audio?: HTMLAudioElement | null;
  AudioEl?: { new(): HTMLAudioElement };
  onLine?: (i: number) => void;
  onNote?: (msg: string) => void;
  onDone?: () => void;
  onMissingSpeech?: () => void;
  onPlayError?: (msg: string) => void;
};

/** Queue the chime and every spoken line synchronously — must run inside the tap, with no await and no cancel() before speak(). */
export function startAnnouncement(lines: Line[], profile: Profile, hooks: PlayHooks): void {
  const { ctl } = hooks;
  if (ctl.stopped) return;

  setAudioSession();

  // HTML audio first, in the same tick. Prefer a same-origin file; fall back to a data URI (no blob: URLs — flaky in standalone iOS).
  try {
    const AudioEl = hooks.AudioEl || (typeof Audio !== "undefined" ? Audio : null);
    const audio = hooks.audio || (AudioEl ? new AudioEl() : null);
    if (audio) {
      ctl.audio = audio;
      const played = startHtmlAudio(audio, chimeSrc(profile));
      if (played && typeof (played as Promise<void>).catch === "function") {
        (played as Promise<void>).catch((err: any) => {
          try {
            const retry = startHtmlAudio(audio, chimeDataUri(profile.chime));
            if (retry && typeof (retry as Promise<void>).catch === "function") {
              (retry as Promise<void>).catch((err2: any) => {
                hooks.onPlayError?.(`HTML audio: ${err2?.name || err2 || err?.name || err}`);
                if (hooks.ctx && !ctl.stopped) playChime(hooks.ctx, profile.chime, ctl);
              });
            }
          } catch {
            hooks.onPlayError?.(String(err?.name || err));
            if (hooks.ctx && !ctl.stopped) playChime(hooks.ctx, profile.chime, ctl);
          }
        });
      }
    } else if (hooks.ctx) {
      playChime(hooks.ctx, profile.chime, ctl);
    }
  } catch (e: any) {
    hooks.onPlayError?.(String(e?.name || e));
    try { if (hooks.ctx) playChime(hooks.ctx, profile.chime, ctl); } catch {}
  }

  const speech = hooks.speech;
  const U = (globalThis as any).SpeechSynthesisUtterance;
  if (!speech || typeof speech.speak !== "function" || !U) {
    hooks.onMissingSpeech?.();
    const a = ctl.audio;
    if (a) a.onended = () => { if (!ctl.stopped) hooks.onDone?.(); };
    else hooks.onDone?.();
    return;
  }

  // Do not call speech.cancel() here: on iOS, cancel() in the same tick as speak() can swallow the utterance.

  let voices: SpeechSynthesisVoice[] = [];
  try { voices = speech.getVoices?.() || []; } catch {}

  const queued: number[] = [];
  const notes: string[] = [];
  const finishIfLast = (i: number) => {
    if (ctl.stopped) return;
    if (i === queued[queued.length - 1]) { hooks.onLine?.(-1); hooks.onDone?.(); }
  };

  for (let i = 0; i < lines.length; i++) {
    try {
      const line = lines[i];
      let text = line.speak || line.text;
      let lang = line.lang;
      let voice: SpeechSynthesisVoice | null = null;
      try { if (voices.length) voice = pickVoice(voices, lang, profile.enLocale); } catch {}
      if (voices.length && !voice && lang !== "en") {
        const en = lines.find(l => l.lang === "en");
        let enVoice: SpeechSynthesisVoice | null = null;
        try { enVoice = pickVoice(voices, "en", profile.enLocale); } catch {}
        const label = LANG_NAME[lang];
        if (en) {
          notes.push(`${label} isn’t installed on this phone, so that part is read in English.`);
          text = en.speak || en.text;
          lang = "en";
          voice = enVoice;
        } else {
          notes.push(`${label} isn’t installed on this phone, so that part was skipped.`);
          continue;
        }
      }
      const u = new U(text);
      u.lang = (voice && voice.lang) || LANG_TAG[lang] || profile.enLocale;
      try { if (voice) u.voice = voice; } catch {}
      u.volume = 1;
      u.rate = 0.95;
      u.pitch = 1;
      const idx = i;
      u.onstart = () => { if (!ctl.stopped) hooks.onLine?.(idx); };
      u.onend = () => finishIfLast(idx);
      u.onerror = (ev: any) => {
        hooks.onPlayError?.(`Speech error: ${ev?.error || ev?.name || "onerror"}`);
        finishIfLast(idx);
      };
      holdUtterance(u);
      speech.speak(u);
      queued.push(idx);
    } catch (e: any) {
      hooks.onPlayError?.(`Speech setup: ${e?.name || e}`);
    }
  }
  if (notes.length) hooks.onNote?.(notes[0]);
  if (!queued.length) hooks.onDone?.();
}

/** Test helper: startAnnouncement plus a promise that settles when playback ends (or is already stopped). */
export function playAnnouncement(lines: Line[], profile: Profile, hooks: PlayHooks): Promise<void> {
  return new Promise(resolve => {
    if (hooks.ctl.stopped) { resolve(); return; }
    const prev = hooks.onDone;
    startAnnouncement(lines, profile, {
      ...hooks,
      onDone: () => { try { prev?.(); } catch {} resolve(); },
    });
  });
}

export type SoundCheckUpdate = (lines: string[]) => void;

export function runSoundCheck(opts: {
  audio?: HTMLAudioElement | null;
  AudioEl?: { new(): HTMLAudioElement };
  ctx?: AudioContext | null;
  speech?: SpeechSynthesis | null;
  onUpdate: SoundCheckUpdate;
}): void {
  const info = iosInfo();
  const session = setAudioSession();
  let voices: SpeechSynthesisVoice[] = [];
  try { voices = opts.speech?.getVoices?.() || []; } catch {}
  const voiceList = voices.slice(0, 6).map(v => `${v.name} (${v.lang})`).join(", ") || "none";
  const state: Record<string, string> = {
    speech: opts.speech && typeof opts.speech.speak === "function" ? "yes" : "NO",
    voices: `${voices.length}${voices.length ? " — " + voiceList : ""}`,
    session,
    standalone: info.standalone ? "yes (Home Screen / standalone)" : "no",
    html: "play() not called",
    utter: opts.speech ? "queued, waiting for events" : "speechSynthesis missing",
    ctx: opts.ctx ? (opts.ctx.state || "unknown") : "not created",
    ios: info.ios ? info.version : "not iOS",
    ua: info.ua,
  };
  const lines = () => [
    `speechSynthesis: ${state.speech}`,
    `voices: ${state.voices}`,
    `audioSession: ${state.session}`,
    `standalone: ${state.standalone}`,
    `HTML audio.play(): ${state.html}`,
    `utterance: ${state.utter}`,
    `AudioContext: ${state.ctx}`,
    `iOS version: ${state.ios}`,
    `user agent: ${state.ua}`,
  ];
  opts.onUpdate(lines());

  try {
    const AudioEl = opts.AudioEl || (typeof Audio !== "undefined" ? Audio : null);
    const audio = opts.audio || (AudioEl ? new AudioEl() : null);
    if (audio) {
      const played = startHtmlAudio(audio, BEEP_SRC);
      if (played && typeof (played as Promise<void>).then === "function") {
        (played as Promise<void>).then(() => { state.html = "ok"; opts.onUpdate(lines()); }).catch((err: any) => {
          state.html = `${err?.name || "Error"}: ${err?.message || err}`;
          try {
            const retry = startHtmlAudio(audio, beepDataUri());
            if (retry && typeof (retry as Promise<void>).then === "function") {
              (retry as Promise<void>).then(() => { state.html = `${state.html} — data URI retry: ok`; opts.onUpdate(lines()); })
                .catch((err2: any) => { state.html = `${state.html} — data URI retry: ${err2?.name || err2}`; opts.onUpdate(lines()); });
            }
          } catch (e2: any) { state.html = `${state.html} — data URI retry threw ${e2?.name || e2}`; opts.onUpdate(lines()); }
          opts.onUpdate(lines());
        });
      } else {
        state.html = played === undefined ? "play() returned nothing" : "ok (no promise)";
        opts.onUpdate(lines());
      }
      audio.onerror = () => {
        const code = (audio as any).error?.code;
        const msg = (audio as any).error?.message;
        state.html = `${state.html} (element error code=${code ?? "?"} ${msg || ""})`.trim();
        opts.onUpdate(lines());
      };
    } else {
      state.html = "no <audio> element";
      opts.onUpdate(lines());
    }
  } catch (e: any) {
    state.html = `threw ${e?.name || e}: ${e?.message || ""}`.trim();
    opts.onUpdate(lines());
  }

  try {
    if (opts.ctx) {
      try { opts.ctx.resume?.(); } catch {}
      state.ctx = opts.ctx.state || state.ctx;
      playChime(opts.ctx, BEEP_NOTES);
      state.ctx = `${opts.ctx.state || "unknown"} — beep started`;
      opts.onUpdate(lines());
    }
  } catch (e: any) {
    state.ctx = `error ${e?.name || e}`;
    opts.onUpdate(lines());
  }

  try {
    const speech = opts.speech;
    const U = (globalThis as any).SpeechSynthesisUtterance;
    if (speech && U) {
      const u = new U("Testing one two three");
      u.lang = "en-GB";
      u.volume = 1;
      u.rate = 0.95;
      u.pitch = 1;
      try {
        const v = voices.length ? pickVoice(voices, "en", "en-GB") : null;
        if (v) { u.voice = v; u.lang = v.lang || u.lang; }
      } catch {}
      u.onstart = () => { state.utter = "onstart — speaking"; opts.onUpdate(lines()); };
      u.onend = () => { state.utter = `${state.utter.includes("onstart") ? "onstart, " : ""}onend`; opts.onUpdate(lines()); };
      u.onerror = (ev: any) => { state.utter = `onerror: ${ev?.error || ev?.name || "unknown"}`; opts.onUpdate(lines()); };
      holdUtterance(u);
      speech.speak(u);
      state.utter = "speak() called, waiting for events";
      opts.onUpdate(lines());
    } else {
      state.utter = "speechSynthesis missing";
      opts.onUpdate(lines());
    }
  } catch (e: any) {
    state.utter = `threw ${e?.name || e}: ${e?.message || ""}`.trim();
    opts.onUpdate(lines());
  }
}
