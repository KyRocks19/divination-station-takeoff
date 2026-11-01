import { getImageProps } from "next/image";

interface FillImageProps {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
}

/**
 * A picture that fills its (positioned) parent, through Next.js's image optimizer, without an inline style attribute.
 * `<Image fill>` writes a style attribute (position absolute and so on) into the page, which the page policy refuses (lib/csp.ts), so this takes the
 * props `<Image>` would have used (the resized sources, lazy loading) and leaves the style off; the same layout comes from classes.
 */
export default function FillImage({ src, alt, sizes, className = "" }: FillImageProps) {
  const {
    props: { style: _style, ...img },
  } = getImageProps({ src, alt, sizes, fill: true });
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...img} alt={alt} className={`absolute inset-0 h-full w-full text-transparent ${className}`} />;
}
