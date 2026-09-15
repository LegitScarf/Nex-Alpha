import os
import sqlite3
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "omega.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Chat History table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        dataset_id TEXT NOT NULL,
        message TEXT NOT NULL,
        answer TEXT NOT NULL,
        components TEXT NOT NULL, -- JSON string representation of dynamic UI components
        created_at TEXT NOT NULL
    )
    """)
    
    # User Query limits table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS query_limits (
        user_id TEXT NOT NULL,
        query_date TEXT NOT NULL,
        query_count INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, query_date)
    )
    """)
    
    # Persistent Datasets table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        row_count INTEGER NOT NULL,
        columns TEXT NOT NULL,
        dtypes TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)
    
    conn.commit()
    conn.close()

def log_chat(user_id: str, session_id: str, dataset_id: str, message: str, answer: str, components: list):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO chat_history (user_id, session_id, dataset_id, message, answer, components, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id,
        session_id,
        dataset_id,
        message,
        answer,
        json.dumps(components),
        datetime.utcnow().isoformat()
    ))
    conn.commit()
    conn.close()

def get_chat_history(user_id: str, session_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, message, answer, components, created_at 
    FROM chat_history 
    WHERE user_id = ? AND session_id = ?
    ORDER BY id ASC
    """, (user_id, session_id))
    rows = cursor.fetchall()
    conn.close()
    
    history = []
    for r in rows:
        history.append({
            "id": r["id"],
            "message": r["message"],
            "answer": r["answer"],
            "components": json.loads(r["components"]),
            "created_at": r["created_at"]
        })
    return history

def get_user_sessions(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT DISTINCT session_id, dataset_id, MAX(created_at) as last_activity
    FROM chat_history
    WHERE user_id = ?
    GROUP BY session_id
    ORDER BY last_activity DESC
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [{"session_id": r["session_id"], "dataset_id": r["dataset_id"], "last_activity": r["last_activity"]} for r in rows]

def check_and_increment_limits(user_id: str, limit: int = 5) -> bool:
    """
    Checks if a user has exceeded their daily limit. If not, increments the count and returns True.
    If limit is exceeded, returns False.
    """
    today = datetime.utcnow().strftime("%Y-%m-%d")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
    SELECT query_count FROM query_limits WHERE user_id = ? AND query_date = ?
    """, (user_id, today))
    row = cursor.fetchone()
    
    if row is None:
        cursor.execute("""
        INSERT INTO query_limits (user_id, query_date, query_count) VALUES (?, ?, 1)
        """, (user_id, today))
        conn.commit()
        conn.close()
        return True
    
    current_count = row["query_count"]
    if current_count >= limit:
        conn.close()
        return False
        
    cursor.execute("""
    UPDATE query_limits SET query_count = query_count + 1 WHERE user_id = ? AND query_date = ?
    """, (user_id, today))
    conn.commit()
    conn.close()
    return True

def register_persistent_dataset(dataset_id: str, filename: str, file_path: str, row_count: int, columns: list, dtypes: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT OR REPLACE INTO datasets (id, filename, file_path, row_count, columns, dtypes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        dataset_id,
        filename,
        file_path,
        row_count,
        json.dumps(columns),
        json.dumps(dtypes),
        datetime.utcnow().isoformat()
    ))
    conn.commit()
    conn.close()

def get_persistent_dataset(dataset_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT filename, file_path, row_count, columns, dtypes FROM datasets WHERE id = ?
    """, (dataset_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "filename": row["filename"],
            "file_path": row["file_path"],
            "row_count": row["row_count"],
            "columns": json.loads(row["columns"]),
            "dtypes": json.loads(row["dtypes"])
        }
    return None

