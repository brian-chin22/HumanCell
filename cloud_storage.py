import sqlite3
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent / "cloud_data.db"

def read_all_strings_from_cloud(db_path: Optional[str] = None) -> list:
    """
    Reads all stored text entries from the SQLite3 database and returns them as a list of dicts.
    Each dict contains: id, text, created_at
    """
    db_file = db_path or str(DB_PATH)
    conn = sqlite3.connect(db_file)
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS cloud_strings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("SELECT id, text, created_at FROM cloud_strings ORDER BY id ASC")
        rows = cur.fetchall()
        return [ {"id": r[0], "text": r[1], "created_at": r[2]} for r in rows ]
    finally:
        conn.close()

def store_txt_file_in_cloud(txt_file_path: str, db_path: Optional[str] = None) -> int:
    """
    Accepts a path to a .txt file, reads its contents, and stores it in a SQLite3 database (cloud_data.db).
    Returns the inserted row id.
    """
    file_path = Path(txt_file_path)
    if not file_path.is_file():
        raise FileNotFoundError(f"File not found: {txt_file_path}")
    text = file_path.read_text(encoding="utf-8")
    if not text:
        raise ValueError("Text file is empty.")
    db_file = db_path or str(DB_PATH)
    conn = sqlite3.connect(db_file)
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS cloud_strings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("INSERT INTO cloud_strings (text) VALUES (?)", (text,))
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()

if __name__ == "__main__":
    # Example usage: store a txt file and read all stored entries
    test_txt = "example.txt"
    Path(test_txt).write_text("This is a sample text file for cloud storage.", encoding="utf-8")
    row_id = store_txt_file_in_cloud(test_txt)
    print(f"Stored contents of '{test_txt}' with row id: {row_id}")

    # Read all stored strings
    all_entries = read_all_strings_from_cloud()
    print("All stored entries:")
    for entry in all_entries:
        print(entry)