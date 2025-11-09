import os
import pytest
from tools.run_gemini import read_cloud_strings

# This test assumes GOOGLE_API_KEY is set and google-genai is installed

def test_gemini_response():
    try:
        from google import genai
    except ImportError:
        pytest.skip("google-genai not installed")

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        pytest.skip("GOOGLE_API_KEY not set in environment")

    records = read_cloud_strings(limit=1)
    assert records, "No cloud records to test"
    text = records[0]["text"]
    prompt = text + "\nExplain how AI works in a few words"

    client = genai.Client()
    response = client.models.generate_content(
        model="gemini-2.5-flash", contents=prompt
    )
    # Check that response has text and is not empty
    assert hasattr(response, "text")
    assert response.text.strip() != ""
    print("Gemini response:", response.text)

if __name__ == "__main__":
    import pytest
    pytest.main([__file__])
