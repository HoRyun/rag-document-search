import sqlite3

conn = sqlite3.connect("chroma.sqlite3")  # 데이터베이스 파일 열기
cursor = conn.cursor()

cursor.execute("SELECT * FROM table_name")  # 테이블 조회
rows = cursor.fetchall()

for row in rows:
    print(row)

conn.close()  # 연결 닫기
