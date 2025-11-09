"""Simple storage module for persisting user inputs.

Uses SQLite (no external dependencies) and provides a tiny API:
- init_db(db_path=None)
- save_input(text, source='form', processed=None, db_path=None) -> row id
- get_all(limit=None, db_path=None) -> list[dict]

The database file defaults to `data.db` next to this module.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

DEFAULT_DB = Path(__file__).parent / "data.db"


def init_db(db_path: Optional[Path | str] = None) -> Path:
    """Create the DB file and table if needed. Returns the Path to the DB."""
    db_path = Path(db_path) if db_path else DEFAULT_DB
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db_path)
    try:
        cur = con.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS inputs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                source TEXT,
                processed TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        con.commit()
    finally:
        con.close()
    return db_path


def _get_conn(db_path: Optional[Path | str] = None) -> sqlite3.Connection:
    db = init_db(db_path)
    return sqlite3.connect(db)


def save_input(
    text: str,
    source: str = "form",
    processed: Optional[str] = None,
    db_path: Optional[Path | str] = None,
) -> int:
    """Save an input record and return the inserted row id."""
    if text is None:
        raise ValueError("text must not be None")
    created_at = datetime.utcnow().isoformat()
    conn = _get_conn(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO inputs (text, source, processed, created_at) VALUES (?, ?, ?, ?)",
            (text, source, processed, created_at),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def get_all(limit: Optional[int] = None, db_path: Optional[Path | str] = None) -> List[Dict[str, Any]]:
    """Return all saved inputs as a list of dicts (most recent first)."""
    conn = _get_conn(db_path)
    try:
        cur = conn.cursor()
        q = "SELECT id, text, source, processed, created_at FROM inputs ORDER BY id DESC"
        if limit:
            q += " LIMIT ?"
            cur.execute(q, (limit,))
        else:
            cur.execute(q)
        rows = cur.fetchall()
        results: List[Dict[str, Any]] = []
        for r in rows:
            results.append(
                {
                    "id": r[0],
                    "text": r[1],
                    "source": r[2],
                    "processed": r[3],
                    "created_at": r[4],
                }
            )
        return results
    finally:
        conn.close()


if __name__ == "__main__":
    # quick manual smoke test
    db = init_db()
    print("DB initialized at:", db)
    row = save_input("example input from __main__", source="cli", processed="EXAMPLE")
    print("Inserted row id:", row)
    print(get_all(limit=5))
