// Dean Radin's background, experiments and the published criticism of them, for the page at /sources/radin.
// Pure data (no database), so the page and tests/radin-research.test.ts share it.
// Draft wording of 2026-10-23, waiting for the owner's wording pass. Every paragraph names the sources it was written from.

export const RADIN_CHECKED_ON = "2026-10-23 (the Real Magic section on 2026-10-26)";

export type RadinSourceKind = "about him" | "his work" | "a review of his book" | "a test of his work" | "criticism" | "his reply";

export interface RadinSource {
  id: string;
  cite: string;
  url: string;
  urlLabel: string;
  kind: RadinSourceKind;
  /** How the source was checked, and anything a reader should know about who wrote it. */
  note: string;
}

export const RADIN_SOURCES: RadinSource[] = [
  {
    id: "psi-encyclopedia",
    cite: "Psi Encyclopedia (Society for Psychical Research), \"Dean Radin\".",
    url: "https://psi-encyclopedia.spr.ac.uk/articles/dean-radin/",
    urlLabel: "psi-encyclopedia.spr.ac.uk",
    kind: "about him",
    note: "The longest account of his career and experiments. It is written from inside psychical research and is sympathetic to his work; it also reports the main disputes.",
  },
  {
    id: "wikipedia",
    cite: "Wikipedia, \"Dean Radin\".",
    url: "https://en.wikipedia.org/wiki/Dean_Radin",
    urlLabel: "en.wikipedia.org",
    kind: "about him",
    note: "Gives his training and posts, and gathers the published criticism with references. Most of its space goes to critics, which the Psi Encyclopedia objects to.",
  },
  {
    id: "ions-profile",
    cite: "Institute of Noetic Sciences, staff profile of Dean Radin.",
    url: "https://noetic.org/profile/dean-radin/",
    urlLabel: "noetic.org",
    kind: "about him",
    note: "His employer's own page: his title, earlier posts, books and awards.",
  },
  {
    id: "real-magic",
    cite: "Radin, D. (2018). Real Magic: Ancient Wisdom, Modern Science, and a Guide to the Secret Power of the Universe. New York: Harmony Books.",
    url: "https://noetic.org/publication/real-magic-ancient-wisdom-modern-science-and-a-guide-to-the-secret-power-of-the-universe/",
    urlLabel: "Book page on noetic.org",
    kind: "his work",
    note: "Checked from this page and the publisher's description, not from the book. This app treats it as its first primary source.",
  },
  {
    id: "walker-2018",
    cite: "Fourmilab Change Log (John Walker's blog), \"Reading List: Real Magic\", 15 May 2018.",
    url: "https://www.fourmilab.ch/fourmilog/archives/2018-05/001755.html",
    urlLabel: "fourmilab.ch",
    kind: "a review of his book",
    note: "A reader's review, unsigned on the page. Read in full; it sets out the book's three kinds of magic.",
  },
  {
    id: "morck-spr",
    cite: "Mörck, N. C. Review of Real Magic, by Dean Radin. Society for Psychical Research.",
    url: "https://www.spr.ac.uk/RealMagic",
    urlLabel: "spr.ac.uk",
    kind: "a review of his book",
    note: "Read in full. On the website of the Society for Psychical Research, which studies psi and is sympathetic to the field.",
  },
  {
    id: "scofield-2022",
    cite: "Scofield, M. (2022). Does real magic exist? Review of Dean Radin's Real Magic. Higgypop, 21 June 2022.",
    url: "https://www.higgypop.com/news/does-real-magic-exist-review-of-dean-radins-real-magic/",
    urlLabel: "higgypop.com",
    kind: "a review of his book",
    note: "Read in full. Higgypop is a site about the paranormal; the reviewer is more critical than the SPR's.",
  },
  {
    id: "radin-2012-double-slit",
    cite: "Radin, D., Michel, L., Galdamez, K., Wendland, P., Rickenbach, R. and Delorme, A. (2012). Consciousness and the double-slit interference pattern: Six experiments. Physics Essays 25(2), 157–171.",
    url: "https://noetic.org/publication/consciousness-and-the-double-slit-interference-pattern-six-experiments/",
    urlLabel: "Summary on noetic.org",
    kind: "his work",
    note: "Checked from the published summary, not the full paper.",
  },
  {
    id: "sassoli-2013",
    cite: "Sassoli de Bianchi, M. (2013). Quantum measurements are physical processes. Comment on \"Consciousness and the double-slit interference pattern: Six experiments\". Physics Essays 26(1).",
    url: "https://arxiv.org/abs/1207.0804",
    urlLabel: "arxiv.org",
    kind: "criticism",
    note: "A physicist's comment on the 2012 paper. Checked from the abstract.",
  },
  {
    id: "walleczek-2019",
    cite: "Walleczek, J. and von Stillfried, N. (2019). False-positive effect in the Radin double-slit experiment on observer consciousness as determined with the Advanced Meta-Experimental Protocol. Frontiers in Psychology 10, 1891.",
    url: "https://doi.org/10.3389/fpsyg.2019.01891",
    urlLabel: "doi.org/10.3389/fpsyg.2019.01891",
    kind: "a test of his work",
    note: "Open access. The test was paid for in part by the Fetzer Franklin Fund, where Walleczek is scientific director; the sessions were run at Radin's laboratory and analysed separately in Berlin.",
  },
  {
    id: "radin-2020-reply",
    cite: "Radin, D., Wahbeh, H., Michel, L. and Delorme, A. (2020). Commentary: False-positive effect in the Radin double-slit experiment… Frontiers in Psychology 11, 726.",
    url: "https://doi.org/10.3389/fpsyg.2020.00726",
    urlLabel: "doi.org/10.3389/fpsyg.2020.00726",
    kind: "his reply",
    note: "Open access. Radin's answer to Walleczek and von Stillfried.",
  },
  {
    id: "mossbridge-2012",
    cite: "Mossbridge, J., Tressoldi, P. and Utts, J. (2012). Predictive physiological anticipation preceding seemingly unpredictable stimuli: A meta-analysis. Frontiers in Psychology 3, 390.",
    url: "https://doi.org/10.3389/fpsyg.2012.00390",
    urlLabel: "doi.org/10.3389/fpsyg.2012.00390",
    kind: "a test of his work",
    note: "Open access. Radin is not an author; several of his studies are among the ones pooled.",
  },
  {
    id: "steinkamp-psi-encyclopedia",
    cite: "Psi Encyclopedia, \"Fiona Steinkamp\" (on Bösch, H., Steinkamp, F. and Boller, E. (2006). Examining psychokinesis: The interaction of human intention with random number generators. A meta-analysis. Psychological Bulletin 132(4), 497–523, and the replies to it).",
    url: "https://psi-encyclopedia.spr.ac.uk/articles/fiona-steinkamp/",
    urlLabel: "psi-encyclopedia.spr.ac.uk",
    kind: "a test of his work",
    note: "The 2006 paper itself is behind a paywall; it was checked through this account of it and of the replies.",
  },
  {
    id: "wilson-shadish-2006",
    cite: "Wilson, D. B. and Shadish, W. R. (2006). On blowing trumpets to the tulips: To prove or not to prove the null hypothesis. Comment on Bösch, Steinkamp, and Boller (2006). Psychological Bulletin 132(4), 524–528.",
    url: "https://zenodo.org/record/996283",
    urlLabel: "zenodo.org",
    kind: "criticism",
    note: "Checked from the abstract.",
  },
  {
    id: "good-1997",
    cite: "Good, I. J. (1997). Where has the billion trillion gone? Review of The Conscious Universe. Nature 389, 23 October 1997.",
    url: "https://condor.depaul.edu/elliott/435/psi/GoodReview.html",
    urlLabel: "Copy on a DePaul University course page",
    kind: "criticism",
    note: "A statistician's review of Radin's first book. Read in full from the copy linked; the Nature page itself is behind a paywall.",
  },
];

export interface RadinParagraph {
  text: string;
  /** Ids from RADIN_SOURCES this paragraph was written from. */
  cites: string[];
}

export interface RadinSection {
  id: string;
  title: string;
  paragraphs: RadinParagraph[];
}

export const RADIN_INTRO: RadinParagraph[] = [
  {
    text: "Dean Radin is an American researcher who has run laboratory tests of psi since the 1980s: perceiving or affecting things without any known physical route. He is one of the best-known people in the field, and one of the most argued about.",
    cites: ["psi-encyclopedia", "wikipedia"],
  },
  {
    text: "This page sets out who he is, what he tested, what he reported, and what other researchers have said about it, so you can read the original work and the replies yourself. It does not settle whether psi is real. Most scientists do not accept that it has been shown; Radin and a smaller group of researchers think the evidence is strong. Both sides are given here with their sources.",
    cites: ["wikipedia", "psi-encyclopedia"],
  },
];

export const RADIN_SECTIONS: RadinSection[] = [
  {
    id: "background",
    title: "Background",
    paragraphs: [
      {
        text: "He was born on 29 February 1952 and trained first as a classical violinist. He earned a bachelor's degree in electrical engineering at the University of Massachusetts Amherst, with honours in physics, then a master's degree in electrical engineering and, in 1979, a doctorate in psychology at the University of Illinois at Urbana-Champaign.",
        cites: ["psi-encyclopedia", "wikipedia"],
      },
      {
        text: "He worked on telecommunications research at AT&T Bell Laboratories from 1979 to 1986 and at GTE Laboratories from 1990 to 1993. He also held research posts on psi at Princeton University, the University of Edinburgh, the University of Nevada, Las Vegas, Interval Research Corporation and SRI International, where he worked on the United States government's psi programme later known as Star Gate.",
        cites: ["psi-encyclopedia", "wikipedia"],
      },
      {
        text: "He joined the Institute of Noetic Sciences (IONS) in Petaluma, California, in 2001 and is its Chief Scientist. He also teaches at the California Institute of Integral Studies. He has been president of the Parapsychological Association, the professional body for psi research, five times (1988, 1993, 1998, 2005 and 2019).",
        cites: ["ions-profile", "psi-encyclopedia"],
      },
      {
        text: "His books for general readers are The Conscious Universe (1997), Entangled Minds (2006), Supernormal (2013), Real Magic (2018) and The Science of Magic (2025). Real Magic and The Science of Magic connect laboratory work with practices such as divination, charms and ritual.",
        cites: ["psi-encyclopedia", "ions-profile"],
      },
    ],
  },
  {
    id: "real-magic",
    title: "Real Magic",
    paragraphs: [
      {
        text: "Real Magic (2018) is the book this app treats as its first primary source. In it Radin sorts magic into three kinds. Force of will is the mind affecting the physical world, as in spell-casting. Divination is perceiving objects or events distant in time and space, as in reading the tarot. Theurgy is communicating with non-material consciousness, as mediums do with spirits.",
        cites: ["real-magic", "walker-2018"],
      },
      {
        text: "He sets the laboratory psi research described on this page beside each kind, gives a short history of magic and of psi research, and argues that magic is a natural part of reality that people can study and practise. He also describes simple techniques based on focusing the mind.",
        cites: ["real-magic", "walker-2018"],
      },
      {
        text: "Nemo C. Mörck, reviewing it for the Society for Psychical Research, called it well written and clear about how the experiments were done, and said it does not discuss enough what harm could follow if psi is real. Matt Scofield, reviewing it for Higgypop, found the chapters on psi experiments interesting and convincing, and said the book reads almost as an attack on sceptics, leaves out the fraud found in the cases of the Fox sisters and Helena Blavatsky, reports a study of intention and chocolate with only 15 volunteers, and gives little of the practical guidance its subtitle suggests.",
        cites: ["morck-spr", "scofield-2022"],
      },
    ],
  },
  {
    id: "experiments",
    title: "What he tested",
    paragraphs: [
      {
        text: "Feeling ahead (presentiment). From 1997 Radin measured skin conductance, a sign of the body's arousal, while people waited for a picture chosen at random by a computer. He reported that the body began to react a few seconds before a calm or a disturbing picture appeared, and differently for each. Dick Bierman at the University of Amsterdam reported the same pattern.",
        cites: ["psi-encyclopedia"],
      },
      {
        text: "In 2012 three other researchers pooled 26 studies of this kind from seven laboratories, including several of Radin's. They found a small effect that chance does not easily explain. They wrote that its cause \"remains to be determined\", that a few unpublished null studies may be missing from their count, and that it needs repeating by other laboratories using one fixed method.",
        cites: ["mossbridge-2012"],
      },
      {
        text: "Attention and light (the double-slit test). In six experiments published in 2012, 137 people spent 250 sessions directing their attention towards, then away from, a beam of light passing through two narrow slits. Radin and colleagues reported that the light's interference pattern changed slightly in the predicted direction while people attended to it, and that 250 sessions with nobody present showed no such change.",
        cites: ["radin-2012-double-slit"],
      },
      {
        text: "Minds and random machines. Radin, with Roger Nelson and others, pooled many studies in which people tried to nudge the output of an electronic random number generator by intention alone, and reported a very small but consistent shift. He has also analysed data from the Global Consciousness Project, a worldwide network of such generators, for changes during events that hold many people's attention, such as New Year's Eve.",
        cites: ["wikipedia", "psi-encyclopedia"],
      },
      {
        text: "Tests anyone can take. Since 2000 his website GotPsi has offered online guessing tests, including a remote viewing test. He reports hundreds of millions of guesses from hundreds of thousands of people, scoring a little above chance overall, with people who believe in psi scoring a little higher than people who do not.",
        cites: ["psi-encyclopedia"],
      },
      {
        text: "Intention and the living world. Smaller studies at IONS asked whether focused intention changes things it is aimed at: the mood of people eating chocolate that others had held a focused intention over, the growth of plants given treated water, and the stress responses of a partner at a distance. Radin reports positive results in several of these. Some were labelled exploratory by their authors, and most have not been repeated outside IONS.",
        cites: ["psi-encyclopedia"],
      },
    ],
  },
  {
    id: "tests",
    title: "When others checked the work",
    paragraphs: [
      {
        text: "The double-slit test repeated. In 2012 and 2013 a funder commissioned a repeat of the double-slit test at Radin's laboratory, with the analysis done separately in Berlin by Jan Walleczek and Nikolaus von Stillfried. They published in 2019: the two predicted effects did not appear, and one comparison in the sessions with nobody present came out significant. They read that as a sign of a fault in the method, and concluded that \"skepticism should replace optimism\" about the claim.",
        cites: ["walleczek-2019"],
      },
      {
        text: "Radin and colleagues answered in 2020. They said the Berlin team ran eight comparisons without correcting for the number of them, which makes at least one chance result likely; once corrected, none of the eight was significant, including the one counted as a fault. They also reported that one measure in the predicted direction stayed significant after correction, and pointed to 28 earlier double-slit experiments, 11 of them significant.",
        cites: ["radin-2020-reply"],
      },
      {
        text: "Random number generators re-examined. In 2006 Holger Bösch, Fiona Steinkamp and Emil Boller pooled the random number generator studies again in Psychological Bulletin. They found an effect much smaller than earlier estimates, and wrote that the selective publishing of successful studies was \"the most parsimonious explanation\" for it. Radin, Nelson, York Dobyns and Joop Houtkooper replied that the analysis wrongly treated the size of an effect as independent of the size of a study.",
        cites: ["steinkamp-psi-encyclopedia"],
      },
      {
        text: "In the same issue David Wilson and William Shadish wrote that an effect this small, with no account of how a mind could reach a machine, is very hard to learn anything from. They asked psi researchers either to look for larger effects or to say in advance what result would make them accept that there is no effect.",
        cites: ["wilson-shadish-2006"],
      },
    ],
  },
  {
    id: "criticism",
    title: "What critics say",
    paragraphs: [
      {
        text: "Statistics and the missing studies. Reviewing The Conscious Universe in Nature in 1997, the statistician I. J. Good called the book well written and well referenced, but said it left out known fraud in the history of the field (the experiments of S. G. Soal), combined probabilities in a way that overstates them, and greatly overestimated how many unpublished failed studies it would take to cancel the results. Radin's reply was printed in 1998. The physicist Victor Stenger made similar points about the count of missing studies in 2002.",
        cites: ["good-1997", "psi-encyclopedia", "wikipedia"],
      },
      {
        text: "A selective history. The psychologist Chris French and the writer Robert Todd Carroll said Radin's books tell the history of psi research without the cases of fraud and with little of the sceptical literature. The psychologist Ray Hyman wrote that results in the field are inconsistent and hard to repeat, and that many psi researchers admit this. Dale DeBakcsy, reviewing Supernormal in 2014, said it loosened the measures of success and presented a striking match picked from hundreds of trials.",
        cites: ["wikipedia"],
      },
      {
        text: "Quantum physics. Physicists have said that quantum mechanics describes measurement without needing a mind, so the double-slit results, whatever their cause, do not show that consciousness shapes physical events. Massimiliano Sassoli de Bianchi made this case in a published comment on the 2012 paper.",
        cites: ["sassoli-2013", "wikipedia"],
      },
    ],
  },
  {
    id: "standing",
    title: "Where it stands",
    paragraphs: [
      {
        text: "Radin's view is that small effects found again and again across many laboratories, in pooled studies that allow for missing results, are hard to explain by chance, error or fraud. His critics' view is that small effects of this kind are what selective publishing, flexible analysis and subtle flaws in method produce, and that the field has not yet produced a result that independent laboratories can repeat on demand. Both views are argued in published, checkable work, and the question is not settled.",
        cites: ["psi-encyclopedia", "wikipedia", "mossbridge-2012", "steinkamp-psi-encyclopedia"],
      },
      {
        text: "Some of the methods in this debate are also in this app: a target chosen at random and sealed before you write, your first impression written down before you see the answer, and a count compared with what chance alone would give. They are there so your own record is clear to you, whatever you conclude.",
        cites: [],
      },
    ],
  },
];

export function getRadinSource(id: string): RadinSource | undefined {
  return RADIN_SOURCES.find((s) => s.id === id);
}
