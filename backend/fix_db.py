import sqlite3
conn = sqlite3.connect('library_system.db')
cursor = conn.cursor()
cursor.execute("UPDATE admins SET created_at = '2026-09-30 04:34:12.798370' WHERE id = 1;")
conn.commit()
print("Updated successfully")
