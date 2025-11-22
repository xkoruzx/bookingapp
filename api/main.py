# app/main.py
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import os, tempfile, shutil
import pdfplumber
import re
from datetime import datetime, date
from typing import List, Optional
from uuid import uuid4

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Middleware
@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    if request.method == "OPTIONS":
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Max-Age": "3600",
            }
        )
    
    try:
        response = await call_next(request)
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response
    except Exception as e:
        print(f"❌ Middleware error: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": f"Server error: {str(e)}"},
            headers={"Access-Control-Allow-Origin": "*"}
        )
# -------------------
# Parsing helpers (adapted from your provided code)
# -------------------
def _parse_date_str(dstr):
    if not dstr or not isinstance(dstr, str):
        return None
    for fmt in ("%y-%m-%d", "%Y-%m-%d", "%d-%m-%y", "%d-%m-%Y"):
        try:
            return datetime.strptime(dstr, fmt).date()
        except ValueError:
            continue
    return None


def format_age_suffix(birth_str):
    d = _parse_date_str(birth_str)
    if not d:
        return None
    today = date.today()
    years = today.year - d.year - ((today.month, today.day) < (d.month, d.day))
    if years >= 1:
        return f"{years}YO"
    months = (today.year - d.year) * 12 + (today.month - d.month) - (today.day < d.day)
    if months < 0:
        months = 0
    return f"{months}Month"


def extract_all_pages(path):
    pages = []
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages):
            pages.append((i + 1, page.extract_text()))
    return pages


def extract_flight_number(line):
    m = re.search(r"\b(\d{3,5})\b", line)
    return m.group(1) if m else None


def find_flight_info_backward(pages, start_index, info_type="arrival"):
    flight_number = None
    flight_time = None
    page_found = None
    for idx in range(start_index, -1, -1):
        page_num, text = pages[idx]
        if not text:
            continue
        lines = text.splitlines()
        for i, line in enumerate(lines):
            lower = line.lower()
            if "flight" in lower or "flt" in lower:
                fnum = extract_flight_number(line)
                if fnum:
                    flight_number = fnum
                    # Prefer labeled times on the page when available
                    page_text = "\n".join(lines)
                    if info_type == 'departure':
                        m_label = re.search(r"departure time[^\d]*(\d{1,2}:\d{2})", page_text, re.I)
                        if m_label:
                            flight_time = m_label.group(1)
                    elif info_type == 'arrival':
                        m_label = re.search(r"arrival time[^\d]*(\d{1,2}:\d{2})", page_text, re.I)
                        if m_label:
                            flight_time = m_label.group(1)
                    # Fallback to nearby-window time if no explicit labeled time found
                    if not flight_time:
                        window = "\n".join(lines[max(0, i-2):i+4])
                        m = re.search(r"(\d{1,2}:\d{2})", window)
                        if m:
                            candidate = m.group(1)
                            wlower = window.lower()
                            if info_type == 'departure' and 'arriv' in wlower:
                                pass
                            elif info_type == 'arrival' and 'depart' in wlower:
                                pass
                            else:
                                flight_time = candidate
            # Also allow explicit labeled lines to set the time
            if info_type == "arrival" and ("arrival time" in lower or "arrive" in lower):
                m = re.search(r"(\d{1,2}:\d{2})", line)
                if m:
                    flight_time = m.group(1)
            if info_type == "departure" and ("departure time" in lower or "depart" in lower):
                m = re.search(r"(\d{1,2}:\d{2})", line)
                if m:
                    flight_time = m.group(1)
        if flight_number or flight_time:
            page_found = page_num
            if flight_number and flight_time:
                break
    return flight_number, flight_time, page_found


def find_flight_info_forward(pages, start_index, info_type="departure"):
    flight_number = None
    flight_time = None
    page_found = None
    n = len(pages)
    for idx in range(start_index, n):
        page_num, text = pages[idx]
        if not text:
            continue
        lines = text.splitlines()
        for i, line in enumerate(lines):
            lower = line.lower()
            if "flight" in lower or "flt" in lower:
                fnum = extract_flight_number(line)
                if fnum:
                    flight_number = fnum
                    # Prefer labeled times on the page when available
                    page_text = "\n".join(lines)
                    if info_type == 'departure':
                        m_label = re.search(r"departure time[^\d]*(\d{1,2}:\d{2})", page_text, re.I)
                        if m_label:
                            flight_time = m_label.group(1)
                    elif info_type == 'arrival':
                        m_label = re.search(r"arrival time[^\d]*(\d{1,2}:\d{2})", page_text, re.I)
                        if m_label:
                            flight_time = m_label.group(1)
                    # Fallback to nearby-window time if no explicit labeled time found
                    if not flight_time:
                        window = "\n".join(lines[max(0, i-2):i+4])
                        m = re.search(r"(\d{1,2}:\d{2})", window)
                        if m:
                            candidate = m.group(1)
                            wlower = window.lower()
                            if info_type == 'departure' and 'arriv' in wlower:
                                pass
                            elif info_type == 'arrival' and 'depart' in wlower:
                                pass
                            else:
                                flight_time = candidate
            if info_type == "arrival" and ("arrival time" in lower or "arrive" in lower):
                m = re.search(r"(\d{1,2}:\d{2})", line)
                if m:
                    flight_time = m.group(1)
            if info_type == "departure" and ("departure time" in lower or "depart" in lower):
                m = re.search(r"(\d{1,2}:\d{2})", line)
                if m:
                    flight_time = m.group(1)
        if flight_number or flight_time:
            page_found = page_num
            if flight_number and flight_time:
                break
    return flight_number, flight_time, page_found


def format_flight_number(flight_number, user_prefix=None):
    if not flight_number:
        return None
    if user_prefix:
        return f"{user_prefix}{flight_number}"
    return flight_number


def _detect_airline_on_text(text: Optional[str]):
    """Detect airline from page text. Returns a normalized airline name or None.

    Detection rules (simple heuristics):
    - If page contains 'PLL LOT' or 'LOT' -> 'LOT'
    - If page contains 'NEOS' or 'NEOS AIR' -> 'Neos Air'
    """
    if not text:
        return None
    t = text.upper()
    # Priority: detect LOT (PLL LOT) first
    if re.search(r"\bPLL\s+LOT\b", t) or re.search(r"\bLOT\b", t):
        return "LOT"
    # Detect NEOS only when the page explicitly contains NEOS/NEOS AIR (do not infer from 'NO' token)
    if re.search(r"\bNEOS\b", t) or re.search(r"\bNEOS\s+AIR\b", t):
        return "Neos Air"
    return None


def _format_by_airline(raw_flight, airline_name: Optional[str]):
    """Format flight number according to airline rules specified by user.

    - Neos Air -> NO + zero-padded 4 digits
    - LOT -> LOT + digits (no padding)
    - Otherwise: return raw_flight unchanged
    """
    if not raw_flight:
        return None
    s = str(raw_flight)
    # extract digits
    m = re.search(r"(\d+)", s)
    digits = m.group(1) if m else None
    if airline_name == "Neos Air":
        if digits:
            try:
                num = int(digits)
                return f"NO{num:04d}"
            except Exception:
                return f"NO{digits}"
        return f"NO{s}"
    if airline_name == "LOT":
        if digits:
            return f"LOT{digits}"
        return f"LOT{s}"
    # default: return original
    return raw_flight


def build_booking_index(pages, min_digits=6, max_digits=10):
    idx = {}
    pat = re.compile(r"\b\d{%d,%d}\b" % (min_digits, max_digits))
    for page_num, text in pages:
        if not text:
            continue
        for m in pat.findall(text):
            lst = idx.setdefault(m, [])
            lst.append((page_num, text))
    return idx


def parse_booking(pages, booking_no, prefix_arrival=None, prefix_departure=None, pre_matched_pages=None):
    matched_pages = []
    if pre_matched_pages is not None:
        matched_pages = list(pre_matched_pages)
    else:
        for page_num, text in pages:
            if booking_no in (text or ""):
                matched_pages.append((page_num, text))
    if not matched_pages:
        return None
    matched_pages.sort(key=lambda x: x[0])
    departure_page_num, departure_text = matched_pages[0]
    arrival_page_num, arrival_text = matched_pages[-1]
    arrival_flight, arrival_time, arrival_page_num_found = find_flight_info_backward(pages, arrival_page_num - 1, info_type="arrival")
    # Prefer a forward search for departure info (departure details may appear on or after the booking page)
    departure_flight, departure_time, departure_page_num_found = find_flight_info_forward(pages, departure_page_num - 1, info_type="departure")
    # Fallback to backward search if forward didn't find useful data
    if not departure_time and not departure_flight:
        dflight_b, dtime_b, dpage_b = find_flight_info_backward(pages, departure_page_num - 1, info_type="departure")
        departure_flight = departure_flight or dflight_b
        departure_time = departure_time or dtime_b
        departure_page_num_found = departure_page_num_found or dpage_b

    # If we have a departure flight number, try a full-document lookup for an explicit 'Departure time' label
    if departure_flight:
        dep_pattern = re.compile(r"flight number[^\d]*(%s)" % re.escape(str(departure_flight)), re.I)
        # Collect candidate pages that mention this flight number and an explicit 'Departure time'
        candidates = []
        for pnum, txt in pages:
            if not txt:
                continue
            if dep_pattern.search(txt):
                m_dep = re.search(r"departure time[^\d]*(\d{1,2}:\d{2})", txt, re.I)
                if m_dep:
                    candidates.append((pnum, m_dep.group(1)))
        # Prefer a candidate page nearest to the booking's departure page (booking page where search started)
        if candidates:
            # departure_page_num is the booking's first matched page
            try:
                ref = int(departure_page_num)
            except Exception:
                ref = None
            if ref is not None:
                candidates.sort(key=lambda x: abs(x[0] - ref))
            # pick the closest candidate
            departure_page_num_found, departure_time = candidates[0]
        else:
            # fallback: scan whole document for an explicit 'Departure time' label near the flight number
            for pnum, txt in pages:
                if not txt:
                    continue
                if dep_pattern.search(txt):
                    m_dep = re.search(r"departure time[^\d]*(\d{1,2}:\d{2})", txt, re.I)
                    if m_dep:
                        departure_time = m_dep.group(1)
                        departure_page_num_found = pnum
                        break

    # Additional improvement: prefer a flight found near the booking's departure page
    # (within a small window) if it has a labeled time or an obvious time on the page.
    try:
        ref_page = int(departure_page_num)
    except Exception:
        ref_page = None
    if ref_page is not None:
        local_candidates = []
        window = 5
        for pnum, txt in pages:
            if not txt:
                continue
            if abs(pnum - ref_page) > window:
                continue
            lines = txt.splitlines()
            for i, line in enumerate(lines):
                fnum = extract_flight_number(line)
                if not fnum:
                    continue
                # search a small nearby window around the line for a labeled departure time or any time
                nearby = "\n".join(lines[max(0, i-2):i+3])
                m_label = re.search(r"departure time[^\d]*(\d{1,2}:\d{2})", nearby, re.I) or re.search(r"depart(?:ure)?[^\d]*(\d{1,2}:\d{2})", nearby, re.I)
                if m_label:
                    local_candidates.append((pnum, fnum, m_label.group(1), True, i))
                    continue
                m_time = re.search(r"(\d{1,2}:\d{2})", nearby)
                if m_time:
                    local_candidates.append((pnum, fnum, m_time.group(1), False, i))
        if local_candidates:
            # sort: prefer labeled times first, then nearest page to ref, then nearest line index
            local_candidates.sort(key=lambda x: (0 if x[3] else 1, abs(x[0] - ref_page), x[4]))
            chosen = local_candidates[0]
            departure_page_num_found = chosen[0]
            # Override prior departure flight/time with the best local candidate
            departure_flight = chosen[1]
            departure_time = chosen[2]

    passenger_list = []
    passenger_seen = set()
    service_entries = []
    status = None
    dates_found = []

    # allow Unicode word characters so accented names are matched (e.g., Dubská)
    name_re = re.compile(r"\b\d+\s+(?P<name>(?:Mr|Mrs|Miss|Ms|Dr|Master|Mstr|Mx)\.?\s+[\w][\w .'\-]+?)\s+(?P<birth>\d{2}-\d{2}-\d{2})", re.I)
    name_re_chdinf = re.compile(r"\b\d+\s+(?P<type>Chd|Inf)\b\s+(?P<name>[\w][\w .'\-]+?)\s+(?P<birth>\d{2}-\d{2}-\d{2})", re.I)
    # fallback: names without titles (all uppercase name then birth date)
    name_re_no_title = re.compile(r"\b\d+\s+(?P<name>[\w][\w .'\-]+?)\s+(?P<birth>\d{2}-\d{2}-\d{2})")

    for page_num, text in matched_pages:
        if not text:
            continue
        for line in (text or "").splitlines():
            if booking_no not in line:
                continue
            m_title = name_re.search(line)
            m_chd = name_re_chdinf.search(line)
            birth_to_skip = None
            if m_title:
                name = m_title.group('name').strip()
                birth = m_title.group('birth')
                birth_to_skip = birth
                # If the line contains child/infant markers, prefix the type before the name.
                typ_m = re.search(r"\b(Chd|Inf)\b", line, re.I)
                if typ_m:
                    typ = typ_m.group(1)
                    age_suf = format_age_suffix(birth)
                    if age_suf is not None:
                        name = f"{typ} {name} ({age_suf})"
                if name not in passenger_seen:
                    passenger_seen.add(name)
                    passenger_list.append(name)
            elif m_chd:
                typ = m_chd.group('type')
                name = m_chd.group('name').strip()
                birth = m_chd.group('birth')
                birth_to_skip = birth
                age_suf = format_age_suffix(birth)
                if age_suf is not None:
                    name = f"{typ} {name} ({age_suf})"
                else:
                    name = f"{typ} {name}"
                if name not in passenger_seen:
                    passenger_seen.add(name)
                    passenger_list.append(name)

            if line.strip().upper().startswith(f"B {booking_no}"):
                pass
            else:
                m_service = re.search(r"\*\s*(.*?)\s*(?:DLX|\(|$)", line)
                if m_service:
                    raw = m_service.group(1).strip()
                    cleaned = re.split(r"\s+(?:[A-Z]+/[A-Z0-9]+|\d{1,2}\b|\d{2}-\d{2}-\d{2})", raw, maxsplit=1)[0].strip()
                    if cleaned:
                        entry = {"raw": raw, "cleaned": cleaned, "dates": [], "page": None}
                        service_entries.append(entry)
                else:
                    m_service2 = re.search(r"([A-Z][A-Z0-9 ]{2,}?)\s+(?:[A-Z]+/[A-Z0-9]+|\d{1,2}\b|\d{2}-\d{2}-\d{2}|DLX|\(|$)", line)
                    if m_service2:
                        cand = m_service2.group(1).strip()
                        if cand:
                            if re.search(r"\b(Mr|Mrs|Miss|Ms|Dr|Master|Mstr|Mx)\b", line, re.I):
                                pass
                            else:
                                entry = {"raw": cand, "cleaned": cand, "dates": [], "page": None}
                                service_entries.append(entry)

            m_status = re.search(r"\b(OK|OP|RQ|CNX)\b", line)
            if m_status:
                status = m_status.group(1)

            m_dates = re.findall(r"\d{2}-\d{2}-\d{2}", line)
            parsed_dates = []
            for dstr in m_dates:
                if birth_to_skip and dstr == birth_to_skip:
                    continue
                d = _parse_date_str(dstr)
                if d:
                    if 2000 <= d.year <= (date.today().year + 10):
                        dates_found.append(d)
                        parsed_dates.append(d)
            # attach parsed_dates to the most recent service entry on this line (if any)
            if parsed_dates and service_entries:
                # prefer the last service entry appended that hasn't got a page set yet
                for se in reversed(service_entries):
                    if se.get('page') is None:
                        se['dates'].extend(parsed_dates)
                        se['page'] = page_num
                        break

    arrival_flight_formatted = format_flight_number(arrival_flight, prefix_arrival)
    departure_flight_formatted = format_flight_number(departure_flight, prefix_departure)

    # Detect airline on the pages where arrival/departure times were found
    def _get_page_text_by_pnum(pnum):
        for pp, txt in pages:
            if pp == pnum:
                return txt
        return None

    arrival_airline = None
    departure_airline = None
    try:
        # arrival
        apnum = arrival_page_num_found or arrival_page_num
        atext = _get_page_text_by_pnum(apnum) if apnum is not None else None
        arrival_airline = _detect_airline_on_text(atext)
        if arrival_airline:
            arrival_flight_formatted = _format_by_airline(arrival_flight_formatted or arrival_flight, arrival_airline)
    except Exception:
        arrival_airline = None

    try:
        dpnum = departure_page_num_found or departure_page_num
        dtext = _get_page_text_by_pnum(dpnum) if dpnum is not None else None
        departure_airline = _detect_airline_on_text(dtext)
        if departure_airline:
            departure_flight_formatted = _format_by_airline(departure_flight_formatted or departure_flight, departure_airline)
    except Exception:
        departure_airline = None

    hotel_keywords = ["HOTEL", "RESORT", "VILLA", "SOFITEL", "DUSIT", "CHA-DA", "CHA DA", "PHOKEETHRA", "THANI", "KRABI", "PHUKET", "LA", "KANTARY", "SANTHIYA", "GRACELAND", "MY", "MIDA", "LE", "MAIKHAO", "KATATHANI", "DEEVANA", "KHAOLAK", "DEEVANA", "DIAMOND", "BARCELO", "KORA", "MORACEA", "CAPE", "THE", "MANDARAVA", "VERANDA", "BEST"]

    passenger_surnames = set()
    for p in passenger_list:
        name_only = re.sub(r"\s*\(\d+YO\)$", "", p)
        parts = name_only.split()
        if parts:
            passenger_surnames.add(parts[-1].upper())

    def looks_like_passenger_name(s):
        for surname in passenger_surnames:
            if surname and surname in s:
                return True
        return False

    def clean_service_name(s):
        toks = s.split()
        kept = []
        for t in toks:
            if '/' in t or t.isdigit():
                break
            if re.search(r"\d", t) and len(t) <= 4:
                break
            kept.append(t)
        return " ".join(kept).strip().strip(',;')

    # Build cleaned service entries with attached dates
    cleaned_entries = []
    seen_keys = set()
    for se in service_entries:
        cand = se.get('cleaned') or se.get('raw')
        if not cand:
            continue
        if booking_no in cand:
            continue
        key = cand.strip().upper()
        if key in seen_keys:
            continue
        seen_keys.add(key)
        cleaned_name = clean_service_name(cand)
        cleaned_entries.append({
            'name': cleaned_name,
            'upper': cleaned_name.upper(),
            'dates': se.get('dates', []) or [],
            'page': se.get('page')
        })

    # Filter out entries that look like passenger names
    entries_filtered = [e for e in cleaned_entries if not looks_like_passenger_name(e['upper'])]

    # Prefer entries containing hotel keywords when available
    preferred = [e for e in entries_filtered if any(k in e['upper'] for k in hotel_keywords)]
    final_entries = preferred if preferred else entries_filtered if entries_filtered else cleaned_entries

    # Deduplicate by upper name while preserving order
    seen_final = set()
    final = []
    final_entries_unique = []
    for e in final_entries:
        if not e['name']:
            continue
        k = e['upper']
        if k in seen_final:
            continue
        seen_final.add(k)
        final.append(e['name'])
        final_entries_unique.append(e)

    service = "; ".join(final) if final else None

    # Build per-service date ranges (start/end) from attached dates
    service_date_ranges = []
    for e in final_entries_unique:
        dates = e.get('dates') or []
        if dates:
            start = min(dates)
            end = max(dates)
            service_date_ranges.append({'service': e['name'], 'start': start, 'end': end})
        else:
            service_date_ranges.append({'service': e['name'], 'start': None, 'end': None})

    # If no passengers found, attempt a relaxed pass to capture uppercase names without titles.
    matched_lines = []
    if not passenger_list:
        for page_num, text in matched_pages:
            if not text:
                continue
            for line in (text or "").splitlines():
                if booking_no not in line:
                    continue
                matched_lines.append((page_num, line))
                m_relax = name_re_no_title.search(line)
                if m_relax:
                    # avoid catching obvious hotel/service lines by excluding hotel keywords
                    if not re.search(r"\b(HOTEL|RESORT|VILLA|CHA-DA|SOFITEL|DUSIT|RESORT)\b", line, re.I):
                        name = m_relax.group('name').strip()
                        birth = m_relax.group('birth')
                        age_suf = format_age_suffix(birth)
                        typ_m = re.search(r"\b(Chd|Inf)\b", line, re.I)
                        if age_suf:
                            if typ_m:
                                typ = typ_m.group(1)
                                name = f"{typ} {name} ({age_suf})"
                            else:
                                name = f"{name} ({age_suf})"
                        else:
                            if typ_m:
                                name = f"{typ_m.group(1)} {name}"
                        if name not in passenger_seen:
                            passenger_seen.add(name)
                            passenger_list.append(name)


    start_date = None
    end_date = None
    if dates_found:
        earliest = min(dates_found)
        latest = max(dates_found)
        start_date = earliest.strftime("%d/%m/%Y")
        end_date = latest.strftime("%d/%m/%Y")

    # Compute passenger counts: adults vs children/infants
    pax_adult = 0
    pax_child = 0
    for p in passenger_list:
        # Treat entries with 'Chd' or 'Inf' as child/infant
        if re.search(r"\b(Chd|Inf)\b", p, re.I):
            pax_child += 1
        else:
            pax_adult += 1

    pax_summary = f"Adult = {pax_adult} PAX\nChild = {pax_child} PAX"

    return {
        "arrival": {"flight": arrival_flight_formatted, "time": arrival_time, "page": arrival_page_num_found},
        "departure": {"flight": departure_flight_formatted, "time": departure_time, "page": departure_page_num_found},
        "passengers": passenger_list,
        "pax_adult": pax_adult,
        "pax_child": pax_child,
        "pax_summary": pax_summary,
        "airline": {"arrival": arrival_airline, "departure": departure_airline},
        "service": service,
        "service_date_ranges": service_date_ranges,
        "status": status,
        "start_date": start_date,
        "end_date": end_date,
        "matched_lines": matched_lines,
    }

# -------------------
# In-memory cache
# -------------------
CACHE = {}
CACHE_TTL_SECONDS = 60 * 30

def _cleanup_cache():
    now = datetime.utcnow()
    to_delete = [k for k, v in CACHE.items() if (now - v.get('created', now)).total_seconds() > CACHE_TTL_SECONDS]
    for k in to_delete:
        try:
            del CACHE[k]
        except:
            pass

# Routes
@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "Booking Parser API",
        "version": "1.0.0"
    }

@app.get("/health")
def health():
    return {"status": "healthy", "cache_size": len(CACHE)}

# ⚠️ แก้ upload endpoint - เพิ่m error handling
@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload PDF and cache"""
    print(f"📥 Received upload request: {file.filename}")
    
    # Cleanup cache
    _cleanup_cache()
    
    # Validate file
    if not file:
        print("❌ No file provided")
        raise HTTPException(status_code=400, detail="No file provided")
    
    if not file.filename.lower().endswith('.pdf'):
        print(f"❌ Invalid file type: {file.filename}")
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    # Check file size (limit 10MB for free tier)
    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)
    print(f"📄 File size: {file_size_mb:.2f} MB")
    
    if file_size_mb > 10:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    
    # Create temp directory
    tmp_dir = tempfile.mkdtemp()
    tmp_path = os.path.join(tmp_dir, file.filename)
    
    try:
        # Save file
        print(f"💾 Saving to: {tmp_path}")
        with open(tmp_path, "wb") as f:
            f.write(content)
        
        # Extract pages with timeout
        print("📖 Extracting pages...")
        try:
            # ⚠️ ใช้ asyncio.wait_for เพื่อ timeout
            pages = await asyncio.wait_for(
                asyncio.to_thread(extract_all_pages, tmp_path),
                timeout=30.0  # 30 seconds timeout
            )
            print(f"✅ Extracted {len(pages)} pages")
        except asyncio.TimeoutError:
            print("❌ Timeout while extracting pages")
            raise HTTPException(status_code=504, detail="PDF processing timeout")
        except Exception as e:
            print(f"❌ Error extracting pages: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error extracting PDF: {str(e)}")
        
        # Build index
        print("🔍 Building index...")
        index = build_booking_index(pages)
        print(f"✅ Index built with {len(index)} bookings")
        
        # Create session
        session_id = str(uuid4())
        CACHE[session_id] = {
            "pages": pages,
            "index": index,
            "created": datetime.utcnow()
        }
        
        print(f"✅ Upload successful: {session_id}")
        
        return JSONResponse(
            content={
                "sessionId": session_id,
                "pages": len(pages),
                "bookings": len(index),
                "status": "success"
            },
            headers={"Access-Control-Allow-Origin": "*"}
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")
    
    finally:
        # Cleanup
        try:
            shutil.rmtree(tmp_dir)
            print(f"🗑️ Cleaned up temp dir")
        except Exception as e:
            print(f"⚠️ Error cleaning up: {str(e)}")

@app.post("/api/search")
async def search_cache(
    booking: str = Form(...),
    sessionId: str = Form(...)
):
    """Search cached PDF"""
    print(f"🔍 Search request: booking={booking}, session={sessionId}")
    
    if not booking or not sessionId:
        raise HTTPException(status_code=400, detail="booking and sessionId required")
    
    entry = CACHE.get(sessionId)
    if not entry:
        print(f"❌ Session not found: {sessionId}")
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    pages = entry.get("pages")
    index = entry.get("index")
    pre_matched = index.get(booking) if index else None
    
    try:
        result = parse_booking(
            pages, booking,
            prefix_arrival=None,
            prefix_departure=None,
            pre_matched_pages=pre_matched
        )
        
        if not result:
            print(f"❌ Booking not found: {booking}")
            raise HTTPException(status_code=404, detail="Booking not found")
        
        result["booking"] = booking
        result["sessionId"] = sessionId
        
        print(f"✅ Search successful: {booking}")
        
        return JSONResponse(
            content=result,
            headers={"Access-Control-Allow-Origin": "*"}
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Search error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")

@app.post("/api/parse")
async def parse_upload(
    booking: str = Form(...),
    file: UploadFile = File(...)
):
    """Parse without caching"""
    print(f"📥 Parse request: booking={booking}, file={file.filename}")
    
    if not booking:
        raise HTTPException(status_code=400, detail="booking required")
    
    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)
    
    if file_size_mb > 10:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    
    tmp_dir = tempfile.mkdtemp()
    tmp_path = os.path.join(tmp_dir, file.filename)
    
    try:
        with open(tmp_path, "wb") as f:
            f.write(content)
        
        # Extract with timeout
        try:
            pages = await asyncio.wait_for(
                asyncio.to_thread(extract_all_pages, tmp_path),
                timeout=30.0
            )
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="PDF processing timeout")
        
        index = build_booking_index(pages)
        pre_matched = index.get(booking)
        
        result = parse_booking(
            pages, booking,
            prefix_arrival=None,
            prefix_departure=None,
            pre_matched_pages=pre_matched
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        result["booking"] = booking
        
        return JSONResponse(
            content=result,
            headers={"Access-Control-Allow-Origin": "*"}
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Parse error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        try:
            shutil.rmtree(tmp_dir)
        except:
            pass

# OPTIONS handlers
@app.options("/api/upload")
@app.options("/api/search")
@app.options("/api/parse")
async def options_handler():
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )