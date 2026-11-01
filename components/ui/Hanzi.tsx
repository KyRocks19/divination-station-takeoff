/**
 * Chinese characters inside English text (the I Ching's names). `lang` lets a screen reader read them as Chinese and the browser choose
 * Chinese letterforms; `font-hanzi` (app/globals.css) names Chinese fonts, because none of the reading fonts has these characters.
 */
export default function Hanzi({ children }: { children: React.ReactNode }) {
  return (
    <span lang="zh-Hant" className="font-hanzi">
      {children}
    </span>
  );
}
