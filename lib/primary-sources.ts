// The app's primary sources: the works its maker draws on most, in the order the owner set (2026-10-26).
// Pure data (no database), so the Sources pages, the webliography script and tests/primary-sources.test.ts share it.
// Draft wording of 2026-10-26, waiting for the owner's wording pass.
//
// TO ADD ONE: add an entry to PRIMARY_SOURCES where it belongs in the order. Nothing else needs to change: the list on
// /sources, the page at /sources/primary and docs/webliography.md (run scripts/export-webliography.ts) all read it.
// Every link must be opened before it is added; say how in `basis`.
//
// Primary sources are not graded against the three tests in lib/sources.ts. They are the maker's own foundations, so
// each says what it is, why it is here, and how its details were checked.

export const PRIMARY_CHECKED_ON = "2026-10-26";

export interface PrimaryLink {
  label: string;
  url: string;
  /** What the item covers, in a sentence. */
  note?: string;
}

export interface PrimaryLinkGroup {
  id: string;
  title: string;
  intro?: string;
  links: PrimaryLink[];
}

export interface PrimarySource {
  id: string;
  /** Who: a person, two people, or a group. */
  name: string;
  /** The work named as the primary source, as it reads on a short card. */
  work: string;
  /** One citation line. */
  cite: string;
  url: string;
  urlLabel: string;
  about: string;
  /** Why it matters for this app, when the owner has said. */
  why?: string;
  /** A fuller page about this source in the app, when there is one. */
  page?: string;
  /** Lists of episodes, chapters or articles, for a source that is more than one work. */
  groups?: PrimaryLinkGroup[];
  /** A warning the reader should have before relying on it. */
  caution?: string;
  /** How its details and links were checked. */
  basis: string;
}

/** How the books from the owner's shelf (2026-10-26) were checked. */
const SHELF_BASIS =
  "From the app maker's own bookshelf (added 2026-10-26). Title, author, publisher and year were checked on the linked page or a publisher's or library's page; the description follows the publisher's or library's summary. The book itself was not read for this entry.";

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export const PRIMARY_SOURCES: PrimarySource[] = [
  {
    id: "radin",
    name: "Dean Radin",
    work: "Real Magic (2018)",
    cite: "Dean Radin, Real Magic: Ancient Wisdom, Modern Science, and a Guide to the Secret Power of the Universe (Harmony Books, 2018)",
    url: "https://noetic.org/publication/real-magic-ancient-wisdom-modern-science-and-a-guide-to-the-secret-power-of-the-universe/",
    urlLabel: "Book page on noetic.org",
    about:
      "Radin is the Chief Scientist of the Institute of Noetic Sciences and has run laboratory tests of psi since the 1980s. Real Magic sorts magic into three kinds (force of will, divination and theurgy) and sets laboratory psi research beside each.",
    why: "It names divination, perceiving things distant in time or space, as one of three kinds of magic that can be studied with the methods of science. The sealed targets and first impressions in this app come from the same kind of method.",
    page: "/sources/radin",
    basis:
      "Checked on 2026-10-26 from the book's pages at the Institute of Noetic Sciences and Penguin Random House and two published reviews. The full page on his research gives every source, his critics and his replies.",
  },
  {
    id: "planet-weird",
    name: "Planet Weird (Dana and Greg Newkirk)",
    work: "Hellier and the Haunted Objects Podcast",
    cite: "Dana Newkirk and Greg Newkirk, Planet Weird: Hellier (2019) and the Haunted Objects Podcast (2022 to now)",
    url: "https://www.youtube.com/@PlanetWeird",
    urlLabel: "Planet Weird on YouTube",
    about:
      "Dana and Greg Newkirk are paranormal researchers who have investigated hauntings, legendary creatures and psychic phenomena across North America for nearly two decades. Planet Weird is the home of their projects: the documentary series Hellier, which they produced, and the Haunted Objects Podcast, about famous haunted objects: their history, their folklore and the activity reported around them.",
    why: "Hellier follows a string of synchronicities, meaningful coincidences, and treats them as signs to follow, as the signs and dreams log in this app does. The Estes Method, devised by members of the Hellier team, keeps the listener from hearing the questions, much as the blind-target practice here keeps the target sealed until you have written.",
    groups: [
      {
        id: "planet-weird-divination",
        title: "Haunted Objects Podcast: episodes about divination",
        intro: "A new episode comes out every other Monday on YouTube and in podcast apps.",
        links: [
          {
            label: "Episode 20: Tarot for the Dead: Divining the Secrets of the Devil's Deck",
            url: yt("4If0bh-xmVk"),
            note: "The season two opener: a tarot deck said to be haunted, the history of the tarot and the Pixie-Smith deck, a reading for viewers, a sceptic's view, and free will.",
          },
          {
            label: "Episode 2: The Dark Mirror's Reflections of Death",
            url: yt("rTEn62OS5Oo"),
            note: "A pitch-black scrying glass said to frighten the people who look into it, and its history (2022).",
          },
          {
            label: "Episode 33: The Estes Method: How a Broken Radio Can Make You Psychic",
            url: yt("FX2DBT95mBo"),
            note: "Karl Pfeiffer and Connor Randall on the method they devised: a listener, blindfolded and wearing headphones fed by a radio sweeping between stations, says aloud what they hear while others ask questions (2025).",
          },
          {
            label: "The podcast on Apple Podcasts",
            url: "https://podcasts.apple.com/us/podcast/the-haunted-objects-podcast/id1652260827",
          },
          {
            label: "The podcast on Spotify",
            url: "https://open.spotify.com/show/05rxvbMQRIirfszzXuxdEn",
          },
        ],
      },
      {
        id: "hellier-season-1",
        title: "Hellier, season 1 (2019)",
        intro:
          "Directed by Karl Pfeiffer. A group of investigators follow a string of synchronicities to Hellier, Kentucky. Released free online in January 2019.",
        links: [
          { label: "Episode 1: The Midnight Children", url: yt("R1FwIuicx88") },
          { label: "Episode 2: Ink and Black", url: yt("BbXbfImzpo8") },
          { label: "Episode 3: Trapped in a Maze", url: yt("Ok_ZKSe4YEA") },
          { label: "Episode 4: Slivers of the Future", url: yt("uW0fowdD8bI") },
          { label: "Episode 5: The Heart of It", url: yt("tY9Sw6hfgKg") },
        ],
      },
      {
        id: "hellier-season-2",
        title: "Hellier, season 2 (2019)",
        intro: "Ten episodes, released on Amazon Prime Video in November 2019 and on YouTube in December 2019.",
        links: [
          { label: "Episode 1: Noise and Signal", url: yt("LsryOj4YQXw") },
          { label: "Episode 2: And the Dead", url: yt("6l84v3oZbZU") },
          { label: "Episode 3: Borderlands", url: yt("5caVpVmyTqE") },
          { label: "Episode 4: Your Green Man", url: yt("rhCMayIsumA") },
          { label: "Episode 5: The Unknown Country", url: yt("hIqwrMaQ2bw") },
          { label: "Episode 6: The Altar", url: yt("ddGBvkhmAIo") },
          { label: "Episode 7: The Trickster", url: yt("tIct9UmIiRk") },
          { label: "Episode 8: The Secret Commonwealth", url: yt("hikfHZDmPEA") },
          { label: "Episode 9: The Center of Your Mind", url: yt("REBSsUAT4-I") },
          { label: "Episode 10: Night of Pan", url: yt("cPTH02CV37I") },
        ],
      },
    ],
    basis:
      "Checked on 2026-10-26. Every episode link was opened, or found under its title on YouTube, on Planet Weird's channel. Episode titles and dates come from Wikipedia's article on Hellier and Higgypop's episode guide; the podcast details from Higgypop's launch article and the podcast's Apple page; the Estes Method from Higgypop's article on it.",
  },
  {
    id: "pollack",
    name: "Rachel Pollack",
    work: "Seventy-Eight Degrees of Wisdom",
    cite: "Rachel Pollack, Seventy-Eight Degrees of Wisdom: A Tarot Journey to Self-Awareness (first published 1980; new edition, Weiser Books, 2019)",
    url: "https://redwheelweiser.com/?p=108225",
    urlLabel: "Publisher's page (Red Wheel Weiser)",
    about:
      "Rachel Pollack (1945 to 2023) first published this book in 1980. It goes through all 78 cards, drawing on mythology and esoteric tradition for a psychological reading of their pictures, with a short history of the tarot and the common spreads. The 2019 edition has a new preface by the author.",
    why: "Its subtitle, a tarot journey to self-awareness, is this app's aim: reading the cards to learn about yourself, in your own words.",
    basis: "Checked on 2026-10-26 from the publisher's page for the 2019 edition.",
  },
  {
    id: "cross",
    name: "J. Allen Cross",
    work: "The Witch's Guide to the Paranormal",
    cite: "J. Allen Cross, The Witch's Guide to the Paranormal: How to Investigate, Communicate, and Clear Spirits (Llewellyn Publications, 2022)",
    url: "https://search.worldcat.org/title/1294286799",
    urlLabel: "Library record (WorldCat)",
    about:
      "Cross is a folk witch and paranormal investigator in the Portland, Oregon, area, and the author of American Brujeria: Modern Mexican American Folk Magic. This handbook is for witches who investigate hauntings. It describes four kinds (residual, poltergeist, human earthbound and inhuman), the basics of investigation, witchcraft and mediumship, and more than forty exercises and rituals, among them making seals, opening and closing portals, and helping spirits cross over.",
    why: "It brings a witch's practice and a paranormal investigator's methods together in one book, as this app brings divination and a careful record together.",
    caution: "One published reader's review notes that it gives no guidance on abuse or the safety of children in poltergeist cases.",
    basis:
      "Checked on 2026-10-26 from the WorldCat and public-library records, the Goodreads page and its reviews, and an interview with the author on The Witching Hour podcast (July 2022). The book itself was not read for this entry.",
  },
  // ── From the owner's bookshelf (added 2026-10-26): tarot, then magick and witchcraft, then the paranormal ─────────
  {
    id: "snow",
    name: "Cassandra Snow",
    work: "Queering the Tarot and Queering Your Craft",
    cite: "Cassandra Snow, Queering the Tarot (Weiser Books, 2019) and Queering Your Craft: Witchcraft from the Margins (Weiser Books, 2020)",
    url: "https://redwheelweiser.com/?p=108195",
    urlLabel: "Publisher's page for Queering the Tarot (Red Wheel Weiser)",
    about:
      "Queering the Tarot reads all 78 cards through an LGBTQ+ lens and looks at how the usual meanings assume a white, European, heterosexual reader. Queering Your Craft is an introduction to witchcraft from the same view, covering the personal, collective and political sides of practice, with a grimoire of spells.",
    groups: [
      {
        id: "snow-books",
        title: "The books",
        links: [
          { label: "Queering the Tarot (2019), foreword by Beth Maiden", url: "https://redwheelweiser.com/?p=108195" },
          { label: "Queering Your Craft: Witchcraft from the Margins (2020), foreword by Mat Auryn", url: "https://redwheelweiser.com/?p=108319" },
        ],
      },
    ],
    basis: SHELF_BASIS,
  },
  {
    id: "hammond",
    name: "Eleanor Hammond",
    work: "A Course in Tarot",
    cite: "Eleanor Hammond, A Course in Tarot: In-Depth Training, Exercises, Questions with Answers (Red Feather Mind, Body, Spirit, an imprint of Schiffer Publishing, 2018)",
    url: "https://catalog.harrisonpl.org/Record/5354301",
    urlLabel: "Library record (Harrison Public Library)",
    about:
      "A course in lessons, from beginner to experienced reader, on reading the cards and relating each one to your own experience, with exercises and questions with answers. It can be used with any deck.",
    basis: SHELF_BASIS,
  },
  {
    id: "greer",
    name: "Mary K. Greer",
    work: "Women of the Golden Dawn",
    cite: "Mary K. Greer, Women of the Golden Dawn: Rebels and Priestesses (Park Street Press, 1995)",
    url: "https://www.goodreads.com/book/show/481646",
    urlLabel: "Goodreads",
    about:
      "A biography of four women at the core of the Hermetic Order of the Golden Dawn (Maud Gonne, Moina Bergson Mathers, Annie Horniman and Florence Farr), and of how they shaped politics, theatre and occult practice.",
    basis: SHELF_BASIS,
  },
  {
    id: "echols",
    name: "Damien Echols (and Lorri Davis)",
    work: "High Magick, Angels and Archangels, Ritual, and two memoirs",
    cite: "Damien Echols, High Magick (Sounds True, 2018), Angels and Archangels (Sounds True, 2020) and Life After Death (Blue Rider Press, 2012); Damien Echols and Lorri Davis, Ritual (Sounds True, 2022) and Yours for Eternity (Blue Rider Press, 2014)",
    url: "https://www.soundstrue.com/a/resources/contributor/damien-echols",
    urlLabel: "Author's page at Sounds True",
    about:
      "Echols was wrongfully convicted as one of the West Memphis Three and spent nearly two decades on death row before his release in 2011. He now teaches magick. High Magick describes the practices that, in his words, saved his life in prison; Angels and Archangels is a magician's guide to working with angels; Ritual, written with his wife Lorri Davis, is a beginner's grimoire of simple energy practices and rituals.",
    groups: [
      {
        id: "echols-books",
        title: "The books",
        links: [
          {
            label: "High Magick: A Guide to the Spiritual Practices That Saved My Life on Death Row (2018)",
            url: "https://www.abebooks.com/9781683642275/High-Magick-Guide-Spiritual-Practices-1683642279/plp",
          },
          { label: "Angels and Archangels: A Magician's Guide (2020)", url: "https://www.soundstrue.com/products/angels-and-archangels-1" },
          { label: "Ritual: An Essential Grimoire, with Lorri Davis (2022)", url: "https://www.publishersweekly.com/9781683648208" },
          { label: "Life After Death (2012), a memoir", url: "https://publishersweekly.com/9780399160202" },
          { label: "Yours for Eternity: A Love Story on Death Row, with Lorri Davis (2014), their letters", url: "https://publishersweekly.com/9780399166198" },
        ],
      },
    ],
    basis: SHELF_BASIS,
  },
  {
    id: "frater-ud",
    name: "Frater U.:D.:",
    work: "Practical Sigil Magic",
    cite: "Frater U.:D.:, Practical Sigil Magic: Creating Personal Symbols for Success (Llewellyn Publications, 2012)",
    url: "https://netgalley.com/catalog/book/12762",
    urlLabel: "NetGalley catalogue page",
    about:
      "A guide to making personal magical symbols (sigils) without elaborate ritual, for beginners and experienced practitioners. Llewellyn's 2012 edition brought back a book that had long been out of print.",
    basis: SHELF_BASIS,
  },
  {
    id: "murphy-hiscock",
    name: "Arin Murphy-Hiscock",
    work: "The Green Witch and Spellcrafting",
    cite: "Arin Murphy-Hiscock, The Green Witch (Adams Media, 2017) and Spellcrafting (Adams Media, 2020)",
    url: "https://www.simonandschuster.co.uk/books/The-Green-Witch/Arin-Murphy-Hiscock/Green-Witch-Witchcraft-Series/9781507204719",
    urlLabel: "Publisher's page for The Green Witch (Simon & Schuster)",
    about:
      "The Green Witch is a guide to green witchcraft: herbs, flowers, oils and natural objects used for healing and ritual, and for balance with nature. Spellcrafting teaches how to write your own spells, time them, understand how ingredients work, and adjust when results fall short.",
    groups: [
      {
        id: "murphy-hiscock-books",
        title: "The books",
        links: [
          {
            label: "The Green Witch: Your Complete Guide to the Natural Magic of Herbs, Flowers, Essential Oils, and More (2017)",
            url: "https://www.simonandschuster.co.uk/books/The-Green-Witch/Arin-Murphy-Hiscock/Green-Witch-Witchcraft-Series/9781507204719",
          },
          {
            label: "Spellcrafting: Strengthen the Power of Your Craft by Creating and Casting Your Own Unique Spells (2020)",
            url: "https://49thshelf.com/Books/S/Spellcrafting",
          },
        ],
      },
    ],
    basis: SHELF_BASIS,
  },
  {
    id: "walker",
    name: "J. D. Walker",
    work: "A Witch's Guide to Wildcraft",
    cite: "J. D. Walker, A Witch's Guide to Wildcraft: Using Common Plants to Create Uncommon Magick (Llewellyn Publications, 2021)",
    url: "https://blackwells.co.uk/bookshop/product/A-Witchs-Guide-to-Wildcraft-by-J-D-Walker/9780738765433",
    urlLabel: "Blackwell's",
    about:
      "More than thirty common North American plants: how to identify, gather and grow them, and how to use them in rituals, spells and herbal crafts.",
    basis: SHELF_BASIS,
  },
  {
    id: "serpentine",
    name: "Ariana Serpentine",
    work: "Sacred Gender",
    cite: "Ariana Serpentine, Sacred Gender: Create Trans and Nonbinary Spiritual Connections (Llewellyn Publications, 2022)",
    url: "https://www.bookloft.com/book/9780738771342",
    urlLabel: "The Bookloft",
    about:
      "A guide for trans and nonbinary readers to connecting gender and spiritual practice, through ancestor work, spirits and deities, sigil magic, journal exercises and a gender initiation.",
    basis: SHELF_BASIS,
  },
  {
    id: "daoust",
    name: "Maja D'Aoust",
    work: "Familiars in Witchcraft",
    cite: "Maja D'Aoust, Familiars in Witchcraft: Supernatural Guardians in the Magical Traditions of the World (Destiny Books, 2019)",
    url: "https://www.simonandschuster.ca/books/Familiars-in-Witchcraft/Maja-DAoust/9781620558461",
    urlLabel: "Publisher's page (Simon & Schuster)",
    about:
      "A survey of witches' familiar spirits across the world's cultures: their forms, their powers, and their links to shamanic and magical traditions.",
    basis: SHELF_BASIS,
  },
  {
    id: "laz",
    name: "Athena Laz",
    work: "The Alchemy of Your Dreams",
    cite: "Athena Laz, The Alchemy of Your Dreams: A Modern Guide to the Ancient Art of Lucid Dreaming and Interpretation (TarcherPerigee, 2021)",
    url: "https://www.hachette.co.uk/titles/athena-laz/the-alchemy-of-your-dreams/9781529382464/",
    urlLabel: "Hachette UK's page (the UK edition)",
    about: "A guide to interpreting your own dreams and to lucid dreaming, for self-understanding and wellbeing.",
    basis: SHELF_BASIS,
  },
  {
    id: "hughes",
    name: "Michael M. Hughes",
    work: "Magic for the Resistance",
    cite: "Michael M. Hughes, Magic for the Resistance: Rituals and Spells for Change (Llewellyn Publications, 2018)",
    url: "https://publishersweekly.com/978-0-7387-5996-8",
    urlLabel: "Publishers Weekly review",
    about:
      "Ritual magic, including binding, as a form of protest, with simple rituals using household things on causes such as police violence, reproductive rights and the sharing of wealth.",
    basis: SHELF_BASIS,
  },
  {
    id: "west-elliott",
    name: "Katie West and Jasmine Elliott (editors)",
    work: "Becoming Dangerous",
    cite: "Katie West and Jasmine Elliott, eds., Becoming Dangerous: Witchy Femmes, Queer Conjurers, and Magical Rebels (Weiser Books, 2019)",
    url: "https://redwheelweiser.com/?p=108235",
    urlLabel: "Publisher's page (Red Wheel Weiser)",
    about:
      "Twenty-one personal essays by marginalised writers on the magical practices they use against self-doubt, grief and systemic oppression.",
    basis: SHELF_BASIS,
  },
  {
    id: "horowitz",
    name: "Mitch Horowitz",
    work: "Esoterika",
    cite: "Mitch Horowitz, Esoterika: Formulas Against the False Self (2026)",
    url: "https://pagebound.co/books/20f4be29-39ef-4e05-b6d3-697f1f28f1bd",
    urlLabel: "Pagebound",
    about:
      "Horowitz writes on the occult and esoteric. This book, which he calls a philosophy of results, draws on Hermetic, Abrahamic and modern esoteric and magickal traditions for practices that challenge conformity, and is meant to be practised.",
    basis: SHELF_BASIS,
  },
  {
    id: "keel",
    name: "John A. Keel",
    work: "The Mothman Prophecies",
    cite: "John A. Keel, The Mothman Prophecies (Saturday Review Press, 1975)",
    url: "https://en.wikipedia.org/wiki/The_Mothman_Prophecies",
    urlLabel: "Wikipedia",
    about:
      "Keel's account of the reported sightings of a winged creature, Mothman, around Point Pleasant, West Virginia, in 1966 and 1967, and the strange events he connected with them, ending with the collapse of the Silver Bridge over the Ohio River in December 1967. It sets out his theories about UFOs and the paranormal.",
    basis: SHELF_BASIS,
  },
  {
    id: "barker",
    name: "Gray Barker",
    work: "The Silver Bridge",
    cite: "Gray Barker, The Silver Bridge (1970; reissued 2008 with a foreword by Allen Greenfield)",
    url: "https://www.goodreads.com/book/show/34758889",
    urlLabel: "Goodreads",
    about:
      "A West Virginia writer's account of the Mothman sightings and the strange events at Point Pleasant, linking them to the collapse of the Silver Bridge. It came out five years before Keel's book.",
    caution:
      "Barker is known to have staged hoaxes on UFO researchers, such as a fake State Department letter sent to George Adamski in 1957, so his accounts are best read alongside others.",
    basis: SHELF_BASIS,
  },
  {
    id: "greenfield",
    name: "Allen H. Greenfield",
    work: "The Complete Secret Cipher of the UFOnauts",
    cite: "Allen H. Greenfield, The Complete Secret Cipher of the UFOnauts (CreateSpace, 2018)",
    url: "https://www.eslite.com/product/1001294883375209",
    urlLabel: "Bookseller's page (eslite)",
    about:
      "A veteran UFO researcher argues that UFO contact and occultism are connected, sets out what he describes as ciphers and rituals shared by contactees and magicians, and gives readers tools to decode them.",
    basis: SHELF_BASIS,
  },
  {
    id: "rawilson",
    name: "Robert Anton Wilson",
    work: "Cosmic Trigger II and III",
    cite: "Robert Anton Wilson, Cosmic Trigger II: Down to Earth (1991) and Cosmic Trigger III: My Life After Death (1995), now published by Hilaritas Press",
    url: "https://en.wikipedia.org/wiki/Cosmic_Trigger_trilogy",
    urlLabel: "Wikipedia, the Cosmic Trigger trilogy",
    about:
      "Memoir and philosophy in three volumes. Wilson argues that the observer shapes reality, so every belief system, scientific or spiritual, is best treated as a map rather than the territory, an outlook he called model agnosticism.",
    groups: [
      {
        id: "rawilson-books",
        title: "The books",
        links: [
          { label: "Cosmic Trigger II: Down to Earth (Hilaritas Press)", url: "https://www.hilaritaspress.com/?p=5028" },
          { label: "Cosmic Trigger III: My Life After Death (Hilaritas Press)", url: "https://www.hilaritaspress.com/?p=7121" },
        ],
      },
    ],
    basis: SHELF_BASIS,
  },
  {
    id: "vaughn",
    name: "Matthew Gregory Vaughn",
    work: "My Cosmic Trigger",
    cite: "Matthew Gregory Vaughn, My Cosmic Trigger: High Strangeness in Theory and Practice (2024)",
    url: "https://coles-books.co.uk/my-cosmic-trigger-by-matthew-gregory-vaughn",
    urlLabel: "Coles Books",
    about:
      "Modelled on Robert Anton Wilson's Cosmic Trigger, it sets out the theory and practice of high strangeness, where different kinds of paranormal experience meet, from the author's own experience.",
    basis: SHELF_BASIS,
  },
  {
    id: "hansen",
    name: "George P. Hansen",
    work: "The Trickster and the Paranormal",
    cite: "George P. Hansen, The Trickster and the Paranormal (Xlibris, 2001)",
    url: "https://search.worldcat.org/en/title/48677432",
    urlLabel: "Library record (WorldCat)",
    about:
      "Hansen asks why psychic experiences and UFOs are so widely reported and believed in, yet stay at the edge of academic life. He answers with the trickster of myth and folklore, a figure of paradox and boundaries, drawing on anthropology, folklore, sociology, semiotics and literary criticism.",
    basis: SHELF_BASIS,
  },
  {
    id: "colin-wilson",
    name: "Colin Wilson",
    work: "Beyond the Occult",
    cite: "Colin Wilson, Beyond the Occult: Twenty Years' Research into the Paranormal (Bantam, 1988; Watkins, 2008)",
    url: "https://search.clevnet.org/Record/a5745186",
    urlLabel: "Library record (CLEVNET)",
    about: "Wilson's look back over twenty years of his own research into the paranormal, with a bibliography and index.",
    basis: SHELF_BASIS,
  },
  {
    id: "leonard-george",
    name: "Leonard George",
    work: "Alternative Realities",
    cite: "Leonard George, Alternative Realities: The Paranormal, the Mystic, and the Transcendent in Human Experience (Facts On File, 1995)",
    url: "https://libcat.scu.edu/Record/b1524828",
    urlLabel: "Library record (Santa Clara University)",
    about: "A reference book on paranormal, mystical and transcendent experiences.",
    basis: SHELF_BASIS,
  },
];

/** Secondary and tangential sources: works beside the primary ones, in the same shape (owner, 2026-10-26). */
export const SECONDARY_SOURCES: PrimarySource[] = [
  {
    id: "toy",
    name: "Atala Dorothy Toy",
    work: "We Are Not Alone",
    cite: "Atala Dorothy Toy, We Are Not Alone: A Complete Guide to Interdimensional Cooperation (Weiser Books, 2009)",
    url: "https://redwheelweiser.com/book/we-are-not-alone-9781578634484/",
    urlLabel: "Publisher's page (Red Wheel Weiser)",
    about:
      "Written after a near-death experience during the author's work at the United Nations Development Programme, it gives a simple method for connecting with everything from pets and gemstones to angels and inner guides.",
    why: "It came to the app's maker by synchronicity.",
    basis: SHELF_BASIS,
  },
  {
    id: "penrose",
    name: "Roger Penrose",
    work: "Fashion, Faith, and Fantasy in the New Physics of the Universe",
    cite: "Roger Penrose, Fashion, Faith, and Fantasy in the New Physics of the Universe (Princeton University Press, 2016)",
    url: "https://www.timeshighereducation.com/node/595343",
    urlLabel: "Review by Marcus Chown (Times Higher Education)",
    about:
      "A physicist questions three ideas that much of modern physics takes on trust: that quantum superpositions hold at every scale (he argues gravity may set a limit), the extra dimensions of string theory, and cosmic inflation as the account of the universe's smooth early state.",
    basis: SHELF_BASIS,
  },
];

/** Things the owner recommends that are not sources for the app (2026-10-26). */
export const CHECK_OUT: PrimaryLink[] = [
  {
    label: "Sean Price (artofprice), Beacon (2020)",
    url: "https://www.kickstarter.com/projects/artofprice/beacon-by-artofprice",
    note: "A hardcover collection of artwork and writing meant to encourage, relate and inspire. The app's maker recommends it for getting through creative burnout.",
  },
  {
    label: "Tony DiTerlizzi and Holly Black, The Spiderwick Chronicles (Simon & Schuster, 2003 to 2004)",
    url: "https://en.wikipedia.org/wiki/The_Spiderwick_Chronicles",
    note: "Five illustrated novels: three siblings find a hidden world of faeries around the Spiderwick Estate, with the help of Arthur Spiderwick's field guide.",
  },
  {
    label: "Sorita d'Este, Artemis: Virgin Goddess of the Sun & Moon (2005)",
    url: "https://www.goodreads.com/book/show/357732",
    note: "A study of the Greek goddess of the hunt: her myths, worship, sanctuaries, festivals, sacred animals and many titles.",
  },
];

export function getPrimarySource(id: string): PrimarySource | undefined {
  return [...PRIMARY_SOURCES, ...SECONDARY_SOURCES].find((s) => s.id === id);
}

/** Where a primary source's card on /sources leads: its own page when it has one, otherwise its place on /sources/primary. */
export function primaryHref(s: PrimarySource): string {
  return s.page ?? `/sources/primary#${s.id}`;
}
