// The picture file for a tarot card id such as "major-3" or "cups-ace", inside public/cards. This file touches no
// database code, so screens that run in the browser can import it.

export function cardIdToFileName(cardId: string): string {
  const MAJOR_MAP: Record<string, string> = {
    "major-0": "0-Fool.jpg",
    "major-1": "I-Magician.jpg",
    "major-2": "II-HighPriestess.jpg",
    "major-3": "III-Empress.jpg",
    "major-4": "IV-Emperor.jpg",
    "major-5": "V-Hierophant.jpg",
    "major-6": "VI-Lovers.jpg",
    "major-7": "VII-Chariot.jpg",
    "major-8": "VIII-Strength.jpg",
    "major-9": "IX-Hermit.jpg",
    "major-10": "X-WheelOfFortune.jpg",
    "major-11": "XI-Justice.jpg",
    "major-12": "XII-HangedMan.jpg",
    "major-13": "XIII-Death.jpg",
    "major-14": "XIV-Temperance.jpg",
    "major-15": "XV-Devil.jpg",
    "major-16": "XVI-Tower.jpg",
    "major-17": "XVII-Star.jpg",
    "major-18": "XVIII-Moon.jpg",
    "major-19": "XIX-Sun.jpg",
    "major-20": "XX-Judgement.jpg",
    "major-21": "XXI-World.jpg",
  };

  if (MAJOR_MAP[cardId]) return MAJOR_MAP[cardId];

  const [suit, rank] = cardId.split("-");
  const suitCap = suit.charAt(0).toUpperCase() + suit.slice(1);

  const RANK_PREFIX: Record<string, string> = {
    ace: "Ace",
    "2": "II", "3": "III", "4": "IV", "5": "V", "6": "VI",
    "7": "VII", "8": "VIII", "9": "IX", "10": "X",
    page: "Page", knight: "Knight", queen: "Queen", king: "King",
  };

  const prefix = RANK_PREFIX[rank] ?? rank;
  return `${prefix}-${suitCap}.jpg`;
}
