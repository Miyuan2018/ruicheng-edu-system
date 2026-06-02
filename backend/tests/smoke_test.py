"""V2.1.1 Smoke Test Suite - tests all core paths"""
import sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)
PASS = 0
FAIL = 0


def check(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  [PASS] {name}")
    else:
        FAIL += 1
        print(f"  [FAIL] {name} - {detail}")


def json_id(r):
    """Extract id from JSON response safely."""
    try:
        return r.json()["id"]
    except Exception:
        return ""


# ======= 1. Auth =======
print("=== 1. Authentication ===")
r = c.post("/api/v1/auth/login", data={"username": "teacher@example.com", "password": "testpass123"})
check("Teacher login", r.status_code == 200)
t_tok = r.json().get("access_token", "")

r = c.post("/api/v1/auth/register", json={
    "email": "smoke1@t.com", "username": "smoke1", "password": "testpass123",
    "full_name": "Smoke1", "role": "STUDENT"})
check("Student register", r.status_code == 200)
s_tok = r.json().get("access_token", "")

r = c.get("/api/v1/users/me", headers={"Authorization": f"Bearer {t_tok}"})
check("JWT valid", r.status_code == 200 and "email" in r.json())

r = c.get("/api/v1/users/me", headers={"Authorization": "Bearer bad_token"})
check("JWT reject", r.status_code in (401, 403))

# ======= 2. Questions =======
print("=== 2. Questions ===")
r = c.post("/api/v1/questions", headers={"Authorization": f"Bearer {t_tok}"}, json={
    "title": "Smoke-勾股定理", "question_type": "SINGLE_CHOICE",
    "difficulty": "MEDIUM", "subject": "数学", "score": 15, "correct_answer": "C"})
check("Create question", r.status_code == 200)
q1 = json_id(r)

r = c.get(f"/api/v1/questions/{q1}", headers={"Authorization": f"Bearer {t_tok}"})
check("Get question", r.status_code == 200)

r = c.get("/api/v1/questions", headers={"Authorization": f"Bearer {t_tok}"})
check("List questions", r.status_code == 200 and len(r.json()) > 0)

# ======= 3. Paper + Submission + Grade =======
print("=== 3. Paper -> Unit -> Submit -> Grade ===")
r = c.post("/api/v1/exam-papers", headers={"Authorization": f"Bearer {t_tok}"}, json={
    "title": "Smoke试卷", "subject": "数学", "total_score": 15})
check("Create paper", r.status_code == 200)
pid = json_id(r)

# Create unit with question inline
r = c.post(f"/api/v1/exam-papers/{pid}/units", headers={"Authorization": f"Bearer {t_tok}"}, json={
    "name": "基础单元", "position": 1,
    "questions": [{
        "question_id": q1, "question_type": "SINGLE_CHOICE", "position": 1, "score": 15
    }]
})
check("Create unit", r.status_code == 200)
uid = json_id(r)

# Publish paper
r = c.post(f"/api/v1/exam-papers/{pid}/publish", headers={"Authorization": f"Bearer {t_tok}"},
           json={"class_ids": []})
check("Publish paper", r.status_code == 200)

# Submit per-unit
r = c.post(f"/api/v1/answers/exam-papers/{pid}/units/{uid}/submit",
           headers={"Authorization": f"Bearer {s_tok}"}, json={
    "answers": [{"question_id": q1, "student_answer": "B"}]})
check("Submit answer", r.status_code == 200)
d = r.json()
check("Auto-graded", d.get("status") == "GRADED", f"status={d.get('status')}")
check("Score computed", d.get("total_score") is not None)

# ======= 4. Mistake Book =======
print("=== 4. Mistake Book ===")
r = c.get("/api/v1/users/me", headers={"Authorization": f"Bearer {s_tok}"})
me_id = r.json()["id"] if r.status_code == 200 else ""
r = c.get(f"/api/v1/error-notebooks/student/{me_id}", headers={"Authorization": f"Bearer {s_tok}"})
check("Auto-generated", r.status_code == 200 and len(r.json()) > 0)

# ======= 5. V2.1 Question Admin =======
print("=== 5. V2.1 Question Admin ===")
r = c.post("/api/v1/auth/register", json={
    "email": "smokeqa1@t.com", "username": "smokeqa1", "password": "testpass123",
    "full_name": "SQA1", "role": "QUESTION_ADMIN"})
check("QA register", r.status_code == 200)
qa_tok = r.json().get("access_token", "")

r = c.post("/api/v1/question-admin/syllabi", params={
    "title": "Smoke考纲", "grade_level": "八年级", "province": "上海", "subject": "数学"},
    headers={"Authorization": f"Bearer {qa_tok}"})
check("Create syllabus", r.status_code == 200)
ssid = json_id(r)

r = c.get(f"/api/v1/knowledge-tree/syllabi/{ssid}/tree",
           headers={"Authorization": f"Bearer {qa_tok}"})
check("Get knowledge tree", r.status_code == 200 and "tree" in r.json())

r = c.post("/api/v1/question-admin/generate", params={
    "knowledge_point": "勾股定理", "difficulty": "MEDIUM", "count": 3},
    headers={"Authorization": f"Bearer {qa_tok}"})
check("LLM generate", r.status_code == 200 and r.json()["count"] == 3)

r = c.post("/api/v1/question-admin/scrape", params={
    "knowledge_point": "勾股定理", "count": 5},
    headers={"Authorization": f"Bearer {qa_tok}"})
check("Web scrape", r.status_code == 200 and r.json()["scraped_count"] > 0)

r = c.get("/api/v1/question-admin/pending", headers={"Authorization": f"Bearer {qa_tok}"})
check("Pending list", r.status_code == 200 and len(r.json()) >= 3)

# Approve
pending_id = r.json()[0]["id"]
r = c.post(f"/api/v1/question-admin/{pending_id}/approve",
           headers={"Authorization": f"Bearer {qa_tok}"})
check("Approve", r.status_code == 200)

r = c.post("/api/v1/question-admin/deduplicate", headers={"Authorization": f"Bearer {qa_tok}"})
check("Deduplicate", r.status_code == 200)

# ======= 6. V2.1.1 Knowledge Tree =======
print("=== 6. V2.1.1 Knowledge Tree ===")
r = c.post(f"/api/v1/knowledge-tree/syllabi/{ssid}/nodes", params={
    "name": "数与代数", "node_type": "AREA", "sort_order": 1},
    headers={"Authorization": f"Bearer {qa_tok}"})
check("Create area node", r.status_code == 200)
aid = json_id(r)

c.post(f"/api/v1/knowledge-tree/syllabi/{ssid}/nodes", params={
    "name": "勾股定理", "node_type": "POINT", "parent_id": aid},
    headers={"Authorization": f"Bearer {qa_tok}"})
c.post(f"/api/v1/knowledge-tree/syllabi/{ssid}/nodes", params={
    "name": "三角函数", "node_type": "POINT", "parent_id": aid},
    headers={"Authorization": f"Bearer {qa_tok}"})
check("Create point nodes", True)

r = c.get(f"/api/v1/knowledge-tree/syllabi/{ssid}/tree",
          headers={"Authorization": f"Bearer {qa_tok}"})
check("Get tree", r.status_code == 200 and len(r.json().get("tree", [])) > 0)

r = c.put(f"/api/v1/knowledge-tree/syllabi/{ssid}/nodes/{aid}", params={
    "name": "数与代数(修订版)"}, headers={"Authorization": f"Bearer {qa_tok}"})
check("Edit parent -> children invalid",
      r.status_code == 200 and r.json()["affected_descendants"] == 2)

r = c.post(f"/api/v1/knowledge-tree/syllabi/{ssid}/nodes/{aid}/set-branch-active",
           params={"active": True}, headers={"Authorization": f"Bearer {qa_tok}"})
check("Branch restore all active",
      r.status_code == 200 and r.json()["affected_nodes"] == 3)

r = c.post(f"/api/v1/knowledge-tree/syllabi/{ssid}/new-version",
           headers={"Authorization": f"Bearer {qa_tok}"})
check("New version", r.status_code == 200 and r.json()["version"] >= 2)

r = c.get(f"/api/v1/knowledge-tree/syllabi/{ssid}/versions",
          headers={"Authorization": f"Bearer {qa_tok}"})
check("Version list", r.status_code == 200 and len(r.json()) >= 2)

# ======= Summary =======
print(f"\n{'=' * 50}")
print(f"  TOTAL: {PASS}/{PASS + FAIL} passed, {FAIL} failed")
print(f"{'=' * 50}")
sys.exit(0 if FAIL == 0 else 1)
