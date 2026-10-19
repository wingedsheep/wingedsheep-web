"""Fetch Vincent's Goodreads "read" shelf for the bookcase in the lighthouse.

    python3 tools/reading/goodreads.py

Reads the public RSS feed of the shelf and writes src/data/reading.json: every book with its
title (series split off), author, Vincent's stars (0 = not rated) and when he finished it
(null when Goodreads doesn't know), newest first. Run it again after finishing a book.

It also writes src/data/reading-now.json: the book he most recently put on his "currently-reading"
shelf (that shelf holds a few he set down years ago, so only the newest counts), or null. It lies
open on his desk.
"""
from __future__ import annotations

import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path

USER = "18008199"
FEED = f"https://www.goodreads.com/review/list_rss/{USER}?per_page=200&shelf="
DATA = Path(__file__).resolve().parents[2] / "src" / "data"


def shelf(name: str):
    """Every book on one shelf, with when it went on the shelf ("added")."""
    req = urllib.request.Request(FEED + name, headers={"User-Agent": "Mozilla/5.0 (wingedsheep.com bookcase)"})
    root = ET.fromstring(urllib.request.urlopen(req).read())
    books = []
    for item in root.iter("item"):
        text = lambda tag: " ".join((item.findtext(tag) or "").split())  # noqa: E731
        title = text("title")
        series = None
        m = re.match(r"^(.*?)\s*\(([^()]*#[^()]*)\)$", title)  # "Golden Son (Red Rising Saga, #2)"
        if m:
            title, series = m.group(1), m.group(2)
        date = lambda tag: parsedate_to_datetime(text(tag)).date().isoformat() if text(tag) else None  # noqa: E731
        books.append({
            "title": title,
            "series": series,
            "author": text("author_name"),
            "stars": int(text("user_rating") or 0),
            "read": date("user_read_at"),
            "added": date("user_date_added"),
        })
    return books


def main():
    books = shelf("read")
    for b in books:
        del b["added"]
    books.sort(key=lambda b: b["read"] or "", reverse=True)
    (DATA / "reading.json").write_text(json.dumps(books, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {len(books)} books to {DATA / 'reading.json'}")

    now = max(shelf("currently-reading"), key=lambda b: b["added"] or "", default=None)
    if now:
        now = {k: now[k] for k in ("title", "series", "author")}
    (DATA / "reading-now.json").write_text(json.dumps(now, indent=1, ensure_ascii=False) + "\n")
    print(f"reading now: {now['title'] if now else 'nothing'}")


main()
