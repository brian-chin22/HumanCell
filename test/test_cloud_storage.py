import os
import tempfile
import sqlite3
import pytest
from pathlib import Path

# Import the cloud storage helper
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from cloud_storage import store_txt_file_in_cloud, read_all_strings_from_cloud

def test_store_and_retrieve_cloud(tmp_path):
    # Create a temp text file as user input
    txt_file = tmp_path / "input.txt"
    txt_content = "User input for cloud test."
    txt_file.write_text(txt_content, encoding="utf-8")

    # Use a temp DB file
    db_path = tmp_path / "cloud_data.db"

    # Store input in cloud
    row_id = store_txt_file_in_cloud(str(txt_file), db_path=str(db_path))
    assert isinstance(row_id, int) and row_id > 0

    # Retrieve info from cloud
    records = read_all_strings_from_cloud(db_path=str(db_path))
    assert len(records) == 1
    assert records[0]["text"] == txt_content

    # Check created_at field exists
    assert "created_at" in records[0]

if __name__ == "__main__":
    import pytest
    pytest.main([__file__])
