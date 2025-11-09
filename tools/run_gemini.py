#!/usr/bin/env python3
"""
Read stored text records and feed them into Gemini (Google Generative AI) using a prompt template.

Usage examples:
  # Print prompts (no API calls)
  python tools/run_gemini.py --source cloud --limit 5 --template "Summarize the following text:\n\n{text}\n\nSummary:"

  # Actually call Gemini (requires GOOGLE_API_KEY set and google-generative-ai installed)
  python tools/run_gemini.py --source cloud --limit 3 --template-file prompts/sample.txt --call

Supported sources:
  - cloud : reads from cloud_data.db (cloud_strings table)
  - inputs: reads from data/inputs.sqlite (inputs table, uses 'received' field if present)

Outputs:
  - Prints prompt -> response pairs to stdout
  - Appends results to data/gemini_results.jsonl (one JSON per line)

Note: This script attempts to call Gemini if --call is provided and an appropriate client is installed.
If the client is not available it will explain how to install it and will not attempt the network call.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional

OUT_FILE = Path("data/gemini_results.jsonl")


def read_cloud_strings(limit: Optional[int] = None) -> List[Dict[str, Any]]:
    db = Path("cloud_data.db")
    if not db.exists():
        return []
    con = sqlite3.connect(str(db))
    try:
        q = "SELECT id, text, created_at FROM cloud_strings ORDER BY id DESC"
        if limit:
            q += f" LIMIT {int(limit)}"
        rows = con.execute(q).fetchall()
        return [{"id": r[0], "text": r[1], "ts": r[2]} for r in rows]
    finally:
        con.close()


def read_inputs(limit: Optional[int] = None) -> List[Dict[str, Any]]:
    db = Path("data/inputs.sqlite")
    if not db.exists():
        return []
    con = sqlite3.connect(str(db))
    try:
        q = "SELECT id, route, received, result, ts FROM inputs ORDER BY id DESC"
        if limit:
            q += f" LIMIT {int(limit)}"
        rows = con.execute(q).fetchall()
        out = []
        for r in rows:
            _id, route, received, result, ts = r
            # received/result are JSON strings in many cases
            try:
                rec = json.loads(received) if received else received
            except Exception:
                rec = received
            out.append({"id": _id, "route": route, "received": rec, "result": result, "ts": ts})
        return out
    finally:
        con.close()


def build_prompt(template: str, record: Dict[str, Any]) -> str:
    # Provide commonly used placeholders: {text}, {received}, {id}, {route}, {ts}
    text = None
    if "text" in record:
        text = record["text"]
    elif "received" in record:
        # If received is dict with freeText or similar, try common keys
        rec = record["received"]
        if isinstance(rec, dict):
            text = rec.get("freeText") or rec.get("text") or json.dumps(rec)
        else:
            text = str(rec)
    else:
        text = ""

    filled = template.replace("{text}", text or "")
    filled = filled.replace("{id}", str(record.get("id", "")))
    filled = filled.replace("{route}", str(record.get("route", "")))
    filled = filled.replace("{ts}", str(record.get("ts", "")))
    # also expose full received and result as JSON
    try:
        filled = filled.replace("{received}", json.dumps(record.get("received", {})))
    except Exception:
        filled = filled.replace("{received}", str(record.get("received", "")))
    return filled


def call_gemini(prompt: str, model: str = "text-bison-001") -> Dict[str, Any]:
    """
    Try to call Google Generative AI (Gemini) and return a dict with the response.
    This function attempts multiple client libraries. If none are available it raises ImportError
    with an instruction message.
    """
    # First try the new google.generativeai package
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GOOGLE_API_KEY_JSON")
    if not api_key:
        # Not mandatory if ADC is configured, but warn user
        pass

    # Try google.generativeai (package name: google-generative-ai / google.generativeai)
    try:
        import google.generativeai as genai  # type: ignore

        # configure if function exists
        if hasattr(genai, "configure"):
            try:
                genai.configure(api_key=api_key)
            except Exception:
                # ignore - maybe ADC used
                pass

        # generate text - adapt to API variations
        if hasattr(genai, "generate_text"):
            resp = genai.generate_text(model=model, prompt=prompt)
            # response shape may vary
            text = None
            if hasattr(resp, "text"):
                text = resp.text
            elif isinstance(resp, dict) and "candidates" in resp:
                text = resp.get("candidates")[0].get("content")
            else:
                text = str(resp)
            return {"model": model, "text": text, "raw": repr(resp)}

        # older client variations
        if hasattr(genai, "Client"):
            client = genai.Client()
            out = client.generate_text(model=model, prompt=prompt)
            return {"model": model, "text": getattr(out, "text", str(out)), "raw": repr(out)}
    except Exception as e:
        last_exc = e

    # Try the google.ai.genai (alternate names)
    try:
        from google import genai as ggenai  # type: ignore
        try:
            ggenai.configure(api_key=api_key)
        except Exception:
            pass
        if hasattr(ggenai, "generate_text"):
            resp = ggenai.generate_text(model=model, prompt=prompt)
            text = getattr(resp, "text", None) or str(resp)
            return {"model": model, "text": text, "raw": repr(resp)}
    except Exception:
        pass

    # If we reach here, the environment doesn't have a known client available.
    raise ImportError(
        "No supported Google Generative AI client found. Install the official package (e.g. `pip install google-generative-ai`) and set GOOGLE_API_KEY, or run without --call to only print prompts."
    )


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Feed stored text to Gemini using a prompt template")
    p.add_argument("--source", choices=["cloud", "inputs"], default="cloud", help="Where to read text from")
    p.add_argument("--limit", type=int, default=10)
    p.add_argument("--template", type=str, help="Prompt template string. Use {text} or {received} placeholders.")
    p.add_argument("--template-file", type=str, help="Load template from a file")
    p.add_argument("--call", action="store_true", help="Actually call Gemini (requires client & API key). If omitted, prompts are printed only.")
    p.add_argument("--model", type=str, default="text-bison-001", help="Model name to use if calling Gemini")
    args = p.parse_args(argv)

    if args.template_file:
        tmpl = Path(args.template_file).read_text(encoding="utf-8")
    else:
        tmpl = args.template or "Summarize the following text:\n\n{text}\n\nSummary:"

    if args.source == "cloud":
        records = read_cloud_strings(limit=args.limit)
    else:
        records = read_inputs(limit=args.limit)

    if not records:
        print("No records found from source", args.source)
        return 0

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    with OUT_FILE.open("a", encoding="utf-8") as out:
        for rec in records:
            prompt = build_prompt(tmpl, rec)
            print("--- PROMPT ---")
            print(prompt)

            result: Dict[str, Any] = {"record": rec, "prompt": prompt, "response": None}
            if args.call:
                try:
                    resp = call_gemini(prompt, model=args.model)
                    result["response"] = resp
                    print("--- RESPONSE ---")
                    print(resp.get("text") if isinstance(resp, dict) else resp)
                except ImportError as ie:
                    print("Skipping Gemini call:", ie)
                    result["error"] = str(ie)
                except Exception as e:
                    print("Gemini call failed:", e)
                    result["error"] = str(e)
            out.write(json.dumps(result, ensure_ascii=False) + "\n")

    print(f"Wrote results/appended to {OUT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
