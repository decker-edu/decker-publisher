#! /bin/python3

import psycopg2 as db_connect
import sys
import os

def fetch_usernames():
    db_hostname=""
    db_username=""
    db_password=""
    db_name=""
	
    connection = db_connect.connect(host=db_hostname, user=db_username, password=db_password, database=db_name)

    cursor = connection.cursor()

    query = "PREPARE username_plan AS SELECT username from accounts"
    cursor.execute(query)
    result = cursor.execute("EXECUTE username_plan")
    output = "{\n\t\"users\": [\n"
    for record in cursor:
        output += "\t\t" + record[0] + ",\n"
    output += "\t]\n}"
    with open("users.json", "w") as user_file:
        user_file.write(output)

if (__name__ == '__main__'):
    print("running in: " + os.getcwd())
    fetch_usernames();
    print("fetched users and wrote to users.json")
