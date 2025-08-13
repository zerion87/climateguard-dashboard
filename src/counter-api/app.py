import os
import fcntl
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DATA_DIR = '/data'
COUNTER_FILE = os.path.join(DATA_DIR, 'counter.txt')

# Ensure the data directory and counter file exist on startup
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)
if not os.path.exists(COUNTER_FILE):
    with open(COUNTER_FILE, 'w') as f:
        f.write('0')

@app.route('/api/counter', methods=['GET'])
def get_visitor_count():
    try:
        with open(COUNTER_FILE, 'r') as f:
            count_str = f.read()
            count = int(count_str)
    except (IOError, ValueError):
        count = 0
    return jsonify({'count': count})

@app.route('/api/counter/increment', methods=['POST'])
def increment_visitor_count():
    count = 0
    try:
        with open(COUNTER_FILE, 'r+') as f:
            # Lock the file exclusively. This will block until the lock is acquired.
            fcntl.flock(f, fcntl.LOCK_EX)

            # Read the current count
            count_str = f.read()
            if count_str:
                try:
                    count = int(count_str)
                except ValueError:
                    count = 0 # Reset if file content is invalid

            # Increment the count
            count += 1

            # Prepare to overwrite the file
            f.seek(0)
            f.truncate()
            f.write(str(count))

            # The lock is released automatically when the 'with' block is exited
            # and the file is closed.
    except IOError:
        # This could happen if the file doesn't exist, though we try to create it on startup.
        # Let's handle it gracefully.
        with open(COUNTER_FILE, 'w') as f:
            fcntl.flock(f, fcntl.LOCK_EX)
            count = 1
            f.write(str(count))

    return jsonify({'count': count})

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
