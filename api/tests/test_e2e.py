import os
import sys
import io

# Ensure project root is on sys.path so `api` can be imported when tests run
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from fastapi.testclient import TestClient

try:
    from reportlab.pdfgen import canvas
except Exception:
    canvas = None


def make_pdf_bytes(text: str) -> bytes:
    """Create a simple one-page PDF in-memory containing `text`.

    Uses reportlab if available; otherwise raises ImportError so test
    runner can install the dependency.
    """
    if canvas is None:
        raise ImportError("reportlab is required for this test: pip install reportlab")
    bio = io.BytesIO()
    c = canvas.Canvas(bio)
    # draw text lines
    y = 800
    for line in text.splitlines():
        c.drawString(40, y, line)
        y -= 14
    c.showPage()
    c.save()
    bio.seek(0)
    return bio.read()


def test_upload_and_search_roundtrip():
    # booking value must match the numeric pattern the parser expects
    booking = "123456"
    sample_text = f"Booking {booking}\nPassenger: Mr John Doe 01-01-90"
    pdf_bytes = make_pdf_bytes(sample_text)

    # import the FastAPI app
    from api.main import app

    client = TestClient(app)

    # Upload PDF and cache
    files = {"file": ("test.pdf", pdf_bytes, "application/pdf")}
    resp = client.post("/api/upload", files=files)
    assert resp.status_code == 200, resp.text
    j = resp.json()
    assert "sessionId" in j and j["sessionId"], j
    session_id = j["sessionId"]

    # Search using sessionId
    data = {"booking": booking, "sessionId": session_id}
    resp2 = client.post("/api/search", data=data)
    assert resp2.status_code == 200, resp2.text
    out = resp2.json()
    assert out.get("booking") == booking or booking in str(out), out


def test_one_shot_parse():
    booking = "654321"
    sample_text = f"Booking {booking}\nPassenger: Mrs Jane Smith 02-02-85"
    pdf_bytes = make_pdf_bytes(sample_text)

    from api.main import app
    client = TestClient(app)

    files = {"file": ("one.pdf", pdf_bytes, "application/pdf")}
    data = {"booking": booking}
    resp = client.post("/api/parse", data=data, files=files)
    assert resp.status_code == 200, resp.text
    j = resp.json()
    assert j.get("booking") == booking or booking in str(j), j
