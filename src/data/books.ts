import reading from './reading.json';

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
