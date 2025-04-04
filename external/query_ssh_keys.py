#! /bin/python3

import psycopg2 as db_connect
import sys

def execute_search(username):
    parts = username.split("-")
    if(parts[0] != "decker"):
        return
    db_hostname=""
    db_username=""
    db_password=""
    db_name=""

    connection = db_connect.connect(host=db_hostname, user=db_username, password=db_password, database=db_name)

    cursor = connection.cursor()

    query = "PREPARE fetch_plan AS SELECT key from ssh_keys WHERE username = $1"
    cursor.execute(query)
    result = cursor.execute("EXECUTE fetch_plan (%s)", [parts[1]])
    for record in cursor:
        print("command=\"only_rsync\",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty " + record[0])

if (__name__ == '__main__'):
    if(len(sys.argv) >= 2):
        execute_search(sys.argv[1])
