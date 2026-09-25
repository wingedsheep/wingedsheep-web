"""Fetch Vincent's Goodreads "read" shelf for the bookcase in the lighthouse.

    python3 tools/reading/goodreads.py

Reads the public RSS feed of the shelf and writes src/data/reading.json: every book with its
title (series split off), author, Vincent's stars (0 = not rated) and when he finished it
(null when Goodreads doesn't know), newest first. Run it again after finishing a book.
"""
from __future__ import annotations

import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path

USER = "18008199"
URL = f"https://www.goodreads.com/review/list_rss/{USER}?shelf=read&per_page=200"
OUT = Path(__file__).resolve().parents[2] / "src" / "data" / "reading.json"


def main():
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (wingedsheep.com bookcase)"})
    root = ET.fromstring(urllib.request.urlopen(req).read())
    books = []
    for item in root.iter("item"):
        text = lambda tag: " ".join((item.findtext(tag) or "").split())  # noqa: E731
        title = text("title")
        series = None
        m = re.match(r"^(.*?)\s*\(([^()]*#[^()]*)\)$", title)  # "Golden Son (Red Rising Saga, #2)"
        if m:
            title, series = m.group(1), m.group(2)
        read = text("user_read_at")
        books.append({
            "title": title,
            "series": series,
            "author": text("author_name"),
            "stars": int(text("user_rating") or 0),
            "read": parsedate_to_datetime(read).date().isoformat() if read else None,
        })
    books.sort(key=lambda b: b["read"] or "", reverse=True)
    OUT.write_text(json.dumps(books, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {len(books)} books to {OUT}")


main()
