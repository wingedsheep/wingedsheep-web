import reading from './reading.json';
import now from './reading-now.json';
import notes from './book-notes.json';

/**
 * Everything Vincent has read, newest first: his Goodreads "read" shelf, fetched by
 * tools/reading/goodreads.py. The bookcase in the lighthouse holds them all.
 */
export interface ReadBook {
  title: string;
  series: string | null;
  author: string;
  /** His rating; 0 when he didn't give one. */
  stars: number;
  /** When he finished it (YYYY-MM-DD), if Goodreads knows. */
  read: string | null;
}

export const BOOKS = reading as ReadBook[];

/** The book he's reading now (the newest on his "currently-reading" shelf), open on his desk; null if none. */
export const READING_NOW = now as Pick<ReadBook, 'title' | 'series' | 'author'> | null;

/**
 * What each book is about, and now and then how it fits with him or the island, by title
 * (src/data/book-notes.json, written by hand: the Goodreads sync leaves it alone). A book
 * without one just says its title and author.
 */
export const NOTES = notes as Record<string, string>;
