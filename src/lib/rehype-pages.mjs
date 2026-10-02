// Laying out a post's pictures at build time:
// - every local image gets its real width and height, so the page keeps its shape while lazy
//   images load (and a jump from the contents lands on the heading, not where it was);
// - every image loads lazily, once it nears the screen;
// - three or more pictures in a row, with no text between them, become one gallery.
import { readFileSync } from 'node:fs';
import { raw } from 'hast-util-raw';

/** The pixel size of a webp, png, gif or jpeg in public/, or null if it can't be read. */
export function size(src) {
  let b;
  try {
    b = readFileSync(`./public${decodeURIComponent(src.split(/[?#]/)[0])}`);
  } catch {
    return null;
  }
  const tag = (at, s) => b.toString('latin1', at, at + s.length) === s;
  if (tag(0, 'RIFF') && tag(8, 'WEBP')) {
    if (tag(12, 'VP8X')) return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (tag(12, 'VP8L')) {
      const n = b.readUInt32LE(21);
      return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)];
    }
    if (tag(12, 'VP8 ')) return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  }
  if (tag(1, 'PNG')) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (tag(0, 'GIF')) return [b.readUInt16LE(6), b.readUInt16LE(8)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length; ) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      // the start-of-frame markers, leaving out the ones that aren't (DHT, JPG, DAC)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

const isElement = (n, tag) => n?.type === 'element' && (!tag || n.tagName === tag);
const blank = (n) => n.type === 'text' && !n.value.trim();
const kids = (n) => n.children.filter((c) => !blank(c));

/** A paragraph holding nothing but one picture, or a figure of a picture and its caption. */
function isPicture(n) {
  if (isElement(n, 'p')) {
    const k = kids(n);
    return k.length === 1 && isElement(k[0], 'img');
  }
  if (isElement(n, 'figure')) {
    const k = kids(n);
    return isElement(k[0], 'img') && k.slice(1).every((c) => isElement(c, 'figcaption'));
  }
  return false;
}

function measure(n) {
  if (isElement(n, 'img')) {
    n.properties.loading ??= 'lazy';
    n.properties.decoding ??= 'async';
  }
  if (isElement(n, 'img') && n.properties.src?.startsWith('/') && n.properties.width == null) {
    const wh = size(n.properties.src);
    if (wh) [n.properties.width, n.properties.height] = wh;
  }
  for (const c of n.children ?? []) measure(c);
}

export default function rehypePages() {
  return (input) => {
    // the posts write many of their figures as HTML: read that in, so those count too
    const tree = raw(input);
    measure(tree);
    const out = [];
    let run = [];
    const flush = () => {
      const pictures = run.filter((n) => !blank(n));
      if (pictures.length >= 3) {
        out.push({ type: 'element', tagName: 'div', properties: { className: ['gallery'] }, children: pictures });
      } else out.push(...run);
      run = [];
    };
    for (const n of tree.children) {
      if (isPicture(n)) run.push(n);
      else if (blank(n) && run.length) run.push(n);
      else {
        flush();
        out.push(n);
      }
    }
    flush();
    tree.children = out;
    return tree;
  };
}
