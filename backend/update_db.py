import sqlite3

conn = sqlite3.connect('library_system.db')
c = conn.cursor()
c.execute("UPDATE attendance_settings SET setting_value='14:00' WHERE setting_key='attendance_cutoff_time'")
conn.commit()
print("Updated successfully!")
