"""LaTeX 格式化工具 — 将非规范数学表达式转为 LaTeX 格式."""

import re

# 匹配 ^ 后的内容：花括号组、括号组、多位数、单个字符（非空格/运算符）
_SUP_PATTERN = re.compile(r'\^(\{.*?\}|\([^)]+\)|\d+|[^\s+\-*/=()^_])')

# 匹配 _ 后的内容：花括号组、多位数、单个字符（非空格/运算符）
_SUB_PATTERN = re.compile(r'_(\{.*?\}|\d+|[^\s+\-*/=()^_])')


def format_latex(text: str) -> str:
    """将不规范的数学表达式转为 LaTeX 格式.

    规则:
    - a^2 → a^{2}（上标缺花括号，自动包裹）
    - a^{2} → a^{2}（已有花括号，保持不变）
    - a_2 → a_{2}（下标缺花括号，自动包裹）
    - a_10 → a_{10}（多字符下标）
    - a^10 → a^{10}（多字符上标）

    原有花括号包裹的表达式不会被二次包裹。
    """
    text = _SUP_PATTERN.sub(_wrap_sup, text)
    text = _SUB_PATTERN.sub(_wrap_sub, text)
    return text


def _wrap_sup(m: re.Match) -> str:
    content = m.group(1)
    if content.startswith('{'):
        return '^' + content
    if content.startswith('(') and content.endswith(')'):
        return '^{' + content[1:-1] + '}'
    return '^{' + content + '}'


def _wrap_sub(m: re.Match) -> str:
    content = m.group(1)
    if content.startswith('{'):
        return '_' + content
    return '_{' + content + '}'
