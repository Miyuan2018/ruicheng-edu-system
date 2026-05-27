"""SimHash-based text deduplication for questions."""
import re
import hashlib
from typing import List, Tuple


def _tokenize(text: str) -> List[str]:
    """Simple tokenizer for Chinese/English mixed text."""
    # Remove special chars, keep Chinese characters and English words
    text = re.sub(r"[^\u4e00-\u9fff\w\s]", " ", text)
    tokens = []
    # Split by whitespace first
    for part in text.split():
        # Chinese character-level n-grams (2-gram)
        if any("\u4e00" <= c <= "\u9fff" for c in part):
            chars = [c for c in part if "\u4e00" <= c <= "\u9fff"]
            for i in range(len(chars) - 1):
                tokens.append(chars[i] + chars[i + 1])
        # English word-level tokens
        else:
            tokens.append(part.lower())
    return tokens


def _simhash(text: str, hashbits: int = 64) -> int:
    """Compute SimHash fingerprint of text."""
    tokens = _tokenize(text)
    if not tokens:
        return 0

    v = [0] * hashbits
    for token in tokens:
        h = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
        for i in range(hashbits):
            bit = (h >> i) & 1
            v[i] += 1 if bit else -1

    fingerprint = 0
    for i in range(hashbits):
        if v[i] >= 0:
            fingerprint |= (1 << i)
    return fingerprint


def _hamming_distance(hash1: int, hash2: int) -> int:
    """Hamming distance between two hashes."""
    x = hash1 ^ hash2
    distance = 0
    while x:
        distance += 1
        x &= x - 1
    return distance


def compute_content_hash(text: str) -> str:
    """Compute SimHash-based content hash for a question."""
    if not text:
        return ""
    fingerprint = _simhash(text)
    return f"{fingerprint:016x}"


def find_duplicates(questions: List[dict], threshold: float = 0.85) -> List[List[dict]]:
    """Find duplicate/similar question groups.

    Args:
        questions: list of dicts with 'id', 'title', 'content_hash'
        threshold: similarity threshold (0-1), default 0.85

    Returns:
        List of groups, each group is a list of similar questions
    """
    if len(questions) < 2:
        return []

    # Build content_hash mapping
    hash_map = {}
    for q in questions:
        h = q.get("content_hash") or compute_content_hash(q.get("title", ""))
        if h:
            hash_map.setdefault(h, []).append(q)

    # Find exact duplicates (same content_hash)
    exact_groups = []
    for h, group in hash_map.items():
        if len(group) > 1:
            exact_groups.append(group)

    # Find near-duplicates using Hamming distance
    items = [(q, int(q.get("content_hash") or "0", 16)) for q in questions if q.get("content_hash")]
    near_groups = []
    visited = set()
    hashbits = 64
    max_hamming = int((1 - threshold) * hashbits)

    for i, (q1, h1) in enumerate(items):
        if i in visited:
            continue
        group = [q1]
        visited.add(i)
        for j, (q2, h2) in enumerate(items):
            if j in visited:
                continue
            dist = _hamming_distance(h1, h2)
            if dist <= max_hamming:
                group.append(q2)
                visited.add(j)
        if len(group) > 1:
            near_groups.append(group)

    # Merge groups
    all_groups = exact_groups + near_groups
    return all_groups


def similarity(hash1: str, hash2: str) -> float:
    """Compute similarity between two content hashes."""
    if not hash1 or not hash2:
        return 0.0
    try:
        h1 = int(hash1, 16)
        h2 = int(hash2, 16)
        dist = _hamming_distance(h1, h2)
        return 1.0 - (dist / 64.0)
    except ValueError:
        return 0.0
