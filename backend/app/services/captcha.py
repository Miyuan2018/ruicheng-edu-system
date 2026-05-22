"""Simple CAPTCHA service using in-memory storage (for SQLite dev)."""
import random
import string
import io
import base64
from datetime import datetime, timedelta

# In-memory captcha store: {key: {code, expires}}
_store: dict = {}


def generate_captcha() -> dict:
    """Generate a 4-character captcha. Returns {key, svg_base64}."""
    chars = string.ascii_uppercase + string.digits
    code = ''.join(random.choices(chars, k=4))
    key = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))

    # SVG captcha image
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="120" height="50">
  <rect width="120" height="50" fill="#f0f0f0" rx="4"/>
  <text x="15" y="35" font-size="28" font-family="Courier" fill="#333"
        font-weight="bold" letter-spacing="8">{code}</text>
  <line x1="0" y1="25" x2="120" y2="20" stroke="#ccc" stroke-width="1"/>
  <line x1="0" y1="40" x2="120" y2="42" stroke="#ccc" stroke-width="1"/>
</svg>'''
    svg_b64 = base64.b64encode(svg.encode()).decode()

    _store[key] = {"code": code, "expires": datetime.utcnow() + timedelta(minutes=5)}
    return {"key": key, "svg": f"data:image/svg+xml;base64,{svg_b64}"}


def verify_captcha(key: str, code: str) -> bool:
    """Verify captcha code. One-time use."""
    entry = _store.pop(key, None)
    if not entry:
        return False
    if datetime.utcnow() > entry["expires"]:
        return False
    return entry["code"].upper() == code.upper().strip()
