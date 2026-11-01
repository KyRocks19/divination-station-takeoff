import type { DivinationKind } from "./divination-kinds";

// The sources behind the app's explanations, for the Sources pages and the "read more" notes. This file touches no
// database code, so screens that run in the browser can import it.
//
// Each source is judged against three tests the owner set (2026-10-14):
//   lists:  it lists its own sources, so a reader can check it;
//   record: it explains what survives in the historical record and what is hearsay or hypothesis;
//   magick: it treats magick and divination as a serious subject, as something people did and do.
// "unclear" means the checks below could not settle it; it is never a hidden "no".
//
// HOW THESE WERE CHECKED (2026-10-14): edition details and reviews were looked up on the web (library catalogues,
// publishers, and published reviews). The books themselves were NOT read by whoever wrote this. Every judgement
// below comes from reviews and publisher descriptions, and says so where it matters. Page numbers are not given,
// so a marker on a sentence means "this topic is treated there", not "this exact claim is on a given page".

/**
 * Tools that are the app's own design or a log, with no tradition or source list behind them (charm casting, the signs and dreams log, blind-target practice, tasseomancy, ink blots).
 * They have no page on /sources; each says so on its own page. A tool with a tradition behind it is not added here.
 */
export const KINDS_WITHOUT_GUIDE = ["charms", "signs", "remoteview", "tea", "blots"] as const;
export type ToolGuideId = Exclude<DivinationKind, (typeof KINDS_WITHOUT_GUIDE)[number]> | "across";

export type Level = "yes" | "partly" | "no" | "unclear";

export interface Test {
  level: Level;
  note: string;
}

export type SourceKind = "book" | "article" | "journal" | "database" | "primary text" | "museum";

export interface Source {
  id: string;
  kind: SourceKind;
  /** Authors or institution, title, publisher, year: one citation line. */
  cite: string;
  /** How the inline marker reads, for example "Page 1987". */
  short: string;
  /** A page that describes this exact source: a publisher, library, or review page found during the check. */
  url: string;
  urlLabel: string;
  /** What it is, in a sentence or two. */
  about: string;
  lists: Test;
  record: Test;
  magick: Test;
  /** A warning the reader should have before relying on it. */
  caution?: string;
  /** What was checked, when it differs from the default. */
  basis?: string;
}

export const SOURCES_CHECKED_ON = "2026-10-14";

export const DEFAULT_BASIS =
  "Checked on 2026-10-14: edition details and reviews were looked up on the web. The books themselves were not read for this app; the three tests come from reviews and publisher descriptions, and a note on a card says where that is less certain.";

const t = (level: Level, note: string): Test => ({ level, note });

/** The basis of the pages read on 2026-10-18 (I Ching, geomancy, bibliomancy). */
const READ_BASIS =
  "The page was fetched and read for this app on 2026-10-18; it is an encyclopedia article, so its claims should be checked against the works it cites.";

export const SOURCES: Source[] = [
  // ── Tarot ─────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "decker-dummett-2002",
    kind: "book",
    cite: "Ronald Decker and Michael Dummett, A History of the Occult Tarot, 1870 to 1970 (Duckworth, 2002)",
    short: "Decker and Dummett 2002",
    url: "https://search.worldcat.org/title/855350623",
    urlLabel: "Library record (WorldCat)",
    about: "The standard history of how the tarot became an occult tool: the secret societies, the writers, and the decks, up to 1970.",
    lists: t("unclear", "Readers call it a detailed reference work; its notes were not checked here."),
    record: t("yes", "Written by historians of playing cards, who separate documented history from the claims occultists made. A Theosophical Society article says Dummett's approach tended to infuriate modern occultists."),
    magick: t("partly", "It takes occult tarot seriously as a subject of history, not as a source of truth. Practitioners should expect it to doubt their lineages."),
    caution: "Reviewers say it can be hard going and is more a history of esotericism than of the cards. It is a reference, not a reader's companion.",
  },
  {
    id: "farley-2009",
    kind: "book",
    cite: "Helen Farley, A Cultural History of Tarot: From Entertainment to Esotericism (I.B. Tauris, 2009)",
    short: "Farley 2009",
    url: "https://scholarworks.iu.edu/journals/index.php/jfrr/article/view/39391",
    urlLabel: "Review by William Hansen (Journal of Folklore Research Reviews)",
    about: "A scholar's history of the tarot in four periods, from its start as a card game in fifteenth-century Italy to its life as an esoteric tool.",
    lists: t("yes", "An academic press book. The review credits it with bringing together scholars who rarely read each other."),
    record: t("yes", "The reviewer says it calls out a common problem in the field: popular writing that passes on conjecture about tarot as fact."),
    magick: t("yes", "Treats the esoteric and divinatory life of the tarot as part of its cultural history, without ridicule."),
    caution: "Reader reviews say the later chapters on twentieth-century decks are lighter than the early history.",
  },
  {
    id: "place-2005",
    kind: "book",
    cite: "Robert M. Place, The Tarot: History, Symbolism, and Divination (Tarcher/Penguin, 2005)",
    short: "Place 2005",
    url: "https://aeclectic.net/tarot/books/history-symbolism-divination/",
    urlLabel: "Review (Aeclectic Tarot)",
    about: "A tarot artist and historian's account of how the deck developed in medieval and Renaissance Europe, with a chapter on the mythical history and a method for reading.",
    lists: t("unclear", "Not checked. Ask for the notes before relying on it."),
    record: t("partly", "Its publisher says it corrects the Egyptian-origin myth. Its argument that the deck grew from Hermetic, alchemical, and Neoplatonic thought is an interpretation, not an established finding."),
    magick: t("yes", "Written by a working reader and deck-maker who treats divination as a living art."),
    caution: "Reviewed mostly in popular and tarot-community places; no scholarly journal review was found.",
  },
  {
    id: "wicked-pack-1996",
    kind: "book",
    cite: "Michael Dummett, Ronald Decker and Thierry Depaulis, A Wicked Pack of Cards: The Origins of the Occult Tarot (Duckworth, 1996)",
    short: "Decker, Depaulis and Dummett 1996",
    url: "https://www.aeclectic.net/tarot/books/wicked-pack-of-cards/",
    urlLabel: "Review (Aeclectic Tarot)",
    about: "The first volume of the same series: how playing cards and tarot turned into fortune-telling tools in eighteenth-century France, including Etteilla and Mlle Lenormand.",
    lists: t("unclear", "Cited by other scholars (the Etteilla archive cites its chapter 6); its own notes were not checked."),
    record: t("yes", "A historians' book on what the documents show about the first occult uses of cards."),
    magick: t("partly", "Serious about the history of cartomancy; not written to defend it."),
    caution: "Details of this edition were taken from a review page and the Etteilla archive's citation of it.",
  },
  {
    id: "morgan-visconti",
    kind: "museum",
    cite: "Visconti-Sforza Tarot Cards, The Morgan Library & Museum, New York",
    short: "Morgan Library",
    url: "https://www.themorgan.org/manuscript/158525",
    urlLabel: "The Morgan's page for the cards",
    about: "A museum record for some of the oldest surviving tarot cards, painted for the Visconti court in Milan.",
    lists: t("unclear", "A catalogue record; check its listed references."),
    record: t("yes", "It describes objects that still exist."),
    magick: t("unclear", "About the cards as objects, not about divination."),
    basis: "Carried over from the app's earlier checks (2026-10-12); not re-opened on 2026-10-14.",
  },

  // ── Oracle decks (Etteilla, Lenormand, and decks made for divination) ───────────────────────────────────────
  {
    id: "horniman-hechtel",
    kind: "museum",
    cite: "Divination cards, object 1970.18, Horniman Museum and Gardens, London",
    short: "Horniman Museum",
    url: "https://www.horniman.ac.uk/object/1970.18",
    urlLabel: "The Horniman's catalogue record",
    about: "A museum catalogue entry for a set of cards from the lineage of Hechtel's Das Spiel der Hoffnung (The Game of Hope), Nuremberg, 1799, the game that the 36-card \"Lenormand\" decks copy.",
    lists: t("unclear", "A catalogue entry; check its references."),
    record: t("yes", "It describes a physical object and dates the game; it supports the point that the Lenormand name was added later."),
    magick: t("unclear", "About the object, not about practice."),
  },
  {
    id: "etteilla-archive",
    kind: "article",
    cite: "The Petit Lenormand and Oracle decks pages, Etteilla archive (new.etteilla.org)",
    short: "Etteilla archive",
    url: "https://new.etteilla.org/en/families/petit-lenormand/",
    urlLabel: "Etteilla archive: Petit Lenormand",
    about: "A website about Etteilla and the decks that followed him. It says Marie Anne Lenormand had no hand in the 36-card deck, that her name was a publisher's marketing choice, and it cites Decker, Depaulis and Dummett 1996.",
    lists: t("partly", "It cites sources for some claims."),
    record: t("yes", "It separates what Lenormand actually used (ordinary playing cards, piquet packs) from the deck sold under her name."),
    magick: t("yes", "Written for people who care about cartomancy."),
    caution: "Who runs the site was not confirmed in the check. Treat it as a good lead to the books it cites, not as a final authority.",
  },
  {
    id: "george-2014",
    kind: "book",
    cite: "Rana George, The Essential Lenormand: Your Guide to Precise and Practical Fortunetelling (Llewellyn, 2014)",
    short: "George 2014",
    url: "https://tarot.nl/product/the-essential-lenormand-book",
    urlLabel: "Bookshop listing",
    about: "A teacher's handbook for reading the 36-card Lenormand deck, including traditional methods and her own.",
    lists: t("unclear", "Not checked."),
    record: t("no", "A practice book, not a history; it does not document where the deck came from."),
    magick: t("yes", "Written by a reader, for readers."),
    caution: "Use it to learn how people read the deck today, and the Horniman record and the Etteilla archive for where the deck came from.",
  },

  // ── Scrying ───────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "skinner-2014",
    kind: "book",
    cite: "Stephen Skinner, Techniques of Graeco-Egyptian Magic (Golden Hoard Press, 2014)",
    short: "Skinner 2014",
    url: "https://www.suomalainen.com/products/techniques-of-graeco-egyptian-magic",
    urlLabel: "Bookshop listing",
    about: "A guide to the ritual techniques of the Greek magical papyri, grouped by what the texts call them. Scrying (skrying) is one of the techniques it lists.",
    lists: t("yes", "It is built on the papyri themselves, and it notes where techniques come back in later grimoires."),
    record: t("yes", "It starts from surviving texts, not from later lore."),
    magick: t("yes", "Written for people who practise or study magic."),
    caution: "The check did not confirm that it covers bowl divination (lecanomancy) in particular. Look in its index before relying on it for that.",
  },
  {
    id: "peterson-2003",
    kind: "book",
    cite: "Joseph H. Peterson (ed.), John Dee's Five Books of Mystery (Weiser, 2003)",
    short: "Peterson 2003",
    url: "https://openroadmedia.com/ebook/john-dees-five-books-of-mystery/9781609255725",
    urlLabel: "Publisher listing",
    about: "An edition of the manuscripts of John Dee's sessions with his scryer, Edward Kelley. It is the record of one well-documented scrying practice, in the words of the people who did it.",
    lists: t("yes", "A scholarly edition of a manuscript, with its introduction and appendices."),
    record: t("yes", "It is primary evidence. What the sessions were, spiritually, is for the reader to judge."),
    magick: t("yes", "Edited for people who study and practise Dee's system."),
    caution: "A source edition, not a survey. It tells nothing about scrying before Dee.",
  },
  {
    id: "esoteric-archives-sloane",
    kind: "primary text",
    cite: "Dee, Mysteriorum Libri Quinque (British Library, Sloane MS 3188), transcription on the Esoteric Archives",
    short: "Sloane MS 3188",
    url: "https://esotericarchives.com/dee/sl3188.htm",
    urlLabel: "Transcription (Esoteric Archives)",
    about: "A free transcription of the manuscript behind Peterson's edition.",
    lists: t("unclear", "A transcription; its introduction was not read."),
    record: t("yes", "It is the manuscript text."),
    magick: t("yes", "Kept for students of the material."),
  },
  {
    id: "fodor-1994",
    kind: "article",
    cite: "Alexander Fodor, \"The Arabic bowl divination and the Greek magical papyri\", The Arabist 9 to 10 (1994)",
    short: "Fodor 1994",
    url: "https://arabist.hu/volumes/volume-9-10/alexander-fodor-1994/",
    urlLabel: "The Arabist, volumes 9 to 10",
    about: "A scholar's article tracing bowl divination from the Greek papyri into Arabic practice.",
    lists: t("unclear", "Scholarly article; notes not checked."),
    record: t("yes", "A study of surviving texts."),
    magick: t("yes", "Treats the practice as a real part of the history of religion."),
    basis: "Carried over from the app's earlier checks (2026-10-12); not re-opened on 2026-10-14.",
  },

  // ── Pendulum and dowsing ──────────────────────────────────────────────────────────────────────────────────
  {
    id: "vogt-hyman-1959",
    kind: "book",
    cite: "Evon Z. Vogt and Ray Hyman, Water Witching U.S.A. (University of Chicago Press, 1959; second edition 1979; paperback 2000)",
    short: "Vogt and Hyman 1959",
    url: "https://catalogue.nli.ie/Record/vtls000412416",
    urlLabel: "Library record",
    about: "An anthropologist and a psychologist on dowsing: accounts from dowsers, the history, a national survey, and controlled tests.",
    lists: t("yes", "A scholarly book with a bibliography; this was not opened."),
    record: t("yes", "The most careful record of what dowsers did and what the tests showed."),
    magick: t("partly", "It takes dowsers seriously as people and as a subject, and tests their claims; it does not support them."),
    caution: "Written by sceptics. If you hold that something beyond the ideomotor effect is at work, read it for the evidence and the history, and weigh its conclusions yourself.",
  },
  {
    id: "graves-1989",
    kind: "book",
    cite: "Tom Graves, Elements of Pendulum Dowsing (Element Books, 1989; now Tetradian Books)",
    short: "Graves 1989",
    url: "https://leanpub.com/pendulumdowsing/read",
    urlLabel: "Current edition (Leanpub)",
    about: "A dowser's guide to the pendulum, including whether there is a scientific basis for dowsing and how it relates to the mind.",
    lists: t("unclear", "Not checked."),
    record: t("partly", "It asks the question of evidence openly; it is a practice book, not a history."),
    magick: t("yes", "Written by a practitioner, who elsewhere describes four disciplines of dowsing: artist, scientist, mystic, and magician."),
  },
  {
    id: "spr-dowsing",
    kind: "article",
    cite: "\"Dowsing\", Psi Encyclopedia, Society for Psychical Research",
    short: "Psi Encyclopedia, Dowsing",
    url: "https://psi-encyclopedia.spr.ac.uk/articles/dowsing/",
    urlLabel: "The article",
    about: "An article from the society that began investigating dowsing in the 1880s, covering the history and the research since.",
    lists: t("yes", "Encyclopedia articles list references; this one was not read through."),
    record: t("yes", "It reports early findings that favoured a psychological explanation and later reviews that found the evidence promising but not conclusive."),
    magick: t("yes", "Written by a society that treats psychic claims as worth testing."),
    caution: "The society's reading of the evidence is not the mainstream reading. This app does not say that anything beyond the body is at work, and does not say it is not.",
  },
  {
    id: "chevreul-1833",
    kind: "article",
    cite: "M. E. Chevreul, letter to Ampère on the pendulum (1833), in English translation (Spitz and Marcuard), reproduced by the Center for Inquiry",
    short: "Chevreul 1833",
    url: "https://cdn.centerforinquiry.org/wp-content/uploads/sites/29/2001/07/22164826/p35.pdf",
    urlLabel: "Dowsing and the pendulum (Center for Inquiry, PDF)",
    about: "The chemist's own experiments with a hand-held pendulum: its swing stopped when the hand was screened from view or held fixed. One of the earliest accounts of the ideomotor effect.",
    lists: t("unclear", "A translation of a primary text."),
    record: t("yes", "It is the experiment itself."),
    magick: t("partly", "Serious as a question; it argues the movement comes from the holder."),
    basis: "Carried over from the app's earlier checks (2026-10-12) and the 2026-10-14 search.",
  },

  // ── Runes ─────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "page-1987",
    kind: "book",
    cite: "R. I. Page, Runes (British Museum / University of California Press, Reading the Past series, 1987)",
    short: "Page 1987",
    url: "https://en.wikipedia.org/wiki/R._I._Page",
    urlLabel: "About the author (Wikipedia)",
    about: "A short survey of the runic inscriptions, from the earliest carvings of the late second century to the memorial stones of Scandinavia, Orkney, Shetland, Ireland, and Man. Page was widely seen as the leading authority on English runes.",
    lists: t("unclear", "A short book for general readers; its further reading was not checked."),
    record: t("yes", "A runologist's account of what the inscriptions say."),
    magick: t("partly", "Neutral. It is about inscriptions, not about practice."),
    caution: "For English runes in depth, he also wrote An Introduction to English Runes.",
  },
  {
    id: "macleod-mees-2006",
    kind: "book",
    cite: "Mindy MacLeod and Bernard Mees, Runic Amulets and Magic Objects (Boydell, 2006)",
    short: "MacLeod and Mees 2006",
    url: "https://boydellandbrewer.com/?p=54146",
    urlLabel: "Publisher listing",
    about: "A survey of inscriptions that may be magical: invocations of gods and heroes, charms against disease, and love charms. It asks whether they are magic at all, a question scholars are split on.",
    lists: t("yes", "A scholarly press book. A review in Saga-Book called it a very complete survey of possibly magico-religious runic inscriptions."),
    record: t("yes", "Built on the inscriptions that survive, and it sets out where scholars disagree."),
    magick: t("yes", "Takes the possibility of rune magic seriously and tests it against the evidence."),
    caution: "One commentator reports that critics find it less searching than it should be and too reliant on two scholars who are not runologists. Read its conclusions with that in mind.",
  },
  {
    id: "flowers-1986",
    kind: "book",
    cite: "Stephen E. Flowers, Runes and Magic: Magical Formulaic Elements in the Older Runic Tradition (Peter Lang, 1986; later Runa-Raven)",
    short: "Flowers 1986",
    url: "https://en.wikipedia.org/wiki/Stephen_Flowers",
    urlLabel: "About the author (Wikipedia)",
    about: "An academic study of the formulas on older runic inscriptions and how they might count as magical, from the author's doctoral dissertation.",
    lists: t("yes", "Written as a dissertation."),
    record: t("yes", "It works from inscriptions and asks what \"magical\" could mean in early Germanic culture."),
    magick: t("yes", "The author is also a practising occultist (as Edred Thorsson), so it is written from inside the subject."),
    caution: "Sources disagree on its publication year (1986 or 1987). Flowers's later books are esoteric practice, not scholarship; keep them apart from this one.",
  },
  {
    id: "osborn-longland-1982",
    kind: "book",
    cite: "Marijane Osborn and Stella Longland, Rune Games (Routledge and Kegan Paul, 1982)",
    short: "Osborn and Longland 1982",
    url: "https://museumofwitchcraftandmagic.co.uk/?p=18117",
    urlLabel: "Museum of Witchcraft and Magic's page",
    about: "A popular book on the Anglo-Saxon rune row and its rune poem, with illustrations in the style of the Book of Kells.",
    lists: t("unclear", "Not checked."),
    record: t("partly", "It centres on the Anglo-Saxon rune poem, which survives only in a printing of 1705; it is a popular and esoteric work, not academic runology."),
    magick: t("yes", "A book for people who use runes."),
    caution: "It is about the Anglo-Saxon futhorc, not the Elder Futhark the app uses.",
  },
  {
    id: "rundata",
    kind: "database",
    cite: "Samnordisk runtextdatabas (Scandinavian Runic-text Database), Uppsala University",
    short: "Rundata",
    url: "https://www.uu.se/institution/nordiska/forskning/projekt/samnordisk-runtextdatabas",
    urlLabel: "Uppsala University project page",
    about: "A database of Nordic runic texts, about 6,500 inscriptions with transliteration, normalised text, English translation, date, and find place. Searchable online through Runor.",
    lists: t("yes", "Each entry gives its source and further reading."),
    record: t("yes", "It is the record: what is carved and where."),
    magick: t("unclear", "A research tool; it does not interpret practice."),
  },
  {
    id: "tacitus-germania",
    kind: "primary text",
    cite: "Tacitus, Germania 10 (about 98 CE), English translation on Sacred Texts",
    short: "Tacitus, Germania 10",
    url: "https://sacred-texts.com/cla/tac/g01010.htm",
    urlLabel: "Translation (Sacred Texts)",
    about: "A Roman writer's short account of how Germanic peoples cast lots: marked strips cut from a fruit-bearing tree, thrown on a white cloth, and picked up three times.",
    lists: t("no", "It is a primary text."),
    record: t("yes", "It is the evidence. It does not say what the marks were; some commentators assume they were runes, which is an opinion."),
    magick: t("yes", "Describes lot-casting as a serious act of the state or the household."),
    caution: "Translations differ (\"fruit-bearing\" or \"nut-bearing\"), and a Roman outsider wrote it.",
  },

  // ── Ogham ─────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "mcmanus-1991",
    kind: "book",
    cite: "Damian McManus, A Guide to Ogam (An Sagart, Maynooth Monographs 4, 1991)",
    short: "McManus 1991",
    url: "https://codecs.vanhamel.nl/McManus_(Damian)_1991a",
    urlLabel: "Bibliographic record",
    about: "The standard scholarly introduction to the ogham script: its letters, its origin, its inscriptions, and the medieval learned tradition about it. McManus is a professor of Early Irish at Trinity College Dublin.",
    lists: t("yes", "The catalogue records a bibliography and an index; a bibliography calls it a good introduction with an extensive bibliography."),
    record: t("yes", "A philologist's account of the stones and manuscripts."),
    magick: t("partly", "Scholarly. It does not teach divination."),
    caution: "It was reviewed in Medium Aevum (61/1) by Erich Poppe; that review was not read.",
  },
  {
    id: "ogham-in-3d",
    kind: "database",
    cite: "Ogham in 3D, School of Celtic Studies, Dublin Institute for Advanced Studies",
    short: "Ogham in 3D",
    url: "https://www.dias.ie/?p=3957",
    urlLabel: "DIAS launch page",
    about: "A website with 3D scans of Irish ogham stones, with transcriptions, translations, and commentary. About 400 Irish inscriptions exist; the project began with the stones in state care.",
    lists: t("yes", "Each stone has commentary and a record of earlier readings."),
    record: t("yes", "It shows the stones themselves, which carry text along their edges."),
    magick: t("unclear", "A research tool."),
    caution: "Not every stone has been scanned yet.",
  },
  {
    id: "cisp",
    kind: "database",
    cite: "Celtic Inscribed Stones Project (CISP), University College London; archive held by the Archaeology Data Service",
    short: "CISP",
    url: "https://archaeologydataservice.ac.uk/archives/view/cisp_2003",
    urlLabel: "Archive record",
    about: "A database of the inscribed stones of the Celtic-speaking regions, about 400 to 1100 CE, in ogham and in the Roman alphabet.",
    lists: t("yes", "A catalogue with records for each stone."),
    record: t("yes", "A record of what exists."),
    magick: t("unclear", "A research tool."),
    caution: "The project's original website was reported offline in 2019; use the Archaeology Data Service archive.",
  },
  {
    id: "laurie-2007",
    kind: "book",
    cite: "Erynn Rowan Laurie and John Michael Greer, Ogam: Weaving Word Wisdom (Megalithica/Immanion Press, 2007)",
    short: "Laurie and Greer 2007",
    url: "https://www.spiralnature.com/?p=1925",
    urlLabel: "Review (Spiral Nature)",
    about: "A practitioner's book on ogham from a Celtic Reconstructionist view: the roots of each letter's name in Gaelic language and culture, divination, and ritual use.",
    lists: t("partly", "It draws on the medieval texts; the review praises its honesty in marking where the author fills gaps."),
    record: t("partly", "The reviewer says the author is candid about mixing verified tradition with personal inspiration. That is what to look for, and why to keep it next to McManus."),
    magick: t("yes", "Written by a practitioner, for practitioners."),
    caution: "The only review found was personal rather than academic, and the publisher's praise is promotion. The co-author credit is from the publisher's listing and was not verified.",
  },
  {
    id: "murray-1988",
    kind: "book",
    cite: "Liz and Colin Murray, The Celtic Tree Oracle: A System of Divination (Rider, 1988; a book with a deck of 25 cards)",
    short: "Murray 1988",
    url: "https://store.druidry.org/products/the-celtic-tree-oracle",
    urlLabel: "Listing (Order of Bards, Ovates and Druids shop)",
    about: "A modern ogham deck and book. It gives the five later letters the names most divination books now use (Koad, Oir, Uilleand, Phagos, Mor) and a divination meaning for each of the 25.",
    lists: t("unclear", "Not settled in the check: the book was not seen, only listings and practitioners' summaries of it."),
    record: t("unclear", "Practitioners' summaries describe it as a working system, not a historical study; it builds partly on Robert Graves."),
    magick: t("yes", "Written for people who divine with it."),
    caution: "Its later-letter names and which shape each goes with are its own scheme; other writers match them differently. The readings quoted in the app came from summaries of it, not from the book.",
  },
  {
    id: "greer-2006",
    kind: "book",
    cite: "John Michael Greer, The Druidry Handbook: Spiritual Practice Rooted in the Living Earth (Weiser, 2006)",
    short: "Greer 2006",
    url: "https://paganbookreviews.net/2009/02/06/the-druidry-handbook-by-john-michael-greer",
    urlLabel: "Review (Pagan Book Reviews)",
    about: "A handbook of modern druid practice by a former head of the Ancient Order of Druids in America. It includes an ogham system with an upright and a reversed reading for each letter, the five later letters among them.",
    lists: t("unclear", "Not settled in the check: only a review and practitioners' summaries were read."),
    record: t("partly", "A practitioner's handbook; summaries say it notes that the Irish sources give the later letters far less symbolism than the main twenty."),
    magick: t("yes", "Written by a practitioner, for practitioners."),
    caution: "One summary credits these readings to this book and another to the same author's The Druid Magic Handbook (2007); check which before quoting either.",
  },
  {
    id: "wp-white-goddess",
    kind: "article",
    cite: "The White Goddess (Wikipedia), for Robert Graves's \"tree calendar\" and how scholars received it",
    short: "Wikipedia, The White Goddess",
    url: "https://en.wikipedia.org/wiki/The_White_Goddess",
    urlLabel: "The article",
    about: "A summary of Graves's 1948 book. It says the \"tree calendar\" has no link to any historical Celtic calendar and that scholars criticised the book's philology.",
    lists: t("yes", "Wikipedia gives references; follow them rather than relying on the page."),
    record: t("partly", "A summary of scholarly opinion, not a study."),
    magick: t("unclear", "Not its aim."),
    caution: "A stopgap. A better source for this claim is a historian of modern witchcraft; see Hutton below, whose chapter on Graves was not located in the check.",
  },

  // ── Dice, coins, and lots ─────────────────────────────────────────────────────────────────────────────────
  {
    id: "johnston-2008",
    kind: "book",
    cite: "Sarah Iles Johnston, Ancient Greek Divination (Wiley-Blackwell, 2008)",
    short: "Johnston 2008",
    url: "https://bmcr.brynmawr.edu/?p=26924",
    urlLabel: "Review (Bryn Mawr Classical Review)",
    about: "The first English-language survey of Greek divination methods, including the drawing of lots, a simple yes-or-no form that existed alongside the spoken oracles.",
    lists: t("yes", "An academic survey with references; reviewers discuss its handling of the sources."),
    record: t("yes", "Reviewers note it argues from the evidence and from what archaeology has not found."),
    magick: t("yes", "Treats divination as a real part of Greek religion. A reviewer notes it does not take up the old debate over whether magic and religion differ."),
    caution: "It leaves out Roman divination and uses technical Greek terms freely.",
  },
  {
    id: "anthropozoologica-2022",
    kind: "article",
    cite: "Gaming and divination pieces: markers of ownership, or all three?, Anthropozoologica 57(6) (2022)",
    short: "Anthropozoologica 2022",
    url: "https://bioone.org/journals/anthropozoologica/volume-57/issue-6/anthropozoologica2022v57a6/Gaming-and-divination-pieces-markers-of-ownership-or-all-three/10.5252/anthropozoologica2022v57a6.full",
    urlLabel: "The article (BioOne)",
    about: "An archaeology article on knucklebones and similar pieces: whether they were for play, for divination, or for marking ownership.",
    lists: t("yes", "A peer-reviewed article with references."),
    record: t("yes", "Its question is exactly what the finds can and cannot show."),
    magick: t("yes", "Treats divination as a possible use, equal with gaming."),
    basis: "Carried over from the app's earlier checks (2026-10-11).",
  },
  {
    id: "britannica-1911-knucklebones",
    kind: "article",
    cite: "Knucklebones, Encyclopaedia Britannica, 11th edition (1911), on Wikisource",
    short: "Britannica 1911",
    url: "https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Knucklebones",
    urlLabel: "The article (Wikisource)",
    about: "An encyclopaedia article on the game of knucklebones and the ancient Greek and Roman games played with the ankle bones of animals, including the values given to the four sides.",
    lists: t("unclear", "It was not checked whether the article lists its sources."),
    record: t("partly", "It says \"probably\" about origins, but gives the values of the four sides without any doubt, and other accounts differ about which side carried which value."),
    magick: t("unclear", "It is about the game. It does not take up divination."),
    caution: "A game article from 1911. Accounts differ about which side of the bone carried which value, so the app uses it only for the set of values (1, 3, 4 and 6) and, with the two cards after it, for the words that describe the bone's shape, not for naming sides.",
    basis: "Looked up on 2026-10-17 and again on 2026-10-18: the side values, the lowest throw and the shape words (\"two broad and two narrow sides, one of each pair being concave and one convex\") were checked in the article text through a web fetch that summarised the page. The article was not read in full.",
  },
  {
    id: "smith-talus",
    kind: "article",
    cite: "Talus, in Smith's Dictionary of Greek and Roman Antiquities, on LacusCurtius (the edition was not checked)",
    short: "Smith's Dictionary, Talus",
    url: "https://penelope.uchicago.edu/Thayer/E/Roman/Texts/secondary/SMIGRA*/Talus.html",
    urlLabel: "The article (LacusCurtius)",
    about: "A reference article on the game of knucklebones in Greece and Rome. It names the four values, gives the Greek and Latin name of each (the Dog for the lowest) and says the bone lands on a broad or a narrow side.",
    lists: t("unclear", "It was not checked whether the article lists its sources."),
    record: t("unclear", "It lists several names for the same value from different ancient authors and does not call them disagreements; this was not checked further."),
    magick: t("unclear", "It is about the game. It does not take up divination."),
    caution: "It says the bone has broad and narrow sides, but it does not describe each side's shape in words, so the app uses it only for that and for the pairs (1 opposite 6, 3 opposite 4).",
    basis: "Looked up on 2026-10-18 through a web fetch that summarised the page. The article was not read in full.",
  },
  {
    id: "wp-astragalomancy",
    kind: "article",
    cite: "Astragalomancy, Wikipedia (read 2026-10-18)",
    short: "Wikipedia, Astragalomancy",
    url: "https://en.wikipedia.org/wiki/Astragalomancy",
    urlLabel: "The article (Wikipedia)",
    about: "An encyclopaedia article on divination with knucklebones. It describes the bone as oblong, with two narrow sides (one flat, one concave) and two broad sides (one concave, one convex), and says opposite sides add up to seven.",
    lists: t("unclear", "It has references; they were not checked here."),
    record: t("unclear", "Not checked."),
    magick: t("partly", "It treats divination with the bones as a practice with a history."),
    caution: "A crowd-written article that changes. It agrees with the 1911 article that there are two broad and two narrow sides, but calls one narrow side flat where the 1911 article says convex. The app's words for the two narrow sides allow for that.",
    basis: "Read on 2026-10-18 through a web fetch that summarised the page. It does not say which value goes on which side.",
  },
  {
    id: "pausanias-bura",
    kind: "primary text",
    cite: "Pausanias, Description of Greece 7.25 (the oracle of Heracles at Bura), on Perseus",
    short: "Pausanias 7.25",
    url: "https://fgh.perseids.org/read/greekLit/tlg0525/tlg001/perseus-eng2/7.25.4-7.26.2",
    urlLabel: "Text (Perseus)",
    about: "A second-century travel writer's description of a cave oracle where four dice were thrown and a tablet gave the meaning of each combination.",
    lists: t("no", "A primary text."),
    record: t("yes", "It is the evidence; translators say the passage is hard to read."),
    magick: t("yes", "Describes the oracle as people used it."),
    basis: "Carried over from the app's earlier checks (2026-10-11).",
  },
  {
    id: "smith-1991",
    kind: "book",
    cite: "Richard J. Smith, Fortune-tellers and Philosophers: Divination in Traditional Chinese Society (Westview, 1991)",
    short: "Smith 1991",
    url: "https://www.cambridge.org/core/journals/journal-of-asian-studies/article/fortunetellers-and-philosophers-divination-in-traditional-chinese-society-by-richard-j-smith-boulder-colo-westview-press-1991-xiii-434-pp-4950/272320A55BF4FD2E6834ECF6100A2D75",
    urlLabel: "Review (Journal of Asian Studies)",
    about: "A history of Chinese divination, including the Yijing, geomancy, astrology, and spirit-writing, and how it connected to philosophy, science, and medicine.",
    lists: t("yes", "A scholarly book, reviewed in the Journal of Asian Studies."),
    record: t("yes", "A historian's account. The app's note on coin-casting for the I Ching (a later method than yarrow stalks, in favour by the Southern Song) fits the area it covers; the exact claim was not matched to a page."),
    magick: t("yes", "Argues divination ordered the future as history ordered the past, and treats it as central to its culture."),
  },
  {
    id: "mipham-goldberg",
    kind: "book",
    cite: "Jamgon Mipham, Mo: The Tibetan Divination System, translated by Jay Goldberg (Snow Lion)",
    short: "Mipham, translated by Goldberg",
    url: "https://www.shambhala.com/mo-2630.html",
    urlLabel: "Publisher page (Shambhala)",
    about: "The best-known system of Tibetan dice divination, in translation. Two throws of a die give one of 36 answers. Its authority is said to come from Manjushri.",
    lists: t("partly", "The introduction names the Kalachakra Tantra and other texts as its basis; publishers describe the sources differently."),
    record: t("partly", "It is the tradition's own text, not a history."),
    magick: t("yes", "A practice text from a living tradition."),
    caution: "It belongs to a living tradition, so the app does not reproduce it. Read it as the tradition presents itself, and ask a teacher if you want to use it.",
  },

  // ── Across the tools ──────────────────────────────────────────────────────────────────────────────────────
  {
    id: "hutton-1999",
    kind: "book",
    cite: "Ronald Hutton, The Triumph of the Moon: A History of Modern Pagan Witchcraft (Oxford University Press, 1999)",
    short: "Hutton 1999",
    url: "https://journal.equinoxpub.com/POM/article/view/2765",
    urlLabel: "Reviews (Pomegranate)",
    about: "A historian's account of how modern pagan witchcraft arose, from the magical and literary world around it to the people who shaped it, including Robert Graves.",
    lists: t("yes", "An Oxford University Press history with notes."),
    record: t("yes", "It tests widely believed claims (a universal Goddess, huge numbers of executed witches) against the evidence."),
    magick: t("yes", "Written with respect for the people and the practice; reception among Pagans has been mixed, with many accepting it as authoritative and some critical."),
    caution: "The chapter on Graves was not located in the check; use the index.",
  },
  {
    id: "davies-2009",
    kind: "book",
    cite: "Owen Davies, Grimoires: A History of Magic Books (Oxford University Press, 2009)",
    short: "Davies 2009",
    url: "https://timeshighereducation.com/node/81734",
    urlLabel: "Review (Times Higher Education)",
    about: "The history of the books of magic, from the ancient Middle East to modern America, showing who really owned and used them.",
    lists: t("yes", "An Oxford University Press history."),
    record: t("yes", "A central theme is that the contents never lived up to the books' reputations, and it corrects the idea that grimoires belonged only to elite scholars."),
    magick: t("yes", "A serious history of how people practised."),
    caution: "Not confirmed to cover scrying or any one tool; it is general background.",
  },
  {
    id: "pomegranate",
    kind: "journal",
    cite: "Pomegranate: The International Journal of Pagan Studies (Equinox)",
    short: "Pomegranate",
    url: "https://equinoxpub.com/projects/pomegranate",
    urlLabel: "Publisher page",
    about: "A peer-reviewed journal on historical, sociological, and anthropological work on contemporary Paganism and older pagan religion, published twice a year since 2004 (in its present form from 2001).",
    lists: t("yes", "A peer-reviewed journal."),
    record: t("yes", "That is its job."),
    magick: t("yes", "Edited for people who study Paganism."),
    caution: "Articles differ in quality of fit; read the abstract first.",
  },
  {
    id: "museum-of-witchcraft",
    kind: "museum",
    cite: "Museum of Witchcraft and Magic, Boscastle, Cornwall",
    short: "Museum of Witchcraft and Magic",
    url: "https://museumofwitchcraftandmagic.co.uk/",
    urlLabel: "The museum's website",
    about: "A museum of European witchcraft and magic with a reference library that researchers can ask to use. It began under Cecil Williamson in 1951.",
    lists: t("unclear", "A museum; ask what its library holds."),
    record: t("yes", "It shows real objects and papers."),
    magick: t("yes", "Run by and for people who care about the subject."),
    caution: "A travel site gave the library's size (over 3,000 books), but a museum should confirm that. Write to ask about access.",
  },
  // ── I Ching, geomancy and bibliomancy (added 2026-10-18; each page below was fetched and read that day) ─────────────────────
  {
    id: "wp-iching",
    kind: "article",
    cite: "I Ching, Wikipedia (read 2026-10-18)",
    short: "Wikipedia, I Ching",
    url: "https://en.wikipedia.org/wiki/I_Ching",
    urlLabel: "The article",
    about: "An overview of the Zhou yi, the divination text from the Western Zhou, its commentaries (the Ten Wings) and its history of use and translation.",
    lists: t("yes", "It cites academic work, including Edward Shaughnessy's dating of the text."),
    record: t("yes", "It separates what the Shanghai Museum slips and the Zuo zhuan show from the traditional attributions to King Wen and Confucius, which it says are no longer generally accepted."),
    magick: t("partly", "It treats the text as a historical and literary work first, and divination as one of its uses."),
    caution: "Only the first part of the article was read (the rest, on translations, was cut off), so nothing here is taken from its translation section.",
    basis: READ_BASIS,
  },
  {
    id: "wp-hexagrams",
    kind: "article",
    cite: "List of hexagrams of the I Ching, Wikipedia (read 2026-10-18)",
    short: "Wikipedia, list of hexagrams",
    url: "https://en.wikipedia.org/wiki/List_of_hexagrams_of_the_I_Ching",
    urlLabel: "The list",
    about: "A table of the 64 hexagrams in the usual King Wen order: number, character, pinyin, an English name and the two trigrams of each.",
    lists: t("partly", "A reference table; the names are glosses, and translators render them differently."),
    record: t("yes", "It gives the fixed facts of the sequence and does not claim a meaning beyond the names."),
    magick: t("unclear", "A neutral reference; it takes no position on divination."),
    basis: READ_BASIS,
  },
  {
    id: "wp-iching-divination",
    kind: "article",
    cite: "I Ching divination, Wikipedia (read 2026-10-18)",
    short: "Wikipedia, I Ching divination",
    url: "https://en.wikipedia.org/wiki/I_Ching_divination",
    urlLabel: "The article",
    about: "How a hexagram is cast: the yarrow-stalk method, the three-coin method, the four line values and their odds, and how changing lines make a second hexagram.",
    lists: t("partly", "It cites Wilhelm and Baynes and other works; the odds in its table are standard and can be checked by counting."),
    record: t("yes", "It notes that how yarrow stalks were first turned into numbers is uncertain."),
    magick: t("yes", "It describes the practice as practitioners use it."),
    basis: READ_BASIS,
  },
  {
    id: "legge-1882",
    kind: "primary text",
    cite: "James Legge, trans., The Yî King, in The Sacred Books of the East, vol. 16 (Oxford: Clarendon Press, 1882)",
    short: "Legge 1882",
    url: "https://www.sacred-texts.com/ich/index.htm",
    urlLabel: "Full text at Sacred Texts",
    about: "The first complete English translation by a scholar working from the Chinese, with Legge's long introduction. It is in the public domain.",
    lists: t("yes", "A scholarly translation with notes and an introduction."),
    record: t("yes", "It gives the text and the commentaries called the Ten Wings in full, as Legge understood them."),
    magick: t("partly", "Legge read it as an ancient Chinese classic; he was sceptical of divination, so read his introduction with that in mind."),
    caution: "Its English is of 1882 and its readings have been revised by later scholars. The site could not be opened by the tool used here on 2026-10-18 (it refused automated requests); a web search showed the volume is there and public domain.",
    basis: "Public-domain status and availability were found by a web search on 2026-10-18. The book itself was not read for this app.",
  },
  {
    id: "wp-geomancy",
    kind: "article",
    cite: "Geomancy, Wikipedia (read 2026-10-18)",
    short: "Wikipedia, geomancy",
    url: "https://en.wikipedia.org/wiki/Geomancy",
    urlLabel: "The article",
    about: "Divination by lines of dots made in sand or on paper: the Arabic form, the Latin form that came from it, and the related systems of West Africa and Madagascar.",
    lists: t("partly", "It cites scholarship, but the figure tables are shown as pictures and could not be read as text."),
    record: t("yes", "It separates the sources from legend."),
    magick: t("yes", "It treats the practice as something people did and do."),
    basis: READ_BASIS,
  },
  {
    id: "wp-arabic-geomancy",
    kind: "article",
    cite: "Arabic geomancy, Wikipedia (read 2026-10-18)",
    short: "Wikipedia, Arabic geomancy",
    url: "https://en.wikipedia.org/wiki/Arabic_geomancy",
    urlLabel: "The article",
    about: "How the sixteen lines of marks are made and reduced to the four Mothers, and how the Daughters, Nieces, Witnesses, Judge and Reconciler are derived; the shield chart and the house chart; the Latin translations of the twelfth century.",
    lists: t("partly", "It draws on Stephen Skinner's work and says which statements still need sources."),
    record: t("yes", "It marks legend (Idris, Hermes) as legend and flags claims that lack a source."),
    magick: t("yes", "It describes the practice as practitioners use it."),
    caution: "The article itself notes that the Golden Dawn simplified geomancy into lookup tables, so later accounts can differ from older practice, and that the order in which the figures go into the twelve houses varied between groups.",
    basis: READ_BASIS,
  },
  {
    id: "wp-geomantic-figures",
    kind: "article",
    cite: "Geomantic figures, Wikipedia (read 2026-10-18)",
    short: "Wikipedia, geomantic figures",
    url: "https://en.wikipedia.org/wiki/Geomantic_figures",
    urlLabel: "The article",
    about: "The sixteen figures by their Latin names, with their usual English meanings and the correspondences writers have given them.",
    lists: t("partly", "It cites medieval and modern writers; the line patterns are pictures that could not be read as text."),
    record: t("partly", "It records that the correspondences (planets, signs, elements) are not the same in every source, and its own tables disagree in places."),
    magick: t("yes", "It treats the figures as part of a practice."),
    caution: "The correspondences of figures to planets and signs differ between authors, and this app gives none. Only the name, the English meaning of the name and the pattern of dots are taken from sources.",
    basis: READ_BASIS,
  },
  {
    id: "wp-house-astrology",
    kind: "article",
    cite: "House (astrology), Wikipedia (read 2026-10-18)",
    short: "Wikipedia, houses",
    url: "https://en.wikipedia.org/wiki/House_(astrology)",
    urlLabel: "The article",
    about: "The twelve houses of astrology with their traditional Latin names and topics (Vita, Lucrum, Fratres and so on), which European geomancy borrowed for its house chart.",
    lists: t("partly", "It cites astrological handbooks; the table gives both traditional and modern titles."),
    record: t("partly", "It says plainly that the modern titles are not the traditional ones."),
    magick: t("yes", "It treats the system on its own terms."),
    caution: "That geomancy takes these same twelve topics for its houses comes from the geomancy articles above; this page is about astrology.",
    basis: READ_BASIS,
  },
  {
    id: "wp-bibliomancy",
    kind: "article",
    cite: "Bibliomancy, Wikipedia (read 2026-10-18)",
    short: "Wikipedia, bibliomancy",
    url: "https://en.wikipedia.org/wiki/Bibliomancy",
    urlLabel: "The article",
    about: "Divination by opening a book at random and reading what the eye falls on: the Roman sortes, Christian and Islamic use of scripture, the Persian falnama, and modern examples.",
    lists: t("partly", "It lists its references, but several of its dates are missing and one claim is marked as needing a citation."),
    record: t("partly", "It gives few precise dates for the Roman, medieval and Persian practices."),
    magick: t("yes", "It treats the practice across religions without ranking them."),
    basis: READ_BASIS,
  },
  {
    id: "wp-sortes-vergilianae",
    kind: "article",
    cite: "Sortes Vergilianae, Wikipedia (read 2026-10-18)",
    short: "Wikipedia, Sortes Vergilianae",
    url: "https://en.wikipedia.org/wiki/Sortes_Vergilianae",
    urlLabel: "The article",
    about: "The Roman and later practice of opening Virgil, mostly the Aeneid, for a line that answers a question; the stories told of Hadrian and Alexander Severus.",
    lists: t("partly", "It cites classical and later sources; the exact dates of the emperors' draws are not given."),
    record: t("partly", "It says the practice 'may date to as early as the second century AD' and gives no firmer date."),
    magick: t("yes", "It treats the practice as a real custom."),
    basis: READ_BASIS,
  },

  // ── Tea leaves (which tea to use; read 2026-10-25) ────────────────────────────────────────────────────────
  {
    id: "highland-seer-tea",
    kind: "primary text",
    cite: "A Highland Seer, Tea-Cup Reading and Fortune-Telling by Tea Leaves (late nineteenth or early twentieth century; Project Gutenberg ebook 18241, 2006)",
    short: "Highland Seer",
    url: "https://www.gutenberg.org/ebooks/18241",
    urlLabel: "The book (Project Gutenberg)",
    about: "A popular handbook of tea-cup reading: how to brew, drain and turn the cup, and a long list of shapes and what they are said to mean.",
    lists: t("no", "It names no sources; it gives the method as the author's own knowledge."),
    record: t("no", "It is itself part of the record: a witness to how tea-cup reading was taught in Britain at the time, not a history of it."),
    magick: t("yes", "Written by a practitioner for practitioners."),
    caution: "The author is unnamed and the book is undated (Gutenberg gives no year). The app takes only one thing from it: that China tea is best, and that Indian tea and cheap blends hold too much dust and stem.",
    basis: "The book was fetched and read for this app on 2026-10-25, for its advice on which tea to use.",
  },
  {
    id: "harney-tasseography",
    kind: "article",
    cite: "Harney & Sons, \"Tasseography\" (blog post, read 2026-10-25)",
    short: "Harney & Sons",
    url: "https://www.harney.com/blogs/news/tasseography",
    urlLabel: "The article",
    about: "A tea seller's guide to reading tea leaves: use loose tea rather than tea from a cut bag, because larger leaves form shapes more readily; black, green or oolong all work.",
    lists: t("no", "It cites nothing."),
    record: t("no", "It gives practical advice, not history."),
    magick: t("partly", "It treats the practice warmly, as a pastime."),
    caution: "A seller's blog, so read it as practical tips, not as evidence about the tradition.",
    basis: "The page was fetched and read for this app on 2026-10-25.",
  },
  {
    id: "twinings-tea-leaves",
    kind: "article",
    cite: "Twinings, \"The Basics of Reading Tea Leaves\" (blog post, read 2026-10-25)",
    short: "Twinings",
    url: "https://twinings.co.uk/blogs/news/the-basics-of-reading-tea-leaves",
    urlLabel: "The article",
    about: "A tea seller's short guide: loose leaf gives the leaves room to settle into shapes; green, black or herbal tea all work; a cup with a plain, light inside shows the shapes best.",
    lists: t("no", "It cites nothing."),
    record: t("no", "It gives practical advice, not history."),
    magick: t("partly", "It treats the practice as a ritual worth doing, without claims for or against it."),
    caution: "A seller's blog, so read it as practical tips, not as evidence about the tradition.",
    basis: "The page was fetched and read for this app on 2026-10-25.",
  },
  // ── Where tea-leaf reading and ink blots began, for the world map (read 2026-10-29) ─────────────────────
  {
    id: "wp-tasseography",
    kind: "article",
    cite: "Tasseography, Wikipedia (read 2026-10-29)",
    short: "Wikipedia, tasseography",
    url: "https://en.wikipedia.org/wiki/Tasseography",
    urlLabel: "The article",
    about: "Reading tea leaves, coffee grounds and wine sediment: says tea-leaf reading is thought to have begun in China, links Western reading to medieval European readers of wax and molten lead, and describes reading coffee cups in the Ottoman world.",
    lists: t("partly", "It lists references, but several of its claims are marked as dubious, unverified or needing a better source."),
    record: t("partly", "It gives no date for the Chinese beginning, and hedges it with \"likely\"."),
    magick: t("yes", "It describes the practice across cultures without ranking them."),
    caution: "Its claim of a Chinese origin has no date or source in the article itself; read it as a story, not a record.",
    basis: "The page was fetched and read for this app on 2026-10-29, for the world map; it is an encyclopedia article, so its claims should be checked against the works it cites.",
  },
  {
    id: "wp-klecksography",
    kind: "article",
    cite: "Klecksography, Wikipedia (read 2026-10-29)",
    short: "Wikipedia, klecksography",
    url: "https://en.wikipedia.org/wiki/Klecksography",
    urlLabel: "The article",
    about: "Making pictures from ink blots: credits Justinus Kerner, whose failing eyesight led to blots he turned into pictures for his poems (Klecksographien, 1857), and says Hermann Rorschach loved the pastime as a boy.",
    lists: t("partly", "It is short and cites few works."),
    record: t("partly", "It gives the year of Kerner's book but no year for when he began."),
    magick: t("no", "It treats blots as art and play, not divination."),
    basis: "The page was fetched and read for this app on 2026-10-29, for the world map; it is an encyclopedia article, so its claims should be checked against the works it cites.",
  },
  {
    id: "wp-rorschach",
    kind: "article",
    cite: "Rorschach test, Wikipedia (read 2026-10-29)",
    short: "Wikipedia, Rorschach test",
    url: "https://en.wikipedia.org/wiki/Rorschach_test",
    urlLabel: "The article",
    about: "The inkblot test Hermann Rorschach set out in Psychodiagnostik (1921), and what came before it: Kerner's book of poems from blots (1857), Alfred Binet's use of blots as a test of imagination, and the late nineteenth-century game Gobolinks.",
    lists: t("yes", "It lists many references."),
    record: t("yes", "It dates the book and the earlier uses it names."),
    magick: t("no", "It is about a psychological test, not divination."),
    basis: "The page was fetched and read for this app on 2026-10-29, for the world map; it is an encyclopedia article, so its claims should be checked against the works it cites.",
  },
];

const BY_ID = new Map(SOURCES.map((s) => [s.id, s] as const));

export function getSource(id: string): Source | undefined {
  return BY_ID.get(id);
}

/** What a tool's page says about the record: what exists to be looked at, what is conjecture, and what is modern. */
export interface ToolGuide {
  /** Two or three sources to start with, chosen against the three tests. */
  start: string[];
  /** Primary texts, objects, and databases: the record itself. */
  record: string[];
  /** Also worth reading, with the reasons on each. */
  more: string[];
  /** What survives and can be looked at today. */
  survives: string[];
  /** What is conjecture, later invention, or hearsay. */
  conjecture: string[];
  /** A line where the check found no good source, so the gap is shown rather than hidden. */
  gap?: string;
}

export const TOOL_GUIDES: Record<ToolGuideId, ToolGuide> = {
  tarot: {
    start: ["farley-2009", "decker-dummett-2002", "place-2005"],
    record: ["morgan-visconti"],
    more: ["wicked-pack-1996"],
    survives: [
      "The oldest decks that still exist, painted in northern Italy in the 1440s, and a written mention from Ferrara in 1442.",
      "The first occult uses of the cards, in the Paris of the 1780s, in the works of Etteilla and others.",
    ],
    conjecture: [
      "That the tarot came from ancient Egypt or from a lost body of secret teaching: no document supports it, and Place and Farley both name it as myth.",
      "That its older decks were made for divination: the surviving evidence points to a card game.",
    ],
  },
  oracle: {
    start: ["wicked-pack-1996", "horniman-hechtel", "etteilla-archive"],
    record: [],
    more: ["george-2014"],
    survives: [
      "Etteilla's deck for divination, printed in 1789 and 1790.",
      "Hechtel's game of 1799, whose layout the 36-card Lenormand decks copy.",
    ],
    conjecture: [
      "That Mlle Lenormand designed the deck sold under her name: she died in 1843, the deck's structure is older, and she is documented as using ordinary playing cards.",
      "Where the deck's symbols began: Hechtel's game is the best-documented ancestor, but some researchers point to coffee-house cards from eighteenth-century Vienna.",
    ],
    gap: "Your own deck is not a tradition, so it needs no source. These sources are for the printed decks it grew out of.",
  },
  scrying: {
    start: ["peterson-2003", "skinner-2014", "fodor-1994"],
    record: ["esoteric-archives-sloane"],
    more: ["davies-2009"],
    survives: [
      "Procedures for looking into a bowl of water or oil in the Greek magical papyri, and their continuation in Arabic practice.",
      "John Dee's sessions with Edward Kelley in the 1580s, in Dee's own handwriting.",
      "A Babylonian text that mentions reading oil on water in a bowl.",
    ],
    conjecture: [
      "A single unbroken scrying tradition from ancient Mesopotamia to the present: the texts are scattered and the links are argued, not shown.",
      "That crystal gazing is ancient: its well-documented form is from the 1500s.",
    ],
    gap: "No single history of scrying was found that meets all three tests. These are sources for its best-documented parts.",
  },
  pendulum: {
    start: ["vogt-hyman-1959", "graves-1989", "spr-dowsing"],
    record: ["chevreul-1833"],
    more: [],
    survives: [
      "Agricola's 1556 description of rods used to find minerals in German mining country.",
      "Chevreul's 1833 experiments, which found the pendulum's swing came from the holder's hand.",
      "The Society for Psychical Research's reports from the 1880s, and later controlled trials.",
    ],
    conjecture: [
      "An ancient origin for the pendulum: a Roman ring-on-a-thread oracle is a related practice, not the same one.",
      "Whether anything beyond the ideomotor effect is at work: researchers disagree. The app does not say that it is, or that it is not.",
    ],
    gap: "No scholarly history of the pendulum itself was found. The documented history is mostly of the dowsing rod, and the pendulum shares it.",
  },
  runes: {
    start: ["page-1987", "macleod-mees-2006", "flowers-1986"],
    record: ["rundata", "tacitus-germania"],
    more: ["osborn-longland-1982"],
    survives: [
      "About 6,500 runic inscriptions, from the earliest finds of about 160 CE onward.",
      "Three rune poems (Old English, Norwegian, Icelandic), none of them from the age of the Elder Futhark.",
      "Tacitus's account of Germanic lot-casting, which does not say the marks were runes.",
    ],
    conjecture: [
      "A set meaning for each rune in the Elder Futhark period: the names are reconstructed, and no one wrote them down then.",
      "Divination with runes as an ancient practice: the practice as it is known today is mostly from the twentieth century.",
      "Whether many inscriptions are magical or only names and ownership: scholars are divided.",
    ],
  },
  ogham: {
    start: ["mcmanus-1991", "ogham-in-3d", "laurie-2007"],
    record: ["cisp"],
    more: ["wp-white-goddess", "hutton-1999", "murray-1988", "greer-2006"],
    survives: [
      "About 400 inscribed stones in Ireland, most in Cork and Kerry, and more in Wales, Scotland, and Man.",
      "Medieval Irish manuscripts that explain the letters, including the Auraicept na n-Eces.",
    ],
    conjecture: [
      "The \"Celtic tree calendar\": it comes from Robert Graves, in 1948, and scholars reject it.",
      "A divination meaning for each letter: no old source gives one. The nearest hint is a tale of a druid cutting ogham on yew wands.",
      "That all the letters were tree names: only a handful clearly are.",
    ],
  },
  dice: {
    start: ["johnston-2008", "anthropozoologica-2022", "smith-1991"],
    record: ["pausanias-bura"],
    more: ["mipham-goldberg", "britannica-1911-knucklebones", "smith-talus", "wp-astragalomancy"],
    survives: [
      "Dice from Shahr-i Sokhta, Iran, of about 2800 to 2500 BCE, found with a board game.",
      "About 530 knucklebones from Maresha, Israel, many altered to throw reliably.",
      "Pausanias's description of a dice oracle at Bura, and the Tibetan Mo, a living dice practice.",
    ],
    conjecture: [
      "Whether dice began as games or as divination: no one can now say, and the finds fit both.",
      "That coin-tossing for answers is ancient: no reliable early record was found.",
    ],
  },
  iching: {
    start: ["wp-iching", "legge-1882", "wp-iching-divination"],
    record: ["wp-hexagrams"],
    more: [],
    survives: [
      "The Zhou yi, a divination text of the Western Zhou, and the Ten Wings commentaries added to it.",
      "Bamboo and wooden slips of the Warring States period (the Shanghai Museum slips), showing the text in use across society by about 300 BCE.",
      "Accounts in the Zuo zhuan of more than twenty divinations between 671 and 487 BCE.",
    ],
    conjecture: [
      "That King Wen, the Duke of Zhou or Confucius wrote the parts they are credited with: this is no longer generally accepted.",
      "How yarrow stalks were first turned into the four line values: the earliest method is not agreed.",
      "That the odds of the coin method and the yarrow method are the same: they are not, and the app says which it used.",
    ],
    gap: "The app carries no translation of the Judgments, Images or line texts. Legge's of 1882 is in the public domain; read one before you rely on what a line is said to mean.",
  },
  geomancy: {
    start: ["wp-arabic-geomancy", "wp-geomancy", "wp-geomantic-figures"],
    record: ["wp-house-astrology"],
    more: [],
    survives: [
      "Latin treatises of the twelfth century, among them Hugh of Santalla's Ars geomantiae, translated from Arabic.",
      "Arabic manuals of 'ilm al-raml, the science of the sand, in use from about the ninth century.",
    ],
    conjecture: [
      "That Idris or Hermes received the art from an angel: this is the tradition's own legend, not a record.",
      "That one table of planets and signs belongs to the figures: authors give different ones, so this app gives none.",
      "That the order in which the twelve figures go into the houses is fixed: the article records that it varied between groups.",
    ],
    gap: "The pages read show the line patterns of the figures as pictures, and only Via, Puer and Populus could be read as text. The patterns used here were set from the rule that a figure's single dots are the elements it is active in, and checked against the pairing of figures that are reversals of one another. A printed manual (Stephen Skinner's, 1980) would settle them.",
  },
  playingcards: {
    start: ["wicked-pack-1996", "decker-dummett-2002"],
    record: [],
    more: [],
    survives: [
      "Ordinary playing cards used for fortune-telling in eighteenth-century France, written about by the historians of the occult tarot.",
      "Mlle Lenormand is documented as using ordinary playing cards, not a deck of her own.",
    ],
    conjecture: [
      "That any one system of meanings for the 52 cards is the old or the right one: written systems differ, and this app gives none.",
      "That the deck sold under Mlle Lenormand's name was designed by her: she died in 1843 and the deck's structure is older.",
    ],
    gap: "No source for the meaning of each playing card has been read and checked for this app yet, so none is given. What each card means is the person's own.",
  },
  bibliomancy: {
    start: ["wp-bibliomancy", "wp-sortes-vergilianae"],
    record: [],
    more: [],
    survives: [
      "Roman stories of emperors opening Virgil for a line (Hadrian, Alexander Severus), written down later.",
      "Persian falnama, books of omens opened at random, illustrated copies of which survive from the sixteenth century.",
    ],
    conjecture: [
      "How old the practice of opening a book at random is: the article gives few dates, and one claim about the classical world is marked as lacking a citation.",
      "That a line found this way carries a message of its own. The app treats a passage as a prompt for the person's own reading.",
    ],
    gap: "In the tradition the book is a trusted text such as the Bible, Virgil or Hafez. Here the book is the person's own writing: that is this app's change, not an old practice.",
  },
  across: {
    start: ["hutton-1999", "davies-2009", "pomegranate"],
    record: [],
    more: ["museum-of-witchcraft"],
    survives: [],
    conjecture: [],
  },
};

/**
 * Short pointers from a sentence of the app's text to the sources that treat its topic. Keyed "tool.topic". A marker
 * says the topic is treated there, not that a given page proves a given sentence.
 */
export const CITES: Record<string, string[]> = {
  "runes.futhark": ["page-1987", "rundata"],
  "runes.oe": ["osborn-longland-1982"],
  "runes.magic": ["macleod-mees-2006", "flowers-1986", "tacitus-germania"],
  "ogham.ogham": ["mcmanus-1991", "ogham-in-3d", "cisp"],
  "ogham.trees": ["mcmanus-1991"],
  "ogham.forfeda": ["mcmanus-1991"],
  "ogham.modern": ["laurie-2007", "wp-white-goddess", "hutton-1999"],
  "ogham.forfeda-modern": ["murray-1988", "greer-2006", "laurie-2007"],
  "ogham.kennings": ["mcmanus-1991"],
  "dice.knucklebones": ["anthropozoologica-2022"],
  "dice.knucklebone-sides": ["britannica-1911-knucklebones", "smith-talus", "wp-astragalomancy"],
  "dice.games-or-divination": ["anthropozoologica-2022", "johnston-2008"],
  "dice.bura": ["pausanias-bura", "johnston-2008"],
  "dice.mo": ["mipham-goldberg"],
  "dice.coin-divination": ["smith-1991"],
  "origin.tarot": ["farley-2009", "decker-dummett-2002", "morgan-visconti"],
  "origin.oracle": ["wicked-pack-1996", "horniman-hechtel", "etteilla-archive"],
  "origin.scrying": ["skinner-2014", "fodor-1994", "peterson-2003"],
  "origin.pendulum": ["vogt-hyman-1959", "chevreul-1833", "spr-dowsing"],
  "origin.runes": ["page-1987", "macleod-mees-2006"],
  "origin.ogham": ["mcmanus-1991", "ogham-in-3d"],
  "origin.dice": ["johnston-2008", "anthropozoologica-2022"],
  "origin.coins": ["smith-1991"],
  "iching.hexagrams": ["wp-hexagrams", "wp-iching"],
  "iching.texts": ["legge-1882", "wp-iching"],
  "iching.casting": ["wp-iching-divination"],
  "geomancy.figures": ["wp-geomantic-figures", "wp-geomancy"],
  "geomancy.chart": ["wp-arabic-geomancy"],
  "geomancy.houses": ["wp-house-astrology", "wp-arabic-geomancy"],
  "bibliomancy.history": ["wp-bibliomancy", "wp-sortes-vergilianae"],
  "origin.iching": ["wp-iching", "legge-1882"],
  "origin.geomancy": ["wp-arabic-geomancy", "wp-geomancy"],
  "origin.bibliomancy": ["wp-bibliomancy", "wp-sortes-vergilianae"],
  "origin.tea": ["wp-tasseography", "highland-seer-tea"],
  "origin.blots": ["wp-klecksography", "wp-rorschach"],
  // Tea leaves have no guide (KINDS_WITHOUT_GUIDE); these are behind the choice of teas in lib/tea-core.ts.
  "blots.tea": ["highland-seer-tea", "harney-tasseography", "twinings-tea-leaves"],
};

export function citesFor(key: string): Source[] {
  return (CITES[key] ?? []).map(getSource).filter((s): s is Source => !!s);
}

/** The page of a tool's sources, optionally down to one source. */
export function sourcesPath(tool?: ToolGuideId, sourceId?: string): string {
  if (!tool) return "/sources";
  return `/sources/${tool}${sourceId ? `#${sourceId}` : ""}`;
}

/** Which tool a source is listed under first, so a marker can link to its place on that tool's page. */
export function homeToolOf(sourceId: string, preferred?: ToolGuideId): ToolGuideId {
  // A kind with no guide of its own has no entry here, so it falls through to the search below.
  const g = preferred ? TOOL_GUIDES[preferred] : undefined;
  if (preferred && g) {
    if ([...g.start, ...g.record, ...g.more].includes(sourceId)) return preferred;
  }
  for (const id of Object.keys(TOOL_GUIDES) as ToolGuideId[]) {
    const g = TOOL_GUIDES[id];
    if ([...g.start, ...g.record, ...g.more].includes(sourceId)) return id;
  }
  return "across";
}
